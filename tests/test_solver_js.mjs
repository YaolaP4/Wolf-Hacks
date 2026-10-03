// Cross-implementation check: the JS solver must match Python brute force on fixed cases.
import { readFileSync } from "node:fs";
import { solve, evaluate } from "../app/solver.js";

const cases = JSON.parse(readFileSync(new URL("./fixtures/solver_cases.json", import.meta.url)));
let fail = 0;
for (const [i, c] of cases.entries()) {
  const sol = solve(c.items, c.budget, c.lam);
  const plan = sol.plan(c.budget);
  const e = evaluate(c.items, plan);
  const obj = (1 - c.lam) * e.miles / sol.H + c.lam * e.flood / sol.F;
  if (Math.abs(sol.best[c.budget] - c.expected) > 1e-9 || Math.abs(obj - c.expected) > 1e-9 || e.cost > c.budget) {
    fail++;
    console.log("FAIL case", i, sol.best[c.budget], obj, c.expected);
  }
}
console.log(`${cases.length - fail}/${cases.length} cases match Python brute force`);
process.exit(fail ? 1 : 0);
