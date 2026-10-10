"""Smoke checks for the CFI v0.1 prototype. NOT proof of human efficiency gains."""
import csv
import json
import tempfile
import unittest
from pathlib import Path
from cfi_pilot import FlowState, classify_mode, create_prompt, make_packets, summarize_results


class CfiSmokeTests(unittest.TestCase):
    def test_exploration(self):
        self.assertEqual(classify_mode("Maybe rules change how people behave."), "explore")

    def test_explicit_action(self):
        self.assertEqual(classify_mode("Let's test the hypothesis."), "action")

    def test_explicit_correction(self):
        self.assertEqual(classify_mode("No, that's not what I meant."), "correction")

    def test_question(self):
        self.assertEqual(classify_mode("Where do we go now?"), "question")

    def test_correction_does_not_erase_previous_mode(self):
        st = FlowState()
        st.observe("I think the problem is about incentives.")
        st.observe("No, you're missing my point.")
        self.assertEqual(st.mode, "explore")
        self.assertEqual(st.correction_count, 1)

    def test_both_prompts_same_conversation(self):
        case = {"history": [{"role": "user", "text": "My earlier thought."}],
                "last_user_message": "My next thought."}
        a, b = create_prompt(case, "baseline"), create_prompt(case, "cfi")
        self.assertIn("USER: My earlier thought.\nUSER: My next thought.", a)
        self.assertIn("USER: My earlier thought.\nUSER: My next thought.", b)
        self.assertNotEqual(a, b)

    def test_packet_pairing_and_blinding(self):
        cases = Path(__file__).with_name("benchmark_cases.json")
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            p, k = make_packets(cases, out)
            packets, key = json.loads(p.read_text()), json.loads(k.read_text())
            self.assertEqual(len(packets), 16)
            self.assertEqual(len(key), 16)
            self.assertEqual(len(set(item["response_id"] for item in packets)), 16)
            self.assertTrue(all("condition" not in item for item in packets))
            self.assertEqual({x["condition"] for x in key}, {"baseline", "cfi"})

    def test_no_ratings_is_not_evidence(self):
        cases = Path(__file__).with_name("benchmark_cases.json")
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            _, key = make_packets(cases, out)
            self.assertEqual(summarize_results(out / "RATINGS_TEMPLATE.csv", key)["status"], "NO_RATINGS")

    def test_mean_difference_after_scored_pair(self):
        cases = Path(__file__).with_name("benchmark_cases.json")
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            _, keypath = make_packets(cases, out)
            key = json.loads(keypath.read_text())
            rating_file = out / "RATINGS_TEMPLATE.csv"
            with rating_file.open(newline="", encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            first_case = key[0]["case_id"]
            condition_by_id = {item["response_id"]: item["condition"] for item in key}
            for row in rows:
                if row["response_id"].rsplit("-", 1)[0] == first_case:
                    row.update({"repair_turns": "2" if condition_by_id[row["response_id"]] == "baseline" else "1",
                                "outcome_quality_0_4": "3", "flow_fidelity_0_4": "3",
                                "over_inference_0_4": "0", "response_time_seconds": "15"})
            with rating_file.open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            result = summarize_results(rating_file, keypath)
            self.assertEqual(result["fully_paired_cases"], 1)
            self.assertEqual(result["paired_mean_repair_reduction"], 1.0)


if __name__ == "__main__":
    unittest.main()
