#!/usr/bin/env python3
"""CFI v0.1: a transparent interaction-policy experiment, not a trained AI model.

Needs only Python 3.10+ and no paid API key. Produces paired,
blinded prompts for independent model testing and analyses human ratings.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

BASELINE_INSTRUCTIONS = """You are an accurate, helpful AI assistant. Answer the user's last message based on the conversation supplied. Ask for clarification when genuinely needed. Do not invent facts or claim to have performed actions."""

CFI_INSTRUCTIONS = """You are testing Cognitive Flow Intelligence (CFI), Timothy Anderson's proposed human-aligned interaction framework.

Read the ENTIRE dialogue for the developing purpose of the conversation. Before responding, privately consider multiple possible intentions, and distinguish a tentative hypothesis or anecdote from an explicit question or instruction. Track earlier user corrections and do not repeat a framing the user has rejected. Recognise useful associative links across topic changes without inventing a hidden motive.

Select the least disruptive helpful intervention: make a relevant contribution, test a hypothesis, ask a specific question only if essential, or execute an explicitly authorized action if tools actually allow it. Preserve meaningful flow, but do not flatter, mind-read, conceal uncertainty, skip necessary safety cautions, or treat an unsupported claim as fact. When the user needs a factual answer, give it plainly; when the user wants a real-world action, perform only what is available and permitted.

Success means fewer avoidable re-explanations and corrections at equal or better truthfulness, outcome quality, and human agency. Respond naturally, without explaining this framework unless asked."""

SIGNALS = {
    "correction": [r"\b(no,? (that's not|i meant|i was|i'm|you))", r"\b(you're (missing|being too literal)|not what i (said|meant|asked))", r"\bstop (explaining|assuming)"],
    "action": [r"^(?:please\s+)?(?:publish|send|build|write|create|run|test|check|upload|submit|deploy|make)\b", r"^let'?s\s+(?:build|test|publish|run|make|create)\b"],
    "verify": [r"\b(?:verify|fact.check|is that true|what's the evidence|source for|confirm whether)\b"],
    "explore": [r"\b(?:i think|i reckon|maybe|perhaps|what if|i noticed|my theory|imagine|i wonder|i was speaking|i was talking|could it be)\b"],
    "question": [r"\?$", r"^(?:what|why|how|when|where|who|is|are|does|can|could|should|would)\b"],
}


def classify_mode(message: str, previous_mode: str | None = None) -> str:
    """Coarse, auditable detector for a scaffold, not hidden mind-reading."""
    m = message.strip().lower()
    for mode in ("correction", "action", "verify", "explore", "question"):
        if any(re.search(p, m) for p in SIGNALS[mode]):
            return mode
    return previous_mode if previous_mode in {"explore", "question"} else "discussion"


@dataclass
class FlowState:
    mode: str = "discussion"
    turn_count: int = 0
    correction_count: int = 0
    user_turns: list[str] = field(default_factory=list)
    corrections: list[str] = field(default_factory=list)

    def observe(self, message: str) -> dict[str, object]:
        detected = classify_mode(message, self.mode)
        self.turn_count += 1
        self.user_turns.append(message)
        if detected == "correction":
            self.correction_count += 1
            self.corrections.append(message)
            # Do not mistake a correction for a new task or erase the existing mode.
        else:
            self.mode = detected
        return {"detected": detected, "ongoing_mode": self.mode,
                "turns": self.turn_count, "corrections": self.correction_count}


def render_dialogue(case: dict) -> str:
    turns = case["history"] + [{"role": "user", "text": case["last_user_message"]}]
    return "\n".join(f"{item['role'].upper()}: {item['text']}" for item in turns)


def create_prompt(case: dict, condition: str) -> str:
    assert condition in ("baseline", "cfi")
    system_text = BASELINE_INSTRUCTIONS if condition == "baseline" else CFI_INSTRUCTIONS
    return (f"[INSTRUCTIONS]\n{system_text}\n\n"
            f"[CONVERSATION]\n{render_dialogue(case)}\n\n"
            "[RESPONSE]\nWrite only the next assistant reply.")


def make_packets(cases_path: Path, output: Path, seed: int = 20261010) -> tuple[Path, Path]:
    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    output.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    packets, key = [], []
    for case in cases:
        options = ["baseline", "cfi"]
        rng.shuffle(options)
        for variant, condition in zip(("X", "Y"), options):
            identifier = f"{case['id']}-{variant}"
            packets.append({"response_id": identifier, "case_id": case["id"],
                            "condition_masked": variant, "task_type": case["task_type"],
                            "prompt": create_prompt(case, condition)})
            key.append({"response_id": identifier, "case_id": case["id"],
                        "condition": condition})
    rng.shuffle(packets)
    packet_path = output / "BLINDED_PROMPTS.json"
    key_path = output / "PRIVATE_CONDITION_KEY.json"
    packet_path.write_text(json.dumps(packets, indent=2, ensure_ascii=False), encoding="utf-8")
    key_path.write_text(json.dumps(key, indent=2), encoding="utf-8")
    rating_path = output / "RATINGS_TEMPLATE.csv"
    with rating_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["response_id", "repair_turns", "outcome_quality_0_4", "flow_fidelity_0_4",
                         "over_inference_0_4", "response_time_seconds", "notes"])
        for item in packets:
            writer.writerow([item["response_id"], "", "", "", "", "", ""])
    return packet_path, key_path


