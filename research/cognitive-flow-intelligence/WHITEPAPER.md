# Cognitive Flow Intelligence (CFI)
## A Framework for Human-Aligned Artificial Intelligence

**Conceptual research paper — Version 1.0**

| | |
|---|---|
| **Originating concept** | **Timothy Anderson** |
| **Affiliation** | **OC Labs, Australia** |
| **Concept date** | **10 October 2026** |
| **Initial public publication** | **10 October 2026** |
| **Status** | Proposed framework; open for critique and experimental testing |
| **Evidence level** | Conceptual hypothesis, not an experimentally demonstrated improvement |

> **Core principle:** Humans should not have to reorganize their natural thinking merely to make artificial intelligence useful. Artificial intelligence should adapt to how humans develop, connect, question, and communicate ideas—without claiming to know thoughts it has not been told.

## Abstract

Modern artificial intelligence (AI) development often prioritizes model capability, computational throughput, benchmark scores, and response latency. Yet faster or more capable responses do not necessarily make an AI system a more effective partner for human thinking. A system may accurately answer the literal words of a prompt while misunderstanding why the person said them: a hypothesis may be mistaken for a request for advice, a narrative for a fact-checking assignment, or a nonlinear association for an irrelevant digression. Correcting these mismatches can require repeated explanations and interrupt the person's developing line of thought.

**Cognitive Flow Intelligence (CFI)** is proposed as a *human-aligned interaction framework* for AI that aims to follow the progression of human intent across turns. It emphasizes conversational mode recognition, continuity of goals and hypotheses, sensitivity to associative and nonlinear reasoning, selective intervention, and the reduction of unnecessary conversational repair. Its primary performance target is not simply how rapidly a machine produces a response but **how efficiently and accurately the human–AI partnership advances toward a meaningful outcome**.

This paper defines the proposal, distinguishes it from existing research, outlines an implementable architecture, proposes operational measurements and falsifiable hypotheses, and presents an initial controlled evaluation design. It does not claim that CFI has been implemented or validated, that the underlying research areas are new, or that the term is legally exclusive.

**Keywords:** Cognitive Flow Intelligence; CFI; human–AI collaboration; conversational grounding; cognitive friction; contextual continuity; intent recognition; associative reasoning; mixed-initiative interaction.

## 1. Introduction: a missing dimension of AI performance

A person may begin a conversation without having fully formulated the question. The purpose of discussion can be to discover the question itself.

A conventional assistant may attempt to resolve each sentence as an isolated query. If a person describes a real-world conversation to explore broader incentives or behavioural patterns, the system might instead respond with procedural details. Those details can be correct and still miss the intended conversational trajectory.

The person must then interrupt the original thinking process to say what they *did not* mean. The machine may be fast, but the collaboration becomes slow.

The originating insight behind CFI is that **the meaningful unit of human–AI interaction is often the evolving thought process, not the individual prompt**.

CFI therefore asks a different performance question:

> How much human explanation, correction, and interpretation does it take to reach useful shared understanding and a sound result?

This question is complementary to, not a replacement for, model accuracy, reasoning ability, safety, or computational efficiency.

## 2. Origin and philosophical motivation

The proposal was articulated by Timothy Anderson of OC Labs in a discussion on **10 October 2026**, initially using the working term *Cognitive Artificial Intelligence*. Because that terminology already appears in earlier academic literature, the name was refined to **Cognitive Flow Intelligence (CFI)**.

The underlying observation was drawn from lived changes in communication methods: handwriting, printing, typing, mobile-device input, networked communication, and conversational AI have each changed the physical and cognitive effort required to express an idea. The development is not a strictly linear historical sequence, but it illustrates a useful distinction between **language, communication medium, and mutual understanding**.

CFI extends that distinction: AI should become better at following an unfolding human intention rather than obliging users to translate incomplete, associative or exploratory thought into perfectly specified machine instructions.

In this formulation, *flow* does not imply that a machine has direct access to a person's mind. It refers to the observable progression of conversational goals, examples, associations, questions, corrections, and decisions.

## 3. Definition and scope

**Proposed definition:** *Cognitive Flow Intelligence is an interaction framework for artificial intelligence that maintains and revises an evidence-grounded understanding of the user's developing conversational intent, supports nonlinear and associative reasoning, and selects interventions that minimize avoidable human cognitive effort while preserving accuracy, uncertainty, safety, and user agency.*

CFI is not proposed as:

- a synonym for artificial general intelligence or artificial superintelligence;
- proof of machine consciousness or independent cognitive experience;
- a requirement to infer personal or psychological traits;
- a promise that every response will anticipate the user's unspoken goals;
- a mandate to suppress disagreement or relevant corrections;
- an established new foundation-model architecture.

