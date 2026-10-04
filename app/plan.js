// The action plan: Pinchpoint's output as a document an agency can act on.
// Groups the optimal set into projects (culverts that must be replaced together), orders them,
// and says for each one what to build, what it costs, what it buys, why it was chosen, how
// sure we are, and what to do next. Printable; every number comes from the live plan.

import { solve, evaluate, rankPlan } from "./solver.js";

const UNIT = 25_000;
const SCENARIOS = 30;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let robustToken = 0;

function depth(s, id) {
  let k = 0, x = s.byId.get(id).parent;
  while (x && s.byId.has(x)) { k++; x = s.byId.get(x).parent; }
  return k;
}

export function buildProjects(r, lam) {
  const { s, planIds, plan, baseSet } = r;
  const groups = new Map();
  for (const id of planIds) {
    const d = s.byId.get(id);
    if (!groups.has(d.rec.root)) groups.set(d.rec.root, []);
    groups.get(d.rec.root).push(d);
  }
  const out = [...groups.entries()].map(([root, g]) => {
    g.sort((a, b) => depth(s, a.id) - depth(s, b.id)); // lowest culvert first: build order
    const miles = plan.treeMiles.get(root) || 0;
    const cost = g.reduce((t, d) => t + d.rec.cost, 0);
    const flood = g.reduce((t, d) => t + d.flood, 0);
    const ebt = g.reduce((t, d) => t + (plan.open.has(d.id) && d.rec.ebtMiles ? d.rec.ebtMiles : 0), 0);
    const value = (1 - lam) * miles / s.H + lam * flood / s.F;
    return { root, g, miles, cost, flood, ebt, value, inBase: g.filter((d) => baseSet.has(d.id)).length };
  });
  out.sort((a, b) => b.value / b.cost - a.value / a.cost || b.miles - a.miles);
  return out;
}

function why(p, ctx) {
  const { money } = ctx;
  const out = [];
  if (p.g.length > 1) {
    const upper = p.g[p.g.length - 1];
    out.push(`These ${p.g.length} culverts sit on the same creek and only pay off together. Fixed alone, the upper one (${esc(ctx.streamName(upper.rec))}) would reconnect ${upper.rec.gain < 0.05 ? "almost nothing" : `${upper.rec.gain.toFixed(1)} mi`}, because the culvert below it still blocks fish. Together they reconnect ${p.miles.toFixed(1)} mi.`);
    out.push(p.inBase === 0 ? "Ranking culverts one at a time picks none of them at this budget." : p.inBase < p.g.length ? `Ranking culverts one at a time picks ${p.inBase} of the ${p.g.length}, leaving the rest blocked.` : "Ranking culverts one at a time also picks all of them.");
  } else if (p.miles > 0.05) {
    const perM = p.miles / (p.cost / 1e6);
    out.push(p.inBase ? `Strong on its own: ${p.miles.toFixed(1)} mi of creek reconnected for ${money(p.cost)}.` : `Good value: ${p.miles.toFixed(1)} mi of creek for ${money(p.cost)}, about ${perM.toFixed(0)} mi per $1M. Ranking culverts one at a time doesn't pick it at this budget.`);
  } else {
    out.push("Picked for washout risk. The creek above it stays blocked by another barrier farther down, so it adds no river miles yet.");
  }
  const risky = p.g.filter((d) => d.rec.flood >= 0.35);
  if (risky.length) {
    const d = risky.sort((a, b) => b.rec.flood - a.rec.flood)[0].rec;
    out.push(`High washout risk (score ${d.flood.toFixed(2)} of 1): ${d.constriction && d.constriction !== "Unknown" ? `${d.constriction.toLowerCase()} pipe constriction` : "a narrow pipe"} on a ${d.roadType && d.roadType !== "Unknown" ? d.roadType.toLowerCase() : ""} road draining ${d.daSqKm != null ? (d.daSqKm / 2.59).toFixed(1) : "?"} sq mi.`.replace("a  road", "a road"));
  }
  return out;
}

