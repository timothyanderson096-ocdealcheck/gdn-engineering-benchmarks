# GDN Bracket — Public Haltech Log Experiment

**Date:** 2026-08-23  
**Status:** First-pass complete; suitable for portability/triage benchmark, not a race-performance benchmark

## Objective

Test whether the same GDN bracketing approach used on the public BMW/MHD N55 log transfers to a substantially different ECU/logging ecosystem without forcing the previous diagnosis onto the new data.

Core question:

> Can GDN reduce a large Haltech channel set to the few signals that explain the event, correctly classify what kind of event was recorded, and refuse unsupported performance conclusions?

## Source

Public example log from the open-source `ClassicMiniDIY/UltraLog` project:

- `exampleLogs/haltech/2025-07-18_0215pm_Log1118.csv`
- Haltech NSP DataLogVersion 1.1
- Public source file size: approximately 339 kB
- Log number: 1118

The source log defines **114 channels** before the timestamped data rows.

UltraLog's Haltech parser converts the raw Haltech values by channel type. Relevant conversion examples used here:

- EngineSpeed: raw RPM
- Percentage: raw / 10
- Pressure: raw / 10 - 101.3 kPa (gauge)
- AFR: raw / 1000 (lambda)
- Angle: raw / 10 degrees
- Temperature: raw / 10 Kelvin, then converted to Celsius for this report
- Speed: raw / 10 km/h

## Initial classification

This dataset is **not a road pull and not a boosted WOT run**.

Evidence:

- Vehicle speed remains 0 km/h through the examined transient.
- Boost target is 0 kPa gauge.
- Manifold pressure remains below atmospheric through the sampled event.
- RPM rises from roughly 1,400 rpm to approximately 3,166 rpm and then falls.
- Accelerator/throttle activity indicates a stationary free-rev / throttle-blip transient.

This classification is itself part of the benchmark: GDN should not treat every ECU log as a tuning pull simply because boost, lambda and knock channels exist.

## Bracketing result

The 114-channel dataset can be reduced to a small primary set for this recorded event:

### Tier 1 — Event definition

1. RPM
2. Drive By Wire Accelerator Pedal Position
3. Throttle Position
4. Engine Demand
5. Vehicle Speed

These establish that the car is stationary and that the event is a throttle transient rather than a loaded acceleration run.

### Tier 2 — Air/load response

6. Manifold Pressure
7. Measured Manifold Pressure
8. Drive By Wire Throttle 1 Target Position

These show the pressure/throttle response to the blip and confirm no positive-boost event is present.

### Tier 3 — Fuel/mixture response

9. Fuel Pressure
10. Fuel Pressure Expected
11. Wideband O2 1 / Wideband O2 Overall
12. Target Lambda
13. Injection Stage 1 Outputs Highest Duty Cycle

These are the most useful channels for judging whether the transient is accompanied by an abnormal fuel-supply or mixture response.

### Tier 4 — combustion/safety checks

14. Knock Control Bank 1 Ignition Correction
15. Knock Sensor 1 Knock Level / Knock Count
16. Engine Limiting Function / Engine Protection Severity Level
17. Trigger System Errors

These provide falsification checks before attributing a transient to knock, protection, trigger faults or a limiter event.

For this event, most remaining channels are secondary context or irrelevant to the immediate decision.

## Evidence snapshots

### 14:15:50.300

Approximate converted values:

- RPM: 1,758
- Accelerator pedal: 34.7%
- Throttle position: 19.0%
- Engine demand: 15.0%
- Manifold pressure: -22.4 kPa gauge
- Fuel pressure: ~335 kPa gauge
- Expected fuel pressure: ~288 kPa gauge
- Wideband O2 1: lambda ~0.420
- Target lambda: ~0.947
- Knock ignition correction: 0 degrees
- Vehicle speed: 0 km/h

The very rich transient reading is real in the logged O2 channels, but it should not be interpreted as steady-state mixture quality because this is a rapidly changing unloaded throttle event.

### 14:15:50.500

