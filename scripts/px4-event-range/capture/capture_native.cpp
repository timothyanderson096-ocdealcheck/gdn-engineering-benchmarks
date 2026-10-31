#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <arpa/inet.h>
#include <poll.h>
#include <signal.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>

#include <array>
#include <cerrno>
#include <climits>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
constexpr std::size_t kBatch = 64;
constexpr std::size_t kPayload = 65535;
constexpr std::size_t kFlushBytes = 1U << 20;
constexpr int kOverflowOption = 40; // Linux SO_RXQ_OVFL ABI.
volatile sig_atomic_t stop_requested = 0;

void stop_handler(int) { stop_requested = 1; }

std::runtime_error system_error(const char *operation)
{
    return std::runtime_error(std::string(operation) + ": " + std::strerror(errno));
}

void write_all(int fd, const void *data, std::size_t size)
{
    const auto *bytes = static_cast<const unsigned char *>(data);
    while (size != 0) {
        const ssize_t result = ::write(fd, bytes, size);
        if (result < 0 && errno == EINTR) { continue; }
        if (result <= 0) { throw system_error("journal write"); }
        bytes += result;
        size -= static_cast<std::size_t>(result);
    }
}

void append_le(std::vector<unsigned char> &buffer, std::uint64_t value, unsigned size)
{
    for (unsigned i = 0; i < size; ++i) {
        buffer.push_back(static_cast<unsigned char>((value >> (8 * i)) & 255U));
    }
}

std::uint64_t monotonic_ns()
{
    timespec now{};
    if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) { throw system_error("clock_gettime"); }
    return static_cast<std::uint64_t>(now.tv_sec) * 1000000000ULL + now.tv_nsec;
}

std::string quoted(const std::string &value)
{
    std::string result = "\"";
    constexpr char hex[] = "0123456789abcdef";
    for (unsigned char c : value) {
        if (c == '"' || c == '\\') { result += '\\'; result += static_cast<char>(c); }
        else if (c < 32) { result += "\\u00"; result += hex[c >> 4]; result += hex[c & 15]; }
        else { result += static_cast<char>(c); }
    }
    return result + '"';
}

struct Counters {
    std::uint64_t packets{}, payload_bytes{}, batches{}, journal_bytes{};
    std::uint32_t dropped{};
    bool observed_loss{};
};

struct alignas(cmsghdr) ControlBuffer { std::array<unsigned char, 256> bytes{}; };

void capture(int socket_fd, int journal_fd, Counters &counts)
{
    int type{};
    socklen_t type_size = sizeof(type);
    if (getsockopt(socket_fd, SOL_SOCKET, SO_TYPE, &type, &type_size) != 0) {
        throw system_error("socket type");
    }
    if (type != SOCK_DGRAM) { throw std::runtime_error("inherited FD is not a datagram socket"); }
    sockaddr_storage local{};
    socklen_t local_size = sizeof(local);
    if (getsockname(socket_fd, reinterpret_cast<sockaddr *>(&local), &local_size) != 0) {
        throw system_error("socket address");
    }
    if (local.ss_family != AF_INET) { throw std::runtime_error("inherited socket is not IPv4"); }

    auto payload = std::make_unique<unsigned char[]>(kBatch * kPayload);
    std::vector<sockaddr_in> addresses(kBatch);
    std::vector<ControlBuffer> controls(kBatch);
    std::vector<iovec> vectors(kBatch);
    std::vector<mmsghdr> messages(kBatch);
    for (std::size_t i = 0; i < kBatch; ++i) {
        vectors[i] = {payload.get() + i * kPayload, kPayload};
        messages[i].msg_hdr.msg_name = &addresses[i];
        messages[i].msg_hdr.msg_iov = &vectors[i];
        messages[i].msg_hdr.msg_iovlen = 1;
        messages[i].msg_hdr.msg_control = controls[i].bytes.data();
    }
    std::vector<unsigned char> pending;
    pending.reserve(kFlushBytes + kBatch * 512);
    auto flush = [&]() {
        if (!pending.empty()) {
            write_all(journal_fd, pending.data(), pending.size());
            counts.journal_bytes += pending.size();
            pending.clear();
        }
    };
    try {
        while (true) {
            for (auto &message : messages) {
                message.msg_hdr.msg_namelen = sizeof(sockaddr_in);
                message.msg_hdr.msg_controllen = sizeof(ControlBuffer);
                message.msg_hdr.msg_flags = 0;
                message.msg_len = 0;
            }
            const int received = recvmmsg(socket_fd, messages.data(), kBatch, MSG_DONTWAIT, nullptr);
            if (received < 0) {
                if (errno == EINTR) { continue; }
                if (errno != EAGAIN && errno != EWOULDBLOCK) { throw system_error("recvmmsg"); }
                // Flush the quiet tail immediately. A stop drains already queued
                // packets to EAGAIN; the Python watchdog bounds a nonquiet stop.
                flush();
                if (stop_requested) { break; }
                pollfd watched{socket_fd, POLLIN, 0};
                const int ready = poll(&watched, 1, 100);
                if (ready < 0 && errno != EINTR) { throw system_error("poll"); }
                if (ready > 0 && (watched.revents & (POLLERR | POLLHUP | POLLNVAL))) {
                    throw std::runtime_error("unexpected inherited socket poll error");
                }
                continue;
            }
            if (received == 0) { throw std::runtime_error("unexpected empty recvmmsg batch"); }
            ++counts.batches;
            for (int i = 0; i < received; ++i) {
                auto &message = messages[i];
                const auto &address = addresses[i];
                if (message.msg_hdr.msg_flags & (MSG_TRUNC | MSG_CTRUNC)) {
                    throw std::runtime_error("truncated UDP payload or ancillary data");
                }
                if (message.msg_hdr.msg_namelen < sizeof(sockaddr_in) || address.sin_family != AF_INET
                    || message.msg_len > kPayload) {
                    throw std::runtime_error("invalid IPv4 datagram metadata");
                }
                for (cmsghdr *cmsg = CMSG_FIRSTHDR(&message.msg_hdr); cmsg != nullptr;
                     cmsg = CMSG_NXTHDR(&message.msg_hdr, cmsg)) {
                    if (cmsg->cmsg_level == SOL_SOCKET && cmsg->cmsg_type == kOverflowOption) {
                        if (cmsg->cmsg_len < CMSG_LEN(sizeof(std::uint32_t))) {
                            throw std::runtime_error("short SO_RXQ_OVFL ancillary value");
                        }
                        std::memcpy(&counts.dropped, CMSG_DATA(cmsg), sizeof(counts.dropped));
                        counts.observed_loss = counts.observed_loss || counts.dropped != 0;
                    }
                }
                append_le(pending, monotonic_ns(), 8);
                const auto *ip = reinterpret_cast<const unsigned char *>(&address.sin_addr.s_addr);
                pending.insert(pending.end(), ip, ip + 4);
                append_le(pending, ntohs(address.sin_port), 2);
                append_le(pending, message.msg_len, 2);
                append_le(pending, counts.dropped, 4);
                pending.insert(pending.end(), payload.get() + i * kPayload,
                               payload.get() + i * kPayload + message.msg_len);
                ++counts.packets;
                counts.payload_bytes += message.msg_len;
            }
            if (pending.size() >= kFlushBytes) { flush(); }
        }
    } catch (...) {
        flush();
        throw;
    }
}
} // namespace

