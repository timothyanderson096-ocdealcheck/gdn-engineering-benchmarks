# CFI Pilot v0.1 — Cognitive Flow Intelligence

**Originating concept:** Timothy Anderson · OC Labs · 10 October 2026  
**Publication:** [Cognitive Flow Intelligence: A Framework for Human-Aligned Artificial Intelligence](WHITEPAPER.md)

## What this is

A **reproducible early-stage test harness**, not a trained AI model or evidence that the framework is already effective. It has two parts:

1. An inspectable, deliberately simple mode/correction state controller to verify basic behaviour, such as not losing context after a user correction.
2. A **blinded paired-response evaluation** that gives an ordinary model and a CFI-prompted version of the **same model the identical conversation**. A human assesses responses before opening the condition key.

The controller's rules are intentionally basic; good results on smoke tests do **not** prove understanding or human efficiency gains. Actual efficacy requires real model responses, user-based evaluation, and independent replication.

## Run locally (Python 3.10+, no dependencies, no API key)

```bash
python -m unittest discover -p 'test_cfi.py' -v
python cfi_pilot.py demo
python cfi_pilot.py make-packets
```

The last command creates `cfi_trial_outputs/BLINDED_PROMPTS.json`, `cfi_trial_outputs/PRIVATE_CONDITION_KEY.json`, and `cfi_trial_outputs/RATINGS_TEMPLATE.csv`.

## Test a real model

1. Choose one base model and keep it constant for all responses. Use **fresh conversations** for each prompt. Paste the exact `prompt` for each response ID into that model, without making other changes. Model execution is manual by default, avoiding unrequested API expense.
2. Give generated responses to a rater who does **not** see `PRIVATE_CONDITION_KEY.json`. Do not tell the rater which variant is expected to do better.
3. Record for each response the masked ID and scores in the CSV. Scores: **0–4** for outcome quality (4 excellent), flow fidelity (4 excellent), and over-inference (4 excessive; lower is better). For `repair_turns`, count subsequent turns needed to correct intent—not just the length of the original response. A single reply is insufficient to measure this reliably; use continuations for this measure, or mark it missing and do not calculate it. Record actual wall-clock response duration separately if measured reliably.
4. Only after scoring, inspect the private key. Use:

```bash
python cfi_pilot.py summarize
```

**Important limitation:** The demo dataset contains eight *synthetic* scenarios created to exercise the design principles. It is a development benchmark, **not** an independent scientific sample. A rigorous study requires authentic consenting user interactions, properly blinded rating, balanced task selection, and pre-registered outcome criteria.

## How to score fairly

Treat **factual accuracy and user autonomy as gating criteria**. A smooth but inaccurate or overly agreeable answer should not be counted as success. During genuine live tests, capture corrected turns and any task failure. Avoid publishing private user conversations or personally identifying details without consent.

**Primary practical target:** fewer *avoidable* correction and restatement turns, without lowering outcome quality or increasing over-inference. Response time is a secondary metric, not the objective by itself.

## Current result

**Infrastructure smoke tests: available. Model A/B results: not yet collected.** Do not cite synthetic test pass rates as evidence of superior conversational performance.

## Project layout

- `WHITEPAPER.md` — published concept paper.
- `cfi_pilot.py` — transparent controller and A/B packet / scoring tools.
- `benchmark_cases.json` — synthetic benchmark cases.
- `test_cfi.py` — offline unit/smoke tests.
- `README.md` — this guide.

## Licensing and attribution

Concept attributed to **Timothy Anderson, OC Labs**. Research drafting and prototype programming assistance: OpenAI ChatGPT. Copyright © 2026 Timothy Anderson. The published material does not assert exclusive ownership of the terms or of established research areas. No license is granted unless separately specified.