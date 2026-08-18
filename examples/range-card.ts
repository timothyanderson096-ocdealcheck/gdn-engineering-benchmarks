import { stockRangeCardExample, vehicleRangeCardExample } from "../src/exploration/examples.js";
import { presentRangeCard } from "../src/exploration/presentation.js";

console.log(JSON.stringify({
  vehicle: presentRangeCard(vehicleRangeCardExample(), "BALANCED"),
  stock: presentRangeCard(stockRangeCardExample(), "BALANCED"),
}, null, 2));