Initially, CFI could be developed as a **context-and-intervention layer** over an existing AI model. Whether model training or new architectures provide further advantages is an open experimental question.

## 4. The central performance hypothesis

AI response speed is only one part of the human experience. A model may take fewer seconds to answer while requiring more conversational turns to recover from a misunderstanding. Conversely, a somewhat slower, context-aware response may reach the user's actual goal sooner.

For a given task, let:

- **T_machine** be accumulated system processing and response time;
- **T_read** be human time spent reading or listening;
- **T_repair** be time spent correcting misinterpretations or restating already available context;
- **T_deliberation** be necessary human reasoning and decision time.

We propose assessing overall **time to validated useful outcome** as an observed end-to-end measurement rather than using response speed alone. These components may be reported separately to investigate where effort is spent.

The core hypothesis is:

> A human-aligned context-and-intervention system can lower avoidable repair effort and improve time to a *validated* outcome, even when raw model speed remains unchanged.

The word **validated** matters. Shorter interactions are not inherently better. A model that agrees with every assertion or skips relevant checks may appear efficient while making decisions worse.

## 5. CFI design commitments

### 5.1 Recognise conversational mode

Estimate whether the person is exploring, speculating, narrating, questioning, deciding, instructing, seeking emotional support, or combining several of these. The estimate remains tentative and revisable.

A hypothesis raised for discussion should not automatically be treated as a request for technical advice or as a factual claim requiring interruption.

### 5.2 Maintain continuity across turns

Preserve authorized, task-relevant goals, active questions, constraints, assumptions, and previous corrections. Separate what the user explicitly confirmed from the assistant's own uncertain interpretations.

When long-term memory is used, it should be transparent, correctable, and privacy-aware.

### 5.3 Follow associative and nonlinear reasoning

A human may move between examples, life experiences, analogies, and technical questions before revealing their intended connection. CFI should consider that a topic shift may be meaningful without inventing a false connection.

The system should recognize when a story is functioning as evidence, analogy, context, or an unfinished thought.

### 5.4 Intervene at the right moment

Useful interventions include contributing evidence, asking a narrowly targeted question, identifying an inconsistency, proposing a connection, summarizing an emerging hypothesis, or withholding unnecessary commentary.

The most technically detailed reply is not always the best reply. The appropriate intervention depends on intent, stakes, uncertainty, and expected conversational cost.

### 5.5 Learn from correction

When the person says “That isn't what I'm asking,” “I'm speaking generally,” or “Follow where I'm going,” the system should update its interpretation instead of reverting to its original frame.

Corrections are important interaction data, but the system should never claim to know what the person *really* thinks beyond available evidence.

### 5.6 Preserve truthfulness and human control

CFI must remain able to say that a claim is unverified, challenge unsafe assumptions, or request consent for consequential action. Human alignment is not obedience, flattery, or premature agreement.

## 6. Reference architecture

A minimal prototype can be designed as seven components:

| Component | Function | Key safeguard |
|---|---|---|
| **Conversation-mode estimator** | Proposes whether the user is exploring, instructing, deciding, etc. | Multiple candidate modes; confidence calibration |
| **Intent hypothesis tracker** | Tracks possible user goals and how evidence changes them | Explicitly distinguishes inference from confirmed intent |
| **Context continuity record** | Preserves active goals, constraints, and corrections | Consent, retention controls, user editability |
| **Associative bridge** | Detects possible links between examples and topics | Avoids forcing speculative links |
| **Intervention policy** | Chooses between reply, question, evidence, challenge, and deferral | Sensitivity to risk and interruption cost |
| **Outcome and friction monitor** | Records correction burden and progress toward task criteria | No optimization for superficial brevity |
| **Human oversight and safety layer** | Protects factual integrity, privacy, and action boundaries | Explicit authorization for consequential actions |

### High-level interaction cycle

1. **Observe:** Receive the present message and any authorized relevant history.
2. **Interpret:** Identify the apparent conversational mode and several plausible intents.
3. **Relate:** Update explicit goals, unresolved hypotheses, prior corrections, and possible associations.
4. **Select:** Weigh the value of answering, challenging, exploring, asking, or temporarily refraining from interruption.
5. **Respond:** Distinguish facts from hypotheses, contribute in the appropriate mode, and avoid unnecessary detours.
6. **Revise:** Incorporate subsequent correction; update or discard unsupported assumptions.

This cycle is a **proposed engineering pattern**, not an assertion that any current model already implements it.