function nextSteps(p) {
  const steps = [];
  const unmeasured = p.g.filter((d) => !d.rec.constriction || d.rec.constriction === "Unknown").length;
  steps.push(`Site visit: confirm the pipe size and condition${unmeasured ? ` (the inventory has no width measurement for ${unmeasured === p.g.length ? (p.g.length > 1 ? "these culverts" : "this culvert") : `${unmeasured} of them`})` : ""}.`);
  steps.push("Engineering estimate: the cost here is a planning figure; real costs often differ by up to 2×.");
  const owners = [...new Set(p.g.map((d) => d.rec.owner).filter(Boolean))];
  steps.push(owners.length ? `Coordinate with the road owner: ${owners.join(", ")}.` : "Identify the road owner (not recorded in the inventory).");
  if (p.g.length > 1) steps.push("Schedule the culverts together, lowest first, so fish gain access as soon as the whole chain is open.");
  if (p.ebt > 0.05) steps.push(`Native brook trout habitat upstream (${p.ebt.toFixed(1)} mi): bring in NC Wildlife Resources Commission biologists.`);
  return steps;
}

function locator(ctx, projects) {
  const { hucGeo, bounds, focusHuc } = ctx;
  const [[x0, y0], [x1, y1]] = bounds;
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const W = 520, H = Math.max(160, Math.min(420, Math.round(W * ((y1 - y0) / ((x1 - x0) * kx)))));
  const px = (x) => ((x - x0) / (x1 - x0)) * W, py = (y) => H - ((y - y0) / (y1 - y0)) * H;
  const ring = (r) => r.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("") + "Z";
  const polys = hucGeo.features
    .filter((f) => !focusHuc || f.properties.huc8 === focusHuc)
    .map((f) => {
      const g = f.geometry, rings = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
      return `<path d="${rings.map(ring).join("")}" class="loc-huc"/>`;
    }).join("");
  const dots = projects.map((p, i) => {
    const d = p.g[0].rec;
    const n = i < 12 ? `<text x="${(px(d.lon) + 7).toFixed(1)}" y="${(py(d.lat) + 4).toFixed(1)}" class="loc-n">${i + 1}</text>` : "";
    return `<circle cx="${px(d.lon).toFixed(1)}" cy="${py(d.lat).toFixed(1)}" r="${i < 12 ? 4.5 : 3}" class="loc-dot"/>${n}`;
  }).join("");
  return `<svg viewBox="-12 -12 ${W + 24} ${H + 24}" class="loc" role="img" aria-label="Map of the projects in this plan">${polys}${dots}</svg>`;
}

function card(p, i, ctx) {
  const { money } = ctx;
  const lo = money(p.cost * 0.44), hi = money(p.cost * 2.28);
  const head = p.g[0].rec;
  const builds = p.g.map((d) => {
    const r = d.rec;
    const road = r.road && !/^unnamed/i.test(r.road) ? `under ${esc(r.road)}` : "under an unnamed road";
    return `<li><b>${esc(ctx.streamName(r))}</b>: replace the pipe ${road}${r.roadType && r.roadType !== "Unknown" ? ` (${esc(r.roadType.toLowerCase())})` : ""} with a creek-wide crossing about ${Math.round(r.spanFt)} ft wide (a small bridge or bottomless arch, natural creek bed). ${money(r.cost)}.
      <span class="ap-coord"><a href="https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}" target="_blank" rel="noopener">${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}</a>, inventory ID <a href="${ctx.invUrl(r.id)}" target="_blank" rel="noopener">${esc(r.id)}</a>${r.owner ? `, road owner: ${esc(r.owner)}` : ""}</span></li>`;
  }).join("");
  return `<article class="ap-card" data-ids="${p.g.map((d) => d.id).join(",")}">
    <header class="ap-card-head">
      <span class="ap-rank">${i + 1}</span>
      <div class="ap-title"><h3>${esc(ctx.streamName(head))}${head.county ? `, ${esc(head.county)} County` : ""}</h3>
        <p>${p.g.length > 1 ? `Replace ${p.g.length} culverts together` : "Replace 1 culvert"}${ctx.isNC ? `, ${esc(ctx.shedName(head.huc8))} watershed` : ""}</p></div>
      <div class="ap-actions no-print"><button type="button" class="btn btn-small" data-fly="${esc(p.g[p.g.length - 1].id)}">Fly to it</button><button type="button" class="btn btn-small" data-show="${esc(head.id)}">Show on map</button></div>
    </header>
    <dl class="ap-stats">
      <div><dt>Cost</dt><dd>${money(p.cost)}<small>likely ${lo}–${hi}</small></dd></div>
      <div><dt>River reconnected</dt><dd>${p.miles.toFixed(1)} mi${p.ebt > 0.05 ? `<small>${p.ebt.toFixed(1)} mi brook trout habitat</small>` : ""}</dd></div>
      <div><dt>Washout risk removed</dt><dd>${Math.round((p.flood / ctx.F) * 1000) / 10}%<small>of the ${ctx.isNC ? "statewide" : "watershed"} total</small></dd></div>
      <div><dt>Confidence</dt><dd class="ap-conf" data-conf>…<small>checking costs</small></dd></div>
    </dl>
    <div class="ap-body">
      <h4>What to build</h4><ol class="ap-build">${builds}</ol>
      <h4>Why it's in the plan</h4>${why(p, ctx).map((t) => `<p>${t}</p>`).join("")}
      <h4>Next steps</h4><ul class="ap-steps">${nextSteps(p).map((t) => `<li>${t}</li>`).join("")}</ul>
    </div>
  </article>`;
}

