import { simulatedEngineeringSession } from "../src/orchestration/example.js";
import { presentOrchestration } from "../src/orchestration/presentation.js";

console.log(JSON.stringify(presentOrchestration(simulatedEngineeringSession(), "AUDIT"), null, 2));
