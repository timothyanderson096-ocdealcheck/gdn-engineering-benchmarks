"""Replay three linear stops through TraCI and compare battery energy with analytic work."""

import argparse
import contextlib
import csv
import io
import math
from pathlib import Path
import sys
import tempfile
import xml.etree.ElementTree as ET


def mechanical_joules(speed, seconds, force, power):
    """Integrate min(force × speed, power) from the initial speed to rest."""
    crossover = min(speed, power / force)
    return seconds / speed * (force * crossover**2 / 2 + power * (speed - crossover))


def simulate(traci, binary, net, routes, start_speed, duration, dt):
    with contextlib.redirect_stdout(io.StringIO()):
        traci.start([str(binary), "-n", str(net), "-r", str(routes), "--step-length", str(dt),
                     "--no-step-log", "--no-duration-log", "--seed", "1", "--xml-validation", "never",
                     "--device.battery.probability", "1", "--xml-validation.net", "never"])
    try:
        traci.simulationStep()
        traci.vehicle.setSpeedMode("car", 0)
        traci.vehicle.setSpeed("car", start_speed)
        traci.simulationStep()
        energy_wh = 0.0
        for step in range(1, round(duration / dt) + 1):
            speed = start_speed * (1 - step * dt / duration)
            traci.vehicle.setSpeed("car", speed)
            traci.simulationStep()
            actual = traci.vehicle.getSpeed("car")
            if not math.isclose(actual, speed, abs_tol=1e-9):
                raise RuntimeError(f"speed trace missed: expected {speed}, observed {actual}")
            energy_wh += traci.vehicle.getElectricityConsumption("car") * dt
        return energy_wh
    finally:
        traci.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sumo_home", type=Path, help="SUMO source checkout with the regression fixture")
    parser.add_argument("sumo_binary", type=Path, help="compiled SUMO executable")
    args = parser.parse_args()
    root = args.sumo_home.resolve()
    binary = args.sumo_binary.resolve()
    sys.path.insert(0, str(root / "tools"))
    import traci

    net = root / "tests/sumo/devices/battery/net.net.xml"
    fixture = root / "tests/complex/emissions/recuperation_limits/input_additional.add.xml"
    writer = csv.writer(sys.stdout, lineterminator="\n")
    writer.writerow(("initial_speed_m_s", "duration_s", "step_s", "measured_net_wh", "expected_net_wh"))
    cases = (("both", 4.0, 1.0, 1000., 5000., 0.5, 250.),
             ("both", 10.0, 1.0, 1000., 5000., 0.5, 250.),
             ("strong", 24.0, 3.0, 14400., 50000., 1.0, 0.))
    for name, speed, duration, force, power, efficiency, aux in cases:
        with tempfile.TemporaryDirectory() as workspace:
            routes = Path(workspace) / "routes.xml"
            route = ET.parse(fixture).getroot()
            route.tag = "routes"
            if name == "strong":
                vehicle_type = ET.SubElement(route, "vType", id=name, refId="unlimited", mass="1800")
                for key, value in (("recuperationEfficiency", efficiency), ("constantPowerIntake", aux),
                                   ("maximumRecuperationPower", power)):
                    ET.SubElement(vehicle_type, "param", key=key, value=str(value))
            car = ET.SubElement(route, "vehicle", id="car", type=name, depart="0", departSpeed="10", departPos="50")
            ET.SubElement(car, "route", edges="D1")
            ET.ElementTree(route).write(routes, encoding="utf-8")
            expected = (aux * duration - efficiency * mechanical_joules(speed, duration, force, power)) / 3600
            for dt in (1.0, 0.5, 0.25):
                measured = simulate(traci, binary, net, routes, speed, duration, dt)
                writer.writerow((speed, duration, dt, f"{measured:.9f}", f"{expected:.9f}"))
                if not math.isclose(measured, expected, rel_tol=0.0, abs_tol=1e-6):
                    raise RuntimeError(f"net battery energy mismatch: observed {measured} Wh, expected {expected} Wh")


if __name__ == "__main__":
    main()
