import { businessContextExample, vehicleContextExample } from "../src/context/examples.js";
import { presentContextualOutput } from "../src/context/presentation.js";

console.log(JSON.stringify({
  vehicle: presentContextualOutput(vehicleContextExample(), "BALANCED"),
  business: presentContextualOutput(businessContextExample(), "BALANCED"),
}, null, 2));