- RPM: 2,321
- Accelerator pedal: 47.2%
- Throttle position: 36.8%
- Engine demand: 32.0%
- Manifold pressure: -7.8 kPa gauge
- Fuel pressure: ~343 kPa gauge
- Expected fuel pressure: ~302 kPa gauge
- Wideband O2 1: lambda ~0.973
- Target lambda: ~0.930
- Knock ignition correction: 0 degrees
- Vehicle speed: 0 km/h

The lambda signal has moved back close to target while fuel pressure remains above the expected-pressure channel.

### 14:15:50.700

- RPM: 3,166
- Accelerator pedal: 2.2%
- Throttle position: 8.6%
- Engine demand: 0.5%
- Manifold pressure: -56.2 kPa gauge
- Fuel pressure: ~292 kPa gauge
- Expected fuel pressure: ~267 kPa gauge
- Wideband O2 1: lambda ~0.879
- Target lambda: ~0.992
- Knock ignition correction: 0 degrees
- Vehicle speed: 0 km/h

By this point the pedal has been released while engine speed is still high, confirming the event has moved into the overrun/deceleration portion of the free-rev.

## Findings

### F1 — The correct first decision is classification, not diagnosis

The dataset contains boost, knock, fuel, lambda and other performance channels, but the logged event is stationary and unloaded. A system that immediately reports "boost problem," "fuel pump problem" or "knock" would be over-reading the data.

**GDN bracket:** classify the event first; only then select decision-relevant channels.

### F2 — No evidence of the N55 fuel-pressure pattern

Unlike the previous public BMW/MHD experiment, the sampled Haltech event does not show fuel pressure falling below the expected-pressure channel. Actual fuel pressure is above expected in the examined transient.

This is useful portability evidence: the process did **not** simply repeat the previous diagnosis.

### F3 — No logged knock-control intervention in the sampled transient

Knock ignition correction remains at 0 degrees in the examined snapshots. No conclusion should be made about the engine's full knock behaviour outside this small log, but there is no evidence here for making knock the primary explanation of the event.

### F4 — The most interesting signal is transient mixture behaviour, not boost

The log shows a brief very-rich lambda response during throttle opening, followed by movement back toward target as RPM rises. Because the engine is unloaded and the event is transient, this should be treated as a candidate for transient-fuelling analysis rather than a steady-state AFR verdict.

### F5 — GDN can reject a low-value dataset for a requested purpose

This small Haltech log is useful for demonstrating format portability and bracketing, but it is **not** a strong motorsport-performance case because:

- vehicle speed is zero,
- there is no loaded acceleration section,
- no positive boost target is present,
- only a brief free-rev transient is captured.

That negative result is important. A verification system should identify when the available evidence is insufficient for the requested conclusion instead of manufacturing a dramatic answer.

## Compression achieved

**Raw:** 114 logged channels  
**Primary bracket for this event:** approximately 15–17 channels  
**Dominant decision:** classify as stationary throttle transient; investigate transient fuelling only if that is the intended question

Approximate decision-space reduction: **~85% of channels can be deprioritised for the immediate event classification/first-pass analysis.**

This percentage is a channel-prioritisation measure, not a claim that the other channels are globally unnecessary.

## Portability outcome

**Conditional PASS.**

The bracketing method transferred from MHD/BMW to Haltech without assuming the same fault pattern. It identified a different event type, selected a different evidence hierarchy, and correctly limited the strength of the conclusion.

This supports the working GDN Bracket proposition:

> **Reduce the decision space. Preserve the evidence. Reach the engineering decision faster.**

## Next test

The next Haltech test should use the much larger public file:

`exampleLogs/haltech/2025-03-06_0937pm_Logs658to874.csv`

That file is approximately 88 MB and contains many log segments. The objective should be to locate a genuinely loaded/high-RPM event, extract only that segment, and repeat the same blind bracket. That will be a stronger motorsport/tuning benchmark than the stationary Log1118 sample.

## Safety / interpretation boundary

This experiment is retrospective data analysis only. It does not recommend ECU calibration changes, ignition changes, boost changes or fueling changes. Any vehicle calibration decision requires appropriate instrumentation, vehicle context and a qualified tuner/engineer.
