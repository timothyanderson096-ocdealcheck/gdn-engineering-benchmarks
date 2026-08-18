import { $fetch } from "ofetch-under-test";
import type {
  FetchOptions,
  FetchResponse,
} from "ofetch-under-test";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends
        (<T>() => T extends A ? 1 : 2)
      ? true
      : false
    : false;

type Expect<T extends true> = T;

// The callback makes FetchOptions invariant enough to reproduce issue #453's
// original assignment failure when create() widens "text" to ResponseType.
const textDefaults: FetchOptions<"text"> = {
  responseType: "text",
  retryDelay(context) {
    const responseType: "text" | undefined = context.options.responseType;
    return responseType === "text" ? 0 : 1;
  },
};

const textFetch = $fetch.create(textDefaults);

const callableResult = textFetch("/plain-text");
type CallablePropagatesDefault = Expect<
  Equal<Awaited<typeof callableResult>, string>
>;

const rawResult = textFetch.raw("/plain-text");
type RawPropagatesDefault = Expect<
  Equal<Awaited<typeof rawResult>, FetchResponse<string>>
>;

// Explicit per-call response types must still override the created default.
const blobOverride = textFetch("/binary", { responseType: "blob" });
type CallableOverrideRemainsPrecise = Expect<
  Equal<Awaited<typeof blobOverride>, Blob>
>;

const rawArrayBufferOverride = textFetch.raw("/binary", {
  responseType: "arrayBuffer",
});
type RawOverrideRemainsPrecise = Expect<
  Equal<Awaited<typeof rawArrayBufferOverride>, FetchResponse<ArrayBuffer>>
>;

// The returned value must expose the complete callable contract, including
// create(), raw(), and native, while retaining the chosen default response type.
void textFetch.create;
void textFetch.raw;
void textFetch.native;

// A second response kind guards against a text-only special case.
const blobDefaults: FetchOptions<"blob"> = { responseType: "blob" };
const blobFetch = $fetch.create(blobDefaults);
const blobResult = blobFetch("/blob");
type BlobDefaultPropagates = Expect<Equal<Awaited<typeof blobResult>, Blob>>;

export type AcceptanceAssertions = [
  CallablePropagatesDefault,
  RawPropagatesDefault,
  CallableOverrideRemainsPrecise,
  RawOverrideRemainsPrecise,
  BlobDefaultPropagates,
];