function moneyTable(projects, ctx) {
  const by = new Map();
  for (const p of projects) {
    const h = p.g[0].rec.huc8;
    const a = by.get(h) || { n: 0, c: 0, cost: 0, miles: 0 };
    a.n++; a.c += p.g.length; a.cost += p.cost; a.miles += p.miles;
    by.set(h, a);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].cost - a[1].cost);
  return `<table class="ap-table"><thead><tr><th>Watershed</th><th>Projects</th><th>Cost</th><th>River reconnected</th></tr></thead><tbody>
    ${rows.map(([h, a]) => `<tr><td>${esc(ctx.shedName(h))}</td><td>${a.n}${a.c > a.n ? ` (${a.c} culverts)` : ""}</td><td>${ctx.money(a.cost)}</td><td>${a.miles.toFixed(1)} mi</td></tr>`).join("")}
  </tbody></table>`;
}

export function renderPlanView(ctx) {
  const { r, money } = ctx;
  const { s, plan, base } = r;
  const projects = buildProjects(r, ctx.lam);
  const ebt = projects.reduce((t, p) => t + p.ebt, 0);
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dMiles = plan.miles - base.miles;
  const html = `
  <header class="ap-top no-print">
    <span class="ap-top-title">Action plan</span>
    <span class="spacer"></span>
    <button type="button" class="btn" id="ap-print">Print or save as PDF</button>
    <button type="button" class="btn" id="ap-csv">Download CSV</button>
    <button type="button" class="btn btn-primary" id="ap-close">Back to the map</button>
  </header>
  <div class="ap-doc">
    <p class="ap-kicker">Pinchpoint action plan</p>
    <h2 class="ap-h1">Which culverts to replace: ${esc(ctx.scopeName)}</h2>
    <p class="ap-meta">Budget ${esc(ctx.budget)}. Priority: ${esc(ctx.lamText)}. Generated ${date} from the National Aquatic Barrier Inventory and USGS NHDPlus HR.</p>
    ${projects.length ? `
    <section class="ap-summary">
      <div><b>${projects.length}</b><span>${projects.length === 1 ? "project" : "projects"} (${plan.n} culverts)</span></div>
      <div><b>${money(plan.cost * UNIT)}</b><span>total planning cost</span></div>
      <div><b>${plan.miles.toFixed(1)} mi</b><span>of creek reconnected</span></div>
      <div><b>${Math.round((plan.flood / s.F) * 100)}%</b><span>of washout risk removed</span></div>
      ${ebt > 0.05 ? `<div><b>${ebt.toFixed(1)} mi</b><span>of brook trout habitat reopened</span></div>` : ""}
    </section>
    <p class="ap-lead">With the same money, picking culverts one at a time would reconnect ${base.miles.toFixed(1)} mi and remove ${Math.round((base.flood / s.F) * 100)}% of washout risk.${dMiles > 0.05 ? ` This plan reconnects <b>${dMiles.toFixed(1)} more miles</b>${base.miles > 0 ? ` (+${Math.round((dMiles / base.miles) * 100)}%)` : ""}.` : " Here the two approaches reach the same river miles."}</p>
    <p class="ap-lead" id="ap-robust">Checking the plan against ${SCENARIOS} random cost scenarios…</p>
    <section class="ap-overview">
      <figure class="ap-loc">${locator(ctx, projects)}<figcaption>Projects ${projects.length > 12 ? "1–12 are numbered" : "are numbered"} in priority order.</figcaption></figure>
      ${ctx.isNC ? `<div class="ap-money"><h4>Where the money goes</h4>${moneyTable(projects, ctx)}</div>` : `<div class="ap-money"><h4>How projects are ordered</h4><p>By benefit per dollar: river miles (and washout risk, when weighted) per $1M. Do them top to bottom if money arrives in stages. Culverts in one project must be done together.</p></div>`}
    </section>
    <h3 class="ap-h2">Projects, in priority order</h3>
    ${projects.map((p, i) => card(p, i, ctx)).join("")}` : `<p class="ap-lead">This budget is smaller than the cheapest culvert here. Raise the budget to get a plan.</p>`}
    <section class="ap-method">
      <h3 class="ap-h2">How this plan was made</h3>
      <p>Pinchpoint treats each river as a network. A culvert only reconnects the creek above it once every blocking culvert below it is also fixed, and the gain is capped by how much open river lies below (the inventory's own rule). An exact optimizer picks the set of culverts with the most benefit for the budget, weighing reconnected river miles against a washout-risk score (pipe constriction × stream size × road type) as you set it.</p>
      <p>Limits: costs are planning estimates from stream width and road type; the washout score is a screening index, not a failure prediction; only culverts that field crews have assessed are included; dams and waterfalls are treated as permanent.</p>
    </section>
  </div>`;
  const root = $("#action");
  root.innerHTML = html;
  root.hidden = false;
  document.body.classList.add("plan-open");
  root.scrollTop = 0;
  $("#ap-close").onclick = () => closePlanView();
  $("#ap-print").onclick = () => window.print();
  $("#ap-csv").onclick = () => ctx.exportCsv();
  root.querySelectorAll("[data-fly]").forEach((b) => (b.onclick = () => { closePlanView(); ctx.flyover(b.dataset.fly); }));
  root.querySelectorAll("[data-show]").forEach((b) => (b.onclick = () => { closePlanView(); ctx.show(b.dataset.show); }));
  $("#ap-close").focus();
  if (projects.length) robustness(ctx, projects);
}

