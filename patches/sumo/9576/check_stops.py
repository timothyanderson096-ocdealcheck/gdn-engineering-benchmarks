"""Check SUMO's Energy model against mechanical work on controlled one-second traces."""
import argparse
import csv
import json
import math
from pathlib import Path
import subprocess
import tempfile
from xml.etree import ElementTree as ET

# No rolling, aerodynamic or rotational terms in the rig. Positive Wh is battery use.
MASS = 1800.0
DEFAULT = dict(rotatingMass=0, frontSurfaceArea=2, airDragCoefficient=0,
               rollDragCoefficient=0, constantPowerIntake=0, propulsionEfficiency=1,
               recuperationEfficiency=1, recuperationEfficiencyByDeceleration=0)
HARD = [24, 16, 8, 0]
GENTLE = list(range(24, -1, -1))
LOW = [4, 0]
P50 = {"maximumRecuperationPower": 50_000}
T100 = {"maximumRecuperationTorque": 100, "gearRatio": 4, "wheelRadius": 0.4}

# Case, per-second speeds (m/s), vType parameter overrides, road grade (degrees).
CASES = [
    ("hard_without_limits", HARD, {}, 0),
    ("gentle_without_limits", GENTLE, {}, 0),
    ("hard_50kw", HARD, P50, 0),
    ("gentle_50kw", GENTLE, P50, 0),
    ("low_speed_power_only", LOW, P50, 0),
    ("low_speed_torque_only", LOW, T100, 0),
    ("low_speed_combined", LOW, {**P50, **T100}, 0),
    ("switch_between_limits", [24,16,8,0], {**P50, **T100, "maximumRecuperationTorque": 300}, 0),
    ("within_step_crossover", [10, 0], {**T100, "maximumRecuperationPower": 5000}, 0),
    ("zero_motor_power", HARD, {"maximumRecuperationPower": 0}, 0),
    ("zero_motor_torque", HARD, {"maximumRecuperationTorque": 0}, 0),
    ("zero_torque_with_accessories", LOW, {"maximumRecuperationTorque": 0, "constantPowerIntake": 900}, 0),
    ("electrical_efficiency_accessories", HARD, {**P50, "recuperationEfficiency": 0.8, "constantPowerIntake": 1000}, 0),
    ("acceleration_with_limits", [0,8,16,24], {**T100, **P50, "propulsionEfficiency": 0.8, "constantPowerIntake": 200}, 0),
    ("downhill_constant_speed", [12,12,12], {"maximumRecuperationPower": 5000}, -6),
    ("stationary_auxiliaries", [0,0,0], {**P50, **T100, "constantPowerIntake": 900}, 0),
    ("default_drivetrain_geometry", [4,0], {"maximumRecuperationTorque": 100}, 0),
]


def oracle(speeds, settings, slope):
    """Mechanical work in joules. One-second average watts is numerically the same."""
    values = []
    for v0, v1 in zip(speeds, speeds[1:]):
        kinetic_j = MASS * (v1**2 - v0**2) / 2
        # SUMO's Euler vertical displacement uses the end-of-step forward speed.
        gravity_j = MASS * 9.80665 * math.sin(math.radians(slope)) * v1
        work = kinetic_j + gravity_j
        if work < 0:
            distance = (v0 + v1) / 2
            force = -work / distance
            if "maximumRecuperationTorque" in settings:
                # Tractive force at the wheel for the specified motor shaft torque.
                force = min(force, settings["maximumRecuperationTorque"]
                            * settings.get("gearRatio", 10) / settings.get("wheelRadius", 0.3588))
            limit = settings.get("maximumRecuperationPower", math.inf)
            # Independently split into a trapezoid and a constant-power rectangle.
            # Time is normalized to [0, 1] for this one-second trace.
            breaks = [0.0, 1.0]
            if force and v0 != v1 and min(v0, v1) < limit / force < max(v0, v1):
                breaks.insert(1, (limit / force - v0) / (v1 - v0))
            watts = [min(limit, force * (v0 + (v1 - v0) * t)) for t in breaks]
            recovered = sum((b - a) * (pa + pb) / 2
                            for a, b, pa, pb in zip(breaks, breaks[1:], watts, watts[1:]))
            battery = -recovered * settings["recuperationEfficiency"]
        else:
            battery = work / settings["propulsionEfficiency"]
        values.append((battery + settings["constantPowerIntake"]) / 3600)
    return values


def run(exe, folder, speeds, settings, slope):
    root = ET.Element("additional")
    vehicle = ET.SubElement(root, "vType", id="ev", emissionClass="Energy/unknown", mass=str(MASS))
    for key, val in settings.items():
        ET.SubElement(vehicle, "param", key=key, value=str(val))
    ET.ElementTree(root).write(folder / "vehicle.xml")
    (folder / "speed.csv").write_text("".join(f"{t};{v}\n" for t, v in enumerate(speeds)))
    subprocess.run([str(exe), "-t", "speed.csv", "--timeline-file.separator", ";", "-a",
                    "--additional-files", "vehicle.xml", "--vtype", "ev", "--slope", str(slope),
                    "-o", "steps.csv", "--precision", "10", "-q"], cwd=folder, check=True)
    with (folder / "steps.csv").open() as stream:
        return [float(row[-1]) for row in csv.reader(stream, delimiter=";")]


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("binary", type=Path)
    cli.add_argument("result", type=Path)
    cli.add_argument("--require-all", action="store_true",
                     help="exit with failure if any step misses the independent reference")
    args = cli.parse_args()
    exe = args.binary.resolve()
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, speeds, overrides, slope in CASES:
            settings = {**DEFAULT, **overrides}
            expected = oracle(speeds, settings, slope)
            simulated = run(exe, Path(tmp), speeds, settings, slope)
            if len(simulated) != len(expected):
                raise ValueError(f"{name}: unexpected sample count")
            ok = all(math.isclose(x, y, rel_tol=6e-6, abs_tol=6e-6) for x,y in zip(simulated, expected))
            rows.append({"case": name, "matches_oracle": ok, "expected_net_wh": sum(expected),
                         "simulated_net_wh": sum(simulated), "expected_steps_wh": expected, "simulated_steps_wh": simulated})
    args.result.write_text(json.dumps(rows, indent=2) + "\n")
    print(f"{sum(row['matches_oracle'] for row in rows)}/{len(rows)} cases match the mechanical work calculation")
    for row in rows:
        if not row["matches_oracle"]:
            print(row["case"], round(row["expected_net_wh"], 6), round(row["simulated_net_wh"], 6))
    if args.require_all and not all(row["matches_oracle"] for row in rows):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
