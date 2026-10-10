# CFI pilot runbook — what a valid test looks like

**Originating concept:** Timothy Anderson, OC Labs, 10 October 2026.

## Two distinct tests

**A. Software smoke test.** Nine automated tests check the offline controller, prompt packaging, correction tracking, randomized trial packets, and score aggregation. Passing these tests is **not evidence that CFI has improved any actual AI conversation**.

**B. Human–AI interaction trial.** Give the **same AI model**, in fresh separate chats, precisely the same conversation history under two different instruction conditions: standard baseline and the proposed CFI interaction policy. Raters see **only the resulting replies**, not the instruction condition.

## Pilot procedure

1. Generate the sixteen trial packets from eight synthetic cases with the command: python cfi_pilot.py make-packets
2. Use one fixed model and version. Open a new conversation for each packet; copy its exact prompt. Do not select or edit outcomes.
3. Collect responses identified by response_id. A separate evaluator who cannot see PRIVATE_CONDITION_KEY.json scores the responses.
4. Record (0–4) outcome quality (higher is better), faithfulness to developing user intent (higher is better), and unsupported over-inference (lower is better).
5. **To measure repair turns**, continue each trial under a prewritten follow-up script and count explicit corrections or repeated context. Do not invent repair-turn measurements from an isolated response. Leave that column blank if no continuation is run.
6. Unblind only after scoring. Run: python cfi_pilot.py summarize
7. Report all tasks, failures and caveats. This is a development benchmark, not a statistically representative sample.

## In-chat observational trial

From a defined start point, use the following interaction contract for ten naturally occurring topics:

> Follow the development of my actual thought rather than addressing every sentence as an isolated literal request. Preserve earlier context across nonlinear jumps. Add evidence, challenge assumptions when it helps, and minimise unnecessary corrections and repeated explanations. Never claim certainty about hidden intentions or take consequential actions without authorization.

At the end of each topic record:
- explicit corrections because the assistant misunderstood the purpose;
- repeated explanations of already available context;
- whether the intended useful outcome was reached;
- inaccurate, overly agreeable, or unauthorized behaviour.

This is an **observational trial**, not a blinded comparison. It can generate hypotheses and failure examples but cannot alone prove CFI is superior to a baseline.

## Success criterion and safeguards

The system counts as promising only if it reduces avoidable conversational repair while preserving or improving factual quality and user control. More fluent but incorrect answers do not count as success. The data should be reproducible and stripped of identifying third-party details unless all participants consent.

## Current status — 10 October 2026

- Controller and harness smoke tests: **9/9 passed**.
- Actual model A/B response samples: **0/16 collected**.
- Demonstrated human-efficiency gain: **none yet**.

## Attribution

CFI concept and initial proposal: Timothy Anderson, OC Labs. Prototype programming and drafting assistance: OpenAI ChatGPT. The name and foundational research fields are not asserted to be exclusive intellectual property.
