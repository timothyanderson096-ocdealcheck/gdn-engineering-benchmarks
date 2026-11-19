# Regenerative braking limits in SUMO's Energy model

This patch is proposed for [Eclipse SUMO #9576](https://github.com/eclipse-sumo/sumo/issues/9576). It applies the existing optional motor power and torque parameters to the standard Energy model before conversion losses and auxiliary loads. It accounts for the point within a simulation step where the motor reaches its power limit. Setting either limit to zero disables recovery. The unrestricted calculation is preserved for vehicles that specify neither limit.

## Review and reproduce

[Download the patch](regen-limits.patch). It contains the C++ change, the user documentation and a registered regression test. It applies to upstream `bf0f3b39d43d24a7728d8b719fbdd7c8a28d20fb`. Its SHA-256 is `b84913306c030c086c6a2d3ff36c51615e0b2cb79249c96f4e4fa773cc51c5b2`.

An idealized 1,800 kg EV with 50 kW of regenerative braking capacity stops from 24 m/s (86.4 km/h). In the three-second hard stop the stock model recovered all 144 Wh of kinetic energy. The patched model recovered 38.652585 Wh, matching independent integration at 1, 0.5 and 0.25 second simulation steps. A gentle 24-second stop recovered 144 Wh in both builds. These are controlled simulation results.

All four driving-cycle regressions and 25 existing battery-device regressions passed. The added driving-cycle case fails against the unmodified source and checks 63 energy values. A separate 17-case mechanical-work comparison passed with the patch.

After applying the patch to the upstream checkout and rebuilding the native SUMO tools, run the following. The step-length check uses SUMO's Python TraCI tools from the checkout. [Recorded replay results](step_lengths.csv)

```sh
python check_stops.py /path/to/emissionsDrivingCycle results.json --require-all
python check_step_lengths.py /path/to/sumo-checkout /path/to/sumo > replay.csv
diff -u step_lengths.csv replay.csv
```

OpenAI Codex assisted with developing and verifying this contribution.

Timothy Anderson · Spotted Ridge Engineering / OC Labs  
GDN (Global Decision Network) · timothyanderson096@gmail.com