def summarize_results(rating_path: Path, key_path: Path) -> dict:
    key = {row["response_id"]: row for row in json.loads(key_path.read_text(encoding="utf-8"))}
    grouped: dict[str, list] = defaultdict(list)
    with rating_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not row["outcome_quality_0_4"]:
                continue
            rid = row["response_id"]
            if rid not in key:
                raise ValueError(f"Unknown response_id: {rid}")
            numeric_names = ["repair_turns", "outcome_quality_0_4", "flow_fidelity_0_4",
                             "over_inference_0_4", "response_time_seconds"]
            scores = {name: float(row[name]) if row[name].strip() else None for name in numeric_names}
            if not (scores["outcome_quality_0_4"] is not None
                    and 0 <= scores["outcome_quality_0_4"] <= 4):
                raise ValueError(f"Invalid outcome quality: {rid}")
            for name in ("flow_fidelity_0_4", "over_inference_0_4"):
                if scores[name] is not None and not 0 <= scores[name] <= 4:
                    raise ValueError(f"Out-of-range {name}: {rid}")
            for name in ("repair_turns", "response_time_seconds"):
                if scores[name] is not None and scores[name] < 0:
                    raise ValueError(f"Negative {name}: {rid}")
            grouped[key[rid]["condition"]].append((key[rid]["case_id"], scores))
    if not grouped:
        return {"status": "NO_RATINGS", "note": "No model or human performance experiment has yet been run."}
    result = {"status": "PARTIAL_OR_COMPLETED_PILOT",
              "warning": "Descriptive data only; no causal claim without matched controlled testing."}
    for condition in ("baseline", "cfi"):
        rows = grouped.get(condition, [])
        if not rows:
            continue
        result[condition] = {"rated": len(rows)}
        for metric in ["repair_turns", "outcome_quality_0_4", "flow_fidelity_0_4",
                       "over_inference_0_4", "response_time_seconds"]:
            vals = [s[metric] for _, s in rows if s[metric] is not None]
            result[condition][metric + "_mean"] = round(statistics.mean(vals), 3) if vals else None
    matched = set(case for case, _ in grouped.get("baseline", [])) & set(case for case, _ in grouped.get("cfi", []))
    result["fully_paired_cases"] = len(matched)
    if matched:
        condition_map = {condition: {k: v for k, v in rows} for condition, rows in grouped.items()}
        diffs = [condition_map["baseline"][case]["repair_turns"] - condition_map["cfi"][case]["repair_turns"]
                 for case in matched
                 if condition_map["baseline"][case]["repair_turns"] is not None
                 and condition_map["cfi"][case]["repair_turns"] is not None]
        result["paired_mean_repair_reduction"] = round(statistics.mean(diffs), 3) if diffs else None
    return result


def demo() -> None:
    st = FlowState()
    example = [
        "I was speaking to a shop owner about using a credit card to buffer a tax bill.",
        "Maybe the changed payment options lead to more businesses using payment plans.",
        "No, you're taking it literally. I'm exploring incentives, not asking for card advice.",
        "I wonder how we could actually test whether that consequence occurs.",
    ]
    print("CFI v0.1 — state and intervention demo (not an LLM performance test)")
    for i, line in enumerate(example, 1):
        print(f"Turn {i}: {line}\n    {st.observe(line)}")
    print("\nNOTE: Heuristic classification is a transparent controller scaffold, not proof of cognitive understanding.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["demo", "make-packets", "summarize"])
    parser.add_argument("--cases", type=Path, default=Path(__file__).with_name("benchmark_cases.json"))
    parser.add_argument("--output", type=Path, default=Path("cfi_trial_outputs"))
    parser.add_argument("--ratings", type=Path, default=Path("cfi_trial_outputs/RATINGS_TEMPLATE.csv"))
    parser.add_argument("--key", type=Path, default=Path("cfi_trial_outputs/PRIVATE_CONDITION_KEY.json"))
    args = parser.parse_args()
    if args.command == "demo":
        demo()
    elif args.command == "make-packets":
        prompt_path, key_path = make_packets(args.cases, args.output)
        print(f"Created {prompt_path} and {args.output / 'RATINGS_TEMPLATE.csv'}")
        print(f"PRIVATE unblinding key: {key_path}. Do not give it to scorers before ratings are complete.")
    else:
        print(json.dumps(summarize_results(args.ratings, args.key), indent=2))


if __name__ == "__main__":
    main()
