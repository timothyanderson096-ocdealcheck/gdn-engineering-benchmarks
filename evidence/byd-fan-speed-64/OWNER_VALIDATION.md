# Owner validation — BYD fan-speed candidate

This is a request for voluntary testing by an owner on their own vehicle and account. Automated checks establish local routing and parameter serialization; they do not establish vehicle support.

## Development setup

Apply both patches at the exact bases in the README. Use a separate development Home Assistant installation with the paired editable pyBYD checkout. The upstream integration's `scripts/dev/start-ha-dev.sh` demonstrates the editable install and `--skip-pip-packages pybyd` workflow. Do not install this evidence repository as a HACS integration: it contains patches, not a packaged integration.

The default integration manifest still pins pyBYD 0.0.79. Without the patched library the new fan control is deliberately hidden. This is a release dependency, not a reason to invent or force an untested future package version.

## Test sequence

1. Record vehicle model/year, country/API region, integration base revision, patched library revision, Home Assistant version and firmware/app version when available. Keep account identifiers and VIN private.
2. Park the vehicle and start a normal short climate session using the official app. Note driver and passenger targets, fan setting, AUTO/manual mode and fresh-air/recirculation setting. Keep these visible for comparison.
3. In development HA, confirm climate is on and has reported both target temperatures, circulation and A/C mode. Missing values should produce an error on a fan request, not guessed replacements.
4. Call `climate.set_fan_mode` with the relevant entity and a candidate level, beginning with a level known to exist in the official app. Compare the actual fan, official app and returned `wind_position`. Do not assume all seven levels exist on every model.
5. Confirm both temperature targets and circulation remain unchanged. Check AUTO/manual behaviour separately. If the server ignores a manual level in AUTO, report the result rather than treating a command acknowledgement as success.
6. Record whether reissuing `OPENAIR` renews the climate timer to HA's configured duration and whether this is acceptable for the intended UI.
7. Test a second known level, then stop climate normally. A fan change while climate is off must fail without starting it. A request without a verified Control PIN must fail before submission.
8. If practical, test a normal temperature change followed by a fan change. The fan change should retain the most recent settings, not restore values from before the temperature command.

No optimistic fan-state update is made. A command acknowledgement is not proof of physical motion; please distinguish the requested raw level, returned status and actual observed behaviour.

## Requested result

```text
Model/year:
Country/API region:
HA version / code revisions:
AUTO or manual:
Raw level requested:
Reported wind_position before -> after:
Actual fan / official-app result:
Driver and passenger targets before -> after:
Recirculation before -> after:
Timer before -> after:
Any error or unsupported level:
```

Enable the normal integration and pyBYD debug logging as described in the upstream troubleshooting guide. Share only relevant redacted command/status records. Remove passwords, Control PIN, VIN, account/email identifiers, location, tokens and request secrets. Do not provide credentials or direct access to the car.

The upstream contribution template requires real Home Assistant end-to-end logs before review/merge. This package does not satisfy that physical validation gate yet; owner results are needed before proposing production-ready integration changes.
