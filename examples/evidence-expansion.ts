import { stockAppOutputExpansionExample, vehicleListingExpansionExample } from "../src/expansion/examples.js";

console.log(JSON.stringify({ stock: stockAppOutputExpansionExample(), vehicle: vehicleListingExpansionExample() }, null, 2));
