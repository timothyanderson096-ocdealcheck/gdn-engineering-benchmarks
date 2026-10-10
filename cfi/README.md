# Cognitive Flow Intelligence (CFI) — public research pilot

**Status:** v0.1 proposal; open for critique and reproducible testing (10 October 2026)  
**Proposed by:** Timothy Anderson, OC Labs  
**Approach:** Refinement and integration of existing ideas in human–AI interaction, not a claim to have invented cognitive intelligence, dialogue-state tracking, or conversational AI.

## Purpose

People often brainstorm nonlinearly: ideas arrive out of order, priorities change, and late observations can overturn earlier assumptions. AI replies also require interpretation by the human. CFI proposes an interaction layer that continuously tracks a **provisional understanding** of the user's direction, dynamically reorganises relevant ideas, and gives feedback in a sequence the user can readily inspect and correct.

The point is **not to manipulate thought, enforce a fixed workflow, or replace human judgement**. It is to document where the conversation stands *now* and help both parties make progress.

## Principles

1. **Bidirectional sense-making:** both user input and AI output can change the shared understanding.
2. **Open-ended interpretation:** brainstorming remains open; avoid prematurely forcing a final plan.
3. **Continuous reassessment:** new inputs may reorder, combine, supersede, or reopen earlier steps.
4. **Intent preservation:** retain the user's stated objective; label hypotheses as hypotheses.
5. **Revisable sequencing:** show a useful current order, not a permanent or mandatory order.
6. **Transparent corrections:** explain important changes in the interpretation or sequence.
7. **User agency:** let users challenge the framing, change the goal, or opt out of structuring.
8. **Minimal friction:** clarify only when uncertainty materially changes safety or outcome.

## A possible interaction loop (not a rigid stage model)

- Receive a user turn, including edits, tangents, and late additions.
- Update a provisional record: current goal, new ideas, constraints, dependencies, uncertainties, decisions, and superseded assumptions.
- Check whether the user's objective has actually changed or only the path to it.
- Answer the user's immediate question and, where useful, offer a compact, *revisable* sequence with what changed.
- Let the human evaluate and revise the AI's interpretation.
- Repeat continuously.

The learning effect on users is a **hypothesis**, not an established result.

## Try it

See [TESTING.md](TESTING.md) for a comparison protocol, sample prompt, and reporting template. You can experiment without installing anything: use the same tasks with a baseline assistant and a CFI-instructed assistant, then record the results.

### Starter instruction for a CFI-style assistant

> Track the user's evolving objective throughout the conversation. Allow nonlinear brainstorming without prematurely imposing a fixed plan. Maintain a provisional understanding of goals, constraints, decisions, open questions, and dependencies. When new information arrives, reassess the whole relevant sequence, not just the last message. Provide answers to the immediate question, and organise information into a concise, revisable order when useful. Clearly identify major reinterpretations and assumptions; ask clarifying questions only when essential. Never silently change the user's goal or claim to know their thoughts. Keep the user in control.

This prompt is an experimental **approximation**, not a technical implementation or evidence of effectiveness.

## Research questions

- Does CFI reduce unnecessary clarification and user correction turns?
- Does it improve final task quality and preserve intent?
- Does it reduce the time or number of turns needed to reach an accepted plan?
- Can it avoid confidently inferring the wrong objective?
- Does regular use help users structure later tasks themselves? (Requires longitudinal study.)

## Submit your results

Open a GitHub issue in this repository with **[CFI Test]** in the title, using the template in [TESTING.md](TESTING.md). Include successful *and* unsuccessful runs. Remove personal, confidential, and identifying information from transcripts.

## Caveats

CFI is currently an **untested proposed framework** rather than a trained model, proven algorithm, released application, or independent scientific finding. Differences in model, settings, prompts, and evaluator can confound comparisons. No claims of novelty, ownership of general concepts, or performance advantage are made here.

Feedback and constructive criticism are welcome.