export function closePlanView() {
  robustToken++;
  const root = $("#action");
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove("plan-open");
}

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Re-solve under random costs (each culvert's cost times a lognormal factor, sigma 0.5) and count
// how often each culvert stays in the plan and how often the plan beats one-at-a-time ranking.
function robustness(ctx, projects) {
  const my = ++robustToken;
  const { s, units } = ctx.r;
  const lam = ctx.lam;
  const rnd = mulberry32(20261003);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const freq = new Map();
  let wins = 0, ties = 0, done = 0;
  const step = () => {
    if (my !== robustToken) return;
    const items = s.items.map((d) => ({ ...d, cost: Math.max(1, Math.round((d.rec.cost * Math.exp(0.5 * gauss())) / UNIT)) }));
    const pIds = solve(items, units, lam).plan(units);
    const p = evaluate(items, pIds);
    const b = evaluate(items, rankPlan(items, units, ctx.soloScore(s, lam)));
    for (const id of pIds) freq.set(id, (freq.get(id) || 0) + 1);
    const vp = (1 - lam) * p.miles / s.H + lam * p.flood / s.F, vb = (1 - lam) * b.miles / s.H + lam * b.flood / s.F;
    if (vp > vb + 1e-12) wins++; else if (Math.abs(vp - vb) <= 1e-12) ties++;
    done++;
    const el = $("#ap-robust");
    if (el) el.textContent = `Checking the plan against ${SCENARIOS} random cost scenarios… ${done}/${SCENARIOS}`;
    if (done < SCENARIOS) return setTimeout(step, 0);
    if (el) el.innerHTML = `Under ${SCENARIOS} random cost scenarios (each culvert's cost varied by up to about 2× either way), this approach beat one-at-a-time ranking in <b>${wins}</b>${ties ? ` and tied in ${ties}` : ""}. Each project's confidence is how often it stayed in the plan.`;
    document.querySelectorAll(".ap-card").forEach((c) => {
      const ids = c.dataset.ids.split(",");
      const f = Math.min(...ids.map((id) => (freq.get(id) || 0) / SCENARIOS));
      const label = f >= 0.8 ? "High" : f >= 0.5 ? "Medium" : "Low";
      const dd = c.querySelector("[data-conf]");
      dd.className = `ap-conf ap-conf--${label.toLowerCase()}`;
      dd.innerHTML = `${label}<small>kept in ${Math.round(f * 100)}% of scenarios${label === "Low" ? "; get real costs first" : ""}</small>`;
    });
  };
  setTimeout(step, 30);
}
