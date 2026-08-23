# GDN Bracket — Public BMW N55 MHD Log

Date: 2026-08-23
Status: Preliminary public-data experiment

## Objective
Test whether GDN-style bracketing can reduce a raw ECU datalog into a smaller, evidence-backed engineering decision set without tune-file access or prior knowledge of the final diagnosis.

## Source
Public MHD N55 CSV published in the open-source UltraLog repository:
`ClassicMiniDIY/UltraLog/exampleLogs/mhd/mhd-n55-pull.csv`

Metadata in source:
- ECU PRGID: 7616431
- VIN: redacted
- Map field: `MHD 5.26 IJE0S ST2V7.bin`

The source log contains 31+ channels including boost actual/target, load actual/requested, low-side and rail fuel pressure, six cylinder timing-correction channels, lambda/AFR, throttle, torque, RPM, IAT, coolant and wastegate duty-cycle data.

## Bracketed event
The useful high-load event begins at roughly 552.6 s / 1,573 rpm in 3rd gear and continues to roughly 561.9 s / 6,536 rpm before pedal lift.

Rather than treating every channel as equally important, the event can be reduced into seven decision groups:

1. Driver demand / operating state — RPM, accelerator position, gear
2. Boost control — boost actual, boost target, WGDC
3. Load / throttle control — requested load, actual load, throttle position
4. Fuel supply — low-pressure fuel, rail pressure
5. Combustion quality — per-cylinder timing corrections
6. Mixture — lambda/AFR and short-term trim
7. Thermal context — IAT and coolant

## Preliminary findings

### Finding 1 — Low-side fuel pressure becomes the highest-priority anomaly
BMW technical material describes the low-pressure system feeding the high-pressure pump at about 5 bar on the related N5x architecture. During the high-load portion of this log, the low-pressure channel falls from roughly 5 bar into the low-3-bar range, including a recorded minimum of about 2.99 bar around 5,149 rpm. It then remains frequently around 3.3–3.8 bar through much of the upper-rpm pull.

The high-pressure rail does not collapse at the same point; it remains roughly in the 140–169 bar range over much of the upper-rpm section. Therefore the evidence supports: **low-side delivery is under more stress than the high-pressure rail response, and it should be investigated before chasing smaller signals.**

This is not a component-failure diagnosis. The source data alone does not prove whether the cause is pump capacity, fuel type, sensor behaviour, calibration or another factor.

### Finding 2 — A real throttle-closure event can be isolated
At full accelerator demand (99.6%), throttle position is approximately 81% through most of the pull. Around 5,256–5,394 rpm it drops sharply: approximately 76% → 38% → 39%, before returning toward ~78–81%.

At the onset of that event, boost actual is briefly above boost target by roughly 0.10 bar (about 1.21 bar actual vs 1.11 bar target around 5,256 rpm), while the logged `Torque Lim. active` channel remains 0.

This brackets the likely explanation away from a simple logged torque-limiter activation and toward boost/load control behaviour. Public N55 tuning documentation also identifies boost/load overshoot as a common cause of throttle closure.

### Finding 3 — Timing corrections are distributed, not isolated to one cylinder
The pull contains roughly -3° class corrections appearing on several different cylinders at different RPM points:
- Cylinder 2 around ~2,000–2,800 rpm
- Cylinder 3 around ~2,500–2,700 rpm and later upper-rpm activity
- Cylinder 4 around ~3,600 rpm onward
- Cylinder 5 around ~4,100 rpm onward
- Cylinder 6 around ~5,100 rpm onward

The pattern is therefore not a clean single-cylinder anomaly. Public N55 tuning guidance says small corrections can occur as part of normal control, but repeated/distributed corrections across multiple cylinders deserve attention. The throttle-control event overlaps part of the later correction activity, so the log does not justify treating every correction as independent knock evidence.

### Finding 4 — Boost tracking is broadly competent after spool
The target rises rapidly toward ~1.38 bar while actual boost lags during spool, then closes the gap through the midrange. Around ~3,964 rpm, actual boost is about 1.325 bar against a 1.376 bar target. Later the two remain relatively close as target tapers.

The notable event is therefore not a general inability to make boost. The more decision-relevant issue is the control transition/overshoot and throttle closure in the upper-midrange.

### Finding 5 — Several channels contribute little to this specific decision
For this one pull:
- `Torque Lim. active` is useful mainly as a negative invariant (it stays 0), not as a continuously inspected signal.
- Ambient pressure changes negligibly.
- Coolant temperature changes slowly and does not explain the transient event.
- Some lambda/STFT channels show behaviour that may reflect channel semantics, sensor location or fuel-cut logic rather than a clean independent mixture signal; they should not be promoted above fuel-pressure, boost/load and throttle evidence without additional context.

## Preliminary bracket

Raw: 31+ channels

Primary decision set for this event:
1. RPM
2. Accelerator position
3. Boost actual
4. Boost target
5. Throttle position
6. Load actual
7. Load requested
8. Low-pressure fuel pressure
9. Rail pressure
10. Per-cylinder timing corrections (treated as one evidence group)
11. WGDC final / after PID

Supporting context:
- IAT
- coolant
- lambda/AFR
- STFT
- torque actual

Low-value for continuous inspection in this event:
- ambient pressure
- active torque-limiter flag after it is established as consistently zero
- duplicated/semantically uncertain channels until their exact meaning is resolved

## GDN value demonstrated
The experiment does not attempt to tune the ECU. It tests whether a large log can be converted into a smaller engineering decision tree.

The current bracket is:

**Raw log → high-load event → fuel-supply stress + throttle-control event + distributed timing corrections → rank fuel-pressure and boost/load-control evidence ahead of lower-value channels.**

That is the motorsport/automotive GDN proposition in concrete form:

**Reduce the decision space. Preserve the evidence. Reach the engineering decision faster.**

## Verification limits / next step
This is a preliminary retrospective analysis and must not be represented as a tuner-validated diagnosis. The next verification step is to:
1. run the same bracketing method on a second public ECU format (Haltech, ECUMaster, MegaSquirt or RomRaider), and
2. seek an independent tuner/engineer review of the N55 findings without revealing the GDN conclusions first.

If both converge, the result becomes a substantially stronger external benchmark.