int main(int argc, char **argv)
{
    int journal_fd = -1;
    int code = 2;
    Counters counts;
    std::string error;
    std::string status_path;
    try {
        if (argc != 4) { throw std::runtime_error("usage: capture_native FD JOURNAL STATUS_JSON"); }
        char *end{};
        errno = 0;
        const long parsed = std::strtol(argv[1], &end, 10);
        if (errno != 0 || *end != '\0' || end == argv[1] || parsed < 0 || parsed > INT_MAX) {
            throw std::runtime_error("invalid inherited socket FD");
        }
        status_path = argv[3];
        struct sigaction action{};
        action.sa_handler = stop_handler;
        sigemptyset(&action.sa_mask);
        if (sigaction(SIGTERM, &action, nullptr) != 0 || sigaction(SIGINT, &action, nullptr) != 0) {
            throw system_error("sigaction");
        }
        journal_fd = open(argv[2], O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
        if (journal_fd < 0) { throw system_error("open new journal"); }
        constexpr char magic[] = "PX4UDP1\n";
        write_all(journal_fd, magic, sizeof(magic) - 1);
        counts.journal_bytes = sizeof(magic) - 1;
        capture(static_cast<int>(parsed), journal_fd, counts);
        if (counts.observed_loss) { throw std::runtime_error("observed SO_RXQ_OVFL receive loss"); }
        code = 0;
    } catch (const std::exception &failure) {
        error = failure.what();
    }
    if (journal_fd >= 0 && close(journal_fd) != 0) { code = 2; error = "journal close failed"; }
    std::ostringstream record;
    record << "{\"status\":" << quoted(code == 0 ? "STOPPED" : "CAPTURE_FAILED")
           << ",\"error\":" << quoted(error) << ",\"stop_requested\":" << (stop_requested ? "true" : "false")
           << ",\"packets\":" << counts.packets << ",\"payload_bytes\":" << counts.payload_bytes
           << ",\"batches\":" << counts.batches << ",\"journal_bytes\":" << counts.journal_bytes
           << ",\"kernel_dropped\":" << counts.dropped << "}\n";
    std::cerr << record.str();
    if (!status_path.empty()) {
        const int status_fd = open(status_path.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
        if (status_fd < 0) { return 2; }
        try { const auto value = record.str(); write_all(status_fd, value.data(), value.size()); }
        catch (...) { close(status_fd); return 2; }
        if (close(status_fd) != 0) { return 2; }
    }
    return code;
}
