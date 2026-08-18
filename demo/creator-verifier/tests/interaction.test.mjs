import assert from "node:assert/strict";
import test from "node:test";
import { probes, stageAt, stages } from "../src/evidence.mjs";

test("publishes the six-stage evidence-driven verification sequence", () => {
  assert.equal(stages.length, 6);
  assert.deepEqual(stages.map((stage) => stage.kicker.split(" / ")[1]), ["PROPOSED REPAIR", "DIRECT CHECKS", "INDEPENDENT VERIFICATION", "EVIDENCE DECISION", "BOUNDED REPAIR", "VERIFIED OUTCOME"]);
  assert.match(stageAt(1).output.join("\n"), /155 passed/);
  assert.match(stageAt(2).label, /4 contradictions/);
  assert.match(stageAt(5).output.join("\n"), /baseline 2\/3 · GDN 3\/3/);
  assert.throws(() => stageAt(6), RangeError);
});

test("publishes the four exact boundary counterexamples", () => {
  assert.equal(probes.length, 4);
  assert.deepEqual(probes.map((probe) => probe.raw), ["foo=a%25b", "foo=a%37b", "foo=a%7Cb", "foo=a+b"]);
  assert.ok(probes.every((probe) => probe.baseline !== probe.gdn));
  assert.deepEqual(probes.map((probe) => probe.gdn), probes.map((probe) => probe.expected));
});
