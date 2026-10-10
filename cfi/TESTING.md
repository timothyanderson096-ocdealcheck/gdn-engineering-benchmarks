# CFI v0.1 — public comparison protocol

## Goal

Compare baseline AI interaction with a CFI-style interaction policy on **the same nonlinear tasks**. We are testing usability and task outcomes, not asserting that a text prompt changes model weights or trains an AI.

## Recommended setup

1. Choose 5–20 original tasks with a realistic user goal and at least two later updates that affect priorities, order, or constraints. Do not use private or sensitive information.
2. Use the **same model version, tools, temperature (where configurable), and task material** for both conditions. Start each run in a fresh conversation.
3. **Baseline:** default assistant instruction, no CFI-specific overlay. **Experimental:** same configuration plus the starter CFI instruction in README.md.
4. Feed each condition the same sequence of user messages, including the twists. If comparing interactive sessions rather than fixed scripts, record that they are less controlled.
5. Randomise which condition is evaluated first where practical. Blind the evaluator to condition if possible.
6. Record every clarification, correction, mistaken assumption, final outcome, and any relevant elapsed time or turn counts. Score results against criteria set before running the tasks.
7. Share anonymised transcripts or enough detail to reproduce the test. Report negative results as well as positive ones.

## Sample task script

**Turn 1:** “I'm planning a small workshop website. I might need a booking system, but I'd rather start simple. Help me think through launch steps.”  
**Turn 2:** “Actually, no appointments yet. The first version should only explain services and collect enquiries. I've already bought the domain.”  
**Turn 3:** “One more thing: mobile visitors are the priority, and I only have this weekend to build it. Reorder the plan accordingly.”  
**Turn 4:** “What assumptions did you change, what remains uncertain, and what should I do first?”

Assess whether the AI updates the sequence, preserves the launch goal, drops unneeded booking work, and flags uncertainty without inventing requirements.

## Suggested measures

| Metric | How to count | Desired direction |
|---|---|---|
| User correction turns | Turns required to fix a misunderstanding of existing supplied context | Lower |
| Unnecessary clarifications | Questions already answered or immaterial to the next safe step | Lower |
| Task success | Predefined rubric met at end of transcript | Higher |
| Intent preservation | Does output still reflect user's latest actual goal? (0–2 rubric) | Higher |
| Incorrect assumptions | Material unsupported claims about user goal/constraints | Lower or equal |
| Total turns / elapsed time | Measure separately, note differences in user input and tool latency | Lower with equal quality |
| Transparency | Major order changes and their rationale legible? (0–2 rubric) | Higher |

**Intent rubric:** 0 = materially off-target; 1 = partly correct; 2 = faithful to latest specified goal.  
**Transparency rubric:** 0 = unexplained changes; 1 = some changes flagged; 2 = significant revisions explained concisely.

Do not compare different model versions and then attribute the difference to CFI. One sample is not evidence of general improvement. Keep the full denominator; don't report only successes.

## Issue reporting template

**Title:** `[CFI Test] <short description>`

- Date and model/version:
- Baseline setup:
- CFI setup (paste exact instruction or link version):
- Task and predefined success criteria:
- Number of runs per condition:
- Results (all metrics, including failures):
- What changed in interpretation or sequence:
- Misunderstandings / unintended behavior:
- Anonymised transcript or reproduction steps:
- Limitations and potential confounders:
- Would you recommend changing CFI? How?

Please do not post passwords, private account details, health details, or someone else's private conversations.

## Next steps

Once reports accumulate: standardise the task set, recruit independent reviewers, publish aggregate counts alongside uncertainty and failures, and test whether any benefit remains after controlling for prompt length and baseline instruction quality. Longer-term claims about human learning require repeated assessments over time.