## 7. Illustrative failure and recovery

Consider a person who says they were speaking with a small-business owner about ways of managing tax-payment cash flow. They then hypothesize that a policy change might alter how businesses finance payments.

A system focused only on literal questions may immediately explain credit-card terms, borrowing rates, and tax rules. That information might be accurate but may not advance the person's intended investigation of incentives and behaviour.

A more flow-sensitive system could respond:

> “It sounds like you're exploring whether changing the available payment options alters business owners' behaviour, rather than asking me to recommend a credit card. We can test the incentive hypothesis separately from claims about the government's intention.”

This would still leave room for fact-checking the financial details, where necessary. Its advantage would be **better identification of the conversational task before optimizing the answer**.

This example is illustrative only. It is not evidence of CFI effectiveness.

## 8. Operational measurements

CFI should be assessed by independent measurements, not a claim that the conversation *felt* more natural.

Suggested measures:

1. **Repair turns (N_repair):** Number of turns primarily used to correct an assistant's misunderstanding of previously available context or intent.
2. **Re-explanation time (T_repair):** Participant time spent on those corrections.
3. **Context restatement rate:** Frequency of repeating material the system should already have tracked.
4. **Time to validated outcome (T_valid):** End-to-end task completion time, including both human and machine contributions.
5. **Outcome quality (Q_valid):** Independently scored correctness, completeness, and practical value.
6. **Perceived cognitive workload:** Measured with an established workload instrument where appropriate.
7. **Over-inference and interruption rate:** Unsupported assumptions about intention, missed safety-critical corrections, or disruptive interventions.
8. **User agency:** Whether the person could correct assumptions, refuse suggestions, and control consequential actions.

An exploratory descriptive quantity is **repair burden**:

\`Repair burden = T_repair / T_valid\`, for sessions with T_valid > 0.

A lower number is not sufficient proof of improvement. It must be evaluated alongside quality, uncertainty calibration, safety, and long-term outcomes.

These suggested measures require definitions, annotation reliability tests, and validation before being treated as established scientific instruments.

## 9. Falsifiable research hypotheses

- **H1 — Fewer corrections.** Given an identical underlying model and comparable resources, a CFI interaction configuration will reduce repair turns and repeated-context explanations relative to baseline.
- **H2 — Better human efficiency.** CFI will reduce time to a validated outcome and/or measured cognitive workload without decreasing outcome quality.
- **H3 — Better flow preservation.** On exploratory and associative reasoning tasks, blinded evaluators will judge CFI as more faithful to developing user intent.
- **H4 — No increase in unsafe inference.** CFI will not increase unsupported psychological assumptions, factual errors, false certainty, or unauthorized actions.
- **H5 — Context specificity.** Gains, if any, will vary by task type; CFI may offer less advantage for one-turn factual questions than for long, exploratory conversations.

Failure to meet these conditions would narrow or disconfirm the practical claims. In particular, an apparently “better” conversation achieved by flattering the participant or omitting essential challenges would not count as a successful test.

## 10. Proposed experimental pilot

### Study conditions

Use the **same base language model** and matched access to retrieval and tools, with three interaction configurations:

**A — Baseline:** Standard dialogue without specialized flow tracking.

**B — Continuity:** Baseline plus a concise, editable representation of explicit goals, constraints, and previous corrections.

**C — Cognitive Flow Intelligence:** Continuity plus mode estimation, candidate-intent revision, associative bridging, and an intervention policy intended to minimize avoidable repair.

### Tasks

Use a mixed benchmark of:

- exploratory discussions in which the participant discovers their objective while talking;
- multi-stage problem solving with nonlinear topic changes;
- interrupted work resumption requiring context reconstruction;
- consequential decision tasks where the system must challenge weak assumptions;
- simple factual questions as a check against unnecessary overhead.

### Participants and methods

An **initial planning target** could be roughly 60 consenting adult participants, with the final sample size determined through pilot variance estimates and power calculations. This number is not a statistically validated sample size.

Randomize or counterbalance participant exposure to conditions, account for learning and order effects, and establish objective task-success criteria wherever possible. Use blinded raters to evaluate conversation repairs and final results. Include inter-rater reliability, predefined safety-event reporting, and a data minimization policy.

### Evaluation

Specify primary outcomes before confirmatory data collection; compare repair burden and time to valid outcome, report effect sizes and confidence intervals, and analyze quality and safety as co-primary constraints or protected outcomes.

A meaningful positive result would require **less avoidable human effort at equal or better task validity**, not merely faster or more agreeable responses.

### Open reproducibility

Publish the benchmark protocol, de-identified sample dialogues where consent permits, annotation rubric, analysis methods, negative results, and reproducible software once implemented. Independent replication is encouraged.

No human-subjects experiment has yet been conducted for this publication.

## 11. Limitations and research risks

The proposal currently has several significant limitations.

**Prior art:** Conversational grounding, mixed-initiative systems, user modelling, theory-of-mind-inspired AI, context memory, and human–AI teaming are established research areas. CFI has not been demonstrated to introduce an unprecedented algorithm or architecture. Its claimed contribution is a **specific integration, operational emphasis, and test agenda**, subject to further systematic review.

**Name and exclusivity:** A preliminary web search did not surface a prominent exact-match academic framework named “Cognitive Flow Intelligence,” but that does **not** prove that the name is unique, free from trademark conflicts, or available for exclusive use.

**Mind-reading risk:** Inferring intent from text is fallible. The system must preserve ambiguity and never present speculation about a person's internal state as fact.

**Sycophancy risk:** Reducing corrections could reward systems that avoid challenging the user. Validated outcomes and dissent-sensitive scoring are necessary.

**Data governance:** Cross-turn continuity can introduce privacy and consent concerns. A prototype should favor minimal, inspectable, user-correctable context.

**Speed still matters:** Latency affects usability. CFI does not argue that speed is irrelevant, only that machine latency alone is an incomplete optimization target.

**Unproven value:** No pilot results, effect sizes, implementation benchmark, superiority finding, or superintelligence claim is asserted.

## 12. A practical development pathway

**Phase 1 — Public concept and critique:** Publish the present hypothesis, clarify terminology, and invite identification of stronger prior art or competing frameworks.

**Phase 2 — Benchmark construction:** Develop anonymized representative conversations and independent scoring criteria for intent, correction burden, outcome quality, and over-inference.

**Phase 3 — Prototype:** Implement Conditions A, B, and C using the same base model with transparent prompts, state tracking, and an intervention policy.

**Phase 4 — Pilot and revision:** Assess differences in validated outcomes, human effort, and failure cases; publish all positive and negative results.

**Phase 5 — Independent evaluation:** Release a refined specification and reproducible experimental package for external groups to test.

## 13. Conclusion

**Cognitive Flow Intelligence** proposes that improvement in human–AI collaboration requires attention to the *progression* of thought as well as the accuracy of individual answers. A system that follows developing intent, handles nonlinear associations, retains relevant context, and knows when to intervene could reduce avoidable human effort without necessarily requiring a faster underlying model.

The scientifically important question is not whether this sounds natural or appealing, but whether it can be demonstrated through controlled, independently assessable outcomes.

The proposal is offered as a clearly attributed, falsifiable research framework—**an invitation to test the idea, not a declaration of a solved problem**.

---

## Attribution, AI assistance, and publication rights

**Originating concept:** Timothy Anderson, OC Labs, Australia. The specific CFI formulation discussed here was developed from Anderson's observations about the mismatch between literal AI responses and the flow of human thought, with the concept discussion dated 10 October 2026.

**Writing assistance:** OpenAI ChatGPT assisted with research discovery, structure, prose drafting, and proposal formulation. This acknowledgement does not imply OpenAI sponsorship, endorsement, authorship, or scientific validation.

**Rights:** © 2026 Timothy Anderson. All rights reserved unless a later publication explicitly grants a license. The paper is publicly readable and invites scholarly critique and independently designed tests; it does not grant an exclusive legal right to a general idea or common terminology.

**Suggested citation:**

> Anderson, T. (2026). *Cognitive Flow Intelligence (CFI): A Framework for Human-Aligned Artificial Intelligence.* OC Labs. Conceptual research paper, v1.0. GitHub publication (cite a specific commit for an immutable version).

## References

[1] Clark, H. H., & Brennan, S. E. (1991). Grounding in communication. In *Perspectives on Socially Shared Cognition*. https://doi.org/10.1037/10096-006

[2] Horvitz, E. (1999). Principles of mixed-initiative user interfaces. *Proceedings of CHI '99*, 159–166. https://doi.org/10.1145/302979.303030

[3] Bundy, A., Chater, N., & Muggleton, S. (2023). Introduction to ‘Cognitive artificial intelligence’. *Philosophical Transactions of the Royal Society A*, 381, 20220051. https://doi.org/10.1098/rsta.2022.0051

[4] Vaccaro, M., Almaatouq, A., & Malone, T. W. (2024). When combinations of humans and AI are useful: A systematic review and meta-analysis. *Nature Human Behaviour*, 8, 2293–2303. https://doi.org/10.1038/s41562-024-02024-1
