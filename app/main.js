import { solve, evaluate, rankPlan, normalizers } from "./solver.js";

const UNIT = 25_000; // dollars per solver cost unit
const BUDGETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20];
const MAX_UNITS = Math.round(20e6 / UNIT);
const SHOWCASE = "06010105";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { huc: SHOWCASE, bi: 7, lam: 0, showBase: true, selected: null, stress: null };
const DATA = {};
const sheds = new Map();
const solutions = new Map();
let map;
let popup;
let streamsLoaded = null;

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (d) => (d >= 1e6 ? `$${(d / 1e6).toFixed(d >= 1e7 ? 1 : 2)}M` : `$${Math.round(d / 1e3)}k`);
const mi = (x) => `${x.toFixed(1)} mi`;
const pct = (x) => `${Math.round(x * 100)}%`;
const budgetUsd = () => BUDGETS[state.bi] * 1e6;
const budgetUnits = () => Math.round(budgetUsd() / UNIT);
const lamLabel = (l) => (l === 0 ? "Rivers only" : l === 1 ? "Roads only" : `${Math.round((1 - l) * 100)}% rivers, ${Math.round(l * 100)}% roads`);
const streamName = (r) => r.river && r.river !== "Unknown" ? r.river : "Unnamed tributary";

async function getJSON(path, optional = false) {
  const res = await fetch(path);
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`Could not load ${path} (${res.status})`);
  }
  return res.json();
}

/* ---------- model ---------- */
function shed(huc) {
  if (sheds.has(huc)) return sheds.get(huc);
  const recs = DATA.culverts.filter((d) => d.huc8 === huc);
  const items = recs.map((r) => ({ id: r.id, parent: r.parent, habitat: r.up, flood: r.flood, cost: Math.max(1, Math.round(r.cost / UNIT)), anchor: r.parent ? null : r.anchorMiles, rec: r }));
  const byId = new Map(items.map((d) => [d.id, d]));
  const children = new Map(items.map((d) => [d.id, []]));
  for (const d of items) if (d.parent && children.has(d.parent)) children.get(d.parent).push(d.id);
  const { H, F } = normalizers(items);
  const s = { huc, recs, items, byId, children, H, F, meta: DATA.sheds.find((x) => x.huc8 === huc) };
  sheds.set(huc, s);
  return s;
}

function solution(s, lam) {
  const key = `${s.huc}|${lam}`;
  if (!solutions.has(key)) {
    const t0 = performance.now();
    const sol = solve(s.items, MAX_UNITS, lam);
    sol.ms = performance.now() - t0;
    solutions.set(key, sol);
  }
  return solutions.get(key);
}

// One at a time: each culvert scored on its own (its own gain miles, plus flood when weighted).
const soloScore = (s, lam) => (d) => (1 - lam) * d.rec.gain / s.H + lam * d.flood / s.F;

function compute() {
  const s = shed(state.huc);
  const sol = solution(s, state.lam);
  const units = budgetUnits();
  const planIds = sol.plan(units);
  const baseIds = rankPlan(s.items, units, soloScore(s, state.lam));
  const plan = evaluate(s.items, planIds);
  const base = evaluate(s.items, baseIds);
  return { s, sol, units, planIds, baseIds, plan, base, planSet: new Set(planIds), baseSet: new Set(baseIds) };
}

/* ---------- panel ---------- */
function renderPanel(r) {
  const { s, plan, base } = r;
  $("#budget-out").textContent = money(budgetUsd());
  $("#lam-out").textContent = lamLabel(state.lam);
  $("#budget").style.setProperty("--fill", `${(state.bi / (BUDGETS.length - 1)) * 100}%`);
  $("#r-miles-p").textContent = mi(plan.miles);
  $("#r-miles-b").textContent = mi(base.miles);
  $("#r-flood-p").textContent = pct(plan.flood / s.F);
  $("#r-flood-b").textContent = pct(base.flood / s.F);
  $("#r-n-p").textContent = plan.n;
  $("#r-n-b").textContent = base.n;
  $("#r-cost-p").textContent = money(plan.cost * UNIT);
  $("#r-cost-b").textContent = money(base.cost * UNIT);

  const dMiles = plan.miles - base.miles;
  const dFlood = (plan.flood - base.flood) / s.F;
  let v;
  if (plan.n === 0) v = "This budget is smaller than the cheapest culvert here. Raise it to see a plan.";
  else if (dMiles > 0.05 && state.lam === 0) v = `Same budget, <b>${dMiles.toFixed(1)} more river miles</b> reconnected (${base.miles > 0 ? "+" + Math.round((dMiles / base.miles) * 100) + "%" : "from none"}).`;
  else if (state.lam > 0 && (dMiles > 0.05 || dFlood > 0.005)) {
    const pts = Math.round(Math.abs(dFlood) * 100);
    const fl = pts === 0 ? "about the same washout risk removed" : `${pts} ${pts === 1 ? "point" : "points"} ${dFlood >= 0 ? "more" : "less"} of the washout risk removed`;
    v = `Same budget: <b>${Math.abs(dMiles).toFixed(1)} ${dMiles >= 0 ? "more" : "fewer"} river miles</b> and <b>${fl}</b> than ranking one at a time.`;
  }
  else v = "At this budget both approaches reach the same river miles. The gap opens where culverts sit in chains.";
  $("#verdict").innerHTML = v;

  renderCurve(r);
  renderPlanList(r);
  const st = state.stress;
  $("#stress-out").textContent = st && st.key === stressKey() ? st.summary : "Re-solve with 60 random cost scenarios.";
  document.body.classList.toggle("hide-base", !state.showBase);
}

function renderCurve(r) {
  const { s, sol } = r;
  const svg = $("#curve");
  const W = 360, Hh = 150, L = 34, R = 92, T = 10, B = 22;
  const xmaxM = BUDGETS[state.bi] <= 6 ? 10 : 20;
  const steps = BUDGETS.filter((b) => b <= xmaxM);
  const pts = steps.map((b) => {
    const u = Math.round((b * 1e6) / UNIT);
    return {
      b,
      p: evaluate(s.items, sol.plan(u)).miles,
      q: evaluate(s.items, rankPlan(s.items, u, soloScore(s, state.lam))).miles,
    };
  });
  pts.unshift({ b: 0, p: 0, q: 0 });
  const ymax = Math.max(1, ...pts.map((d) => d.p)) * 1.08;
  const x = (b) => L + ((W - L - R) * b) / xmaxM;
  const y = (m) => T + (Hh - T - B) * (1 - m / ymax);
  const line = (k) => pts.map((d, i) => `${i ? "L" : "M"}${x(d.b).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
  const gap = `${line("p")}${[...pts].reverse().map((d) => `L${x(d.b).toFixed(1)},${y(d.q).toFixed(1)}`).join("")}Z`;
  const cur = BUDGETS[state.bi];
  const curP = r.plan.miles, curQ = r.base.miles;
  const last = pts[pts.length - 1];
  const yt = [0, ymax / 2, ymax / 1.08].map((m) => Math.round(m));
  let labP = y(last.p), labQ = y(last.q);
  if (Math.abs(labP - labQ) < 13) { labP -= 7; labQ += 7; }
  svg.innerHTML = `
    <title>River miles reconnected by budget</title>
    ${yt.map((m) => `<line class="axis" x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}" opacity="${m ? 0.5 : 1}"/><text class="tick" x="${L - 5}" y="${y(m) + 3}" text-anchor="end">${m}</text>`).join("")}
    <path class="gap" d="${gap}"/>
    <path class="l-base" d="${line("q")}"/>
    <path class="l-plan" d="${line("p")}"/>
    <line class="marker" x1="${x(cur)}" x2="${x(cur)}" y1="${T}" y2="${Hh - B}"/>
    <circle cx="${x(cur)}" cy="${y(curP)}" r="3.5" fill="var(--water)"/>
    <circle cx="${x(cur)}" cy="${y(curQ)}" r="3" fill="#fff" stroke="var(--contour)" stroke-width="1.5"/>
    <text class="tick" x="${L}" y="${Hh - 6}">$0</text>
    <text class="tick" x="${x(xmaxM / 2)}" y="${Hh - 6}" text-anchor="middle">$${xmaxM / 2}M</text>
    <text class="tick" x="${x(xmaxM)}" y="${Hh - 6}" text-anchor="middle">$${xmaxM}M</text>
    <text class="tick" x="${L - 5}" y="${T - 1}" text-anchor="end">mi</text>
    <text class="lbl lbl-plan" x="${x(xmaxM) + 6}" y="${labP + 4}">Network-aware</text>
    <text class="lbl lbl-base" x="${x(xmaxM) + 6}" y="${labQ + 4}">One at a time</text>`;
}

function renderPlanList(r) {
  const { s, planIds, plan } = r;
  const ol = $("#plan-list");
  if (!planIds.length) {
    ol.innerHTML = `<li class="empty">No culvert fits this budget yet.</li>`;
    return;
  }
  const groups = new Map();
  for (const id of planIds) {
    const d = s.byId.get(id);
    const g = groups.get(d.rec.root) || [];
    g.push(d);
    groups.set(d.rec.root, g);
  }
  const rows = [...groups.values()].map((g) => {
    const miles = plan.treeMiles.get(g[0].rec.root) || 0;
    const cost = g.reduce((t, d) => t + d.rec.cost, 0);
    g.sort((a, b) => depth(s, a.id) - depth(s, b.id));
    return { g, miles, cost };
  });
  rows.sort((a, b) => b.miles - a.miles || a.cost - b.cost);
  const item = (d, label) => `
    <button type="button" class="item" data-id="${esc(d.id)}">
      <span class="stream">${esc(streamName(d.rec))}</span>
      <span class="road">${esc(d.rec.road || "Unnamed road")}${d.rec.roadType && d.rec.roadType !== "Unknown" ? `, ${esc(d.rec.roadType.toLowerCase())}` : ""}</span>
      <span class="num">${label}<small>${money(d.rec.cost)}</small></span>
    </button>`;
  ol.innerHTML = rows.map(({ g, miles, cost }) =>
    g.length > 1
      ? `<li class="bundle"><div class="bundle-head">${g.length} culverts in one chain: ${miles.toFixed(1)} mi for ${money(cost)}</div>${g.map((d) => item(d, plan.open.has(d.id) ? `${d.habitat.toFixed(1)} mi above` : "flood fix")).join("")}</li>`
      : `<li class="single">${item(g[0], miles > 0 ? `+${miles.toFixed(1)} mi` : "flood fix")}</li>`
  ).join("");
  ol.querySelectorAll(".item").forEach((b) => b.addEventListener("click", () => selectCulvert(b.dataset.id, true)));
}

function depth(s, id) {
  let k = 0, x = s.byId.get(id).parent;
  while (x && s.byId.has(x)) { k++; x = s.byId.get(x).parent; }
  return k;
}

/* ---------- map ---------- */
function buildStyle(dem) {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      dem: dem.source,
      ...(dem.contours ? { contours: dem.contours } : {}),
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#f2f4ef" } },
      { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]], paint: { "fill-color": "#dbe5d1", "fill-opacity": 0.55 } },
      { id: "urban", type: "fill", source: "omt", "source-layer": "landuse", filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "industrial"]]], paint: { "fill-color": "#e9e4dc", "fill-opacity": 0.6 } },
      { id: "shade", type: "hillshade", source: "dem", paint: { "hillshade-shadow-color": "#5e5245", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#7d6e5e", "hillshade-exaggeration": 0.42, "hillshade-illumination-direction": 315 } },
      ...(dem.contours ? [
        { id: "contour", type: "line", source: "contours", "source-layer": "contours", paint: { "line-color": "#9a6b43", "line-opacity": ["match", ["get", "level"], 1, 0.42, 0.2], "line-width": ["match", ["get", "level"], 1, 0.9, 0.45] } },
      ] : []),
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#c4ddeb" } },
      { id: "waterway", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": "#8dbfdc", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.3, 13, 1.2] } },
      { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 10, filter: ["in", ["get", "class"], ["literal", ["minor", "service", "track"]]], paint: { "line-color": "#a9ada4", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 15, 1.6] } },
      { id: "road-major", type: "line", source: "omt", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]], paint: { "line-color": "#b4553c", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 12, 1.6, 15, 3] } },
      { id: "state-line", type: "line", source: "omt", "source-layer": "boundary", filter: ["==", ["get", "admin_level"], 4], paint: { "line-color": "#7b8582", "line-width": 1, "line-dasharray": [3, 2] } },
      { id: "water-name", type: "symbol", source: "omt", "source-layer": "water_name", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 12 }, paint: { "text-color": "#2e6f99", "text-halo-color": "#f2f4ef", "text-halo-width": 1.4 } },
      { id: "labels-place", type: "symbol", source: "omt", "source-layer": "place", filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]], layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": ["match", ["get", "class"], "city", 14, "town", 12, 11] }, paint: { "text-color": "#33403f", "text-halo-color": "#f2f4ef", "text-halo-width": 1.6 } },
    ],
  };
}

function demConfig() {
  const url = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
  if (window.mlcontour) {
    try {
      const demSource = new window.mlcontour.DemSource({ url, encoding: "terrarium", maxzoom: 12, worker: true });
      demSource.setupMaplibre(window.maplibregl);
      return {
        source: { type: "raster-dem", tiles: [demSource.sharedDemProtocolUrl], encoding: "terrarium", tileSize: 256, maxzoom: 12 },
        contours: {
          type: "vector",
          tiles: [demSource.contourProtocolUrl({ multiplier: 3.28084, thresholds: { 9: [500, 2500], 10: [200, 1000], 11: [200, 1000], 12: [100, 500], 13: [50, 250], 14: [20, 100] }, contourLayer: "contours", elevationKey: "ele", levelKey: "level", extent: 4096, buffer: 1 })],
          maxzoom: 15,
        },
      };
    } catch (e) {
      console.warn("Contours unavailable", e);
    }
  }
  return { source: { type: "raster-dem", tiles: [url], encoding: "terrarium", tileSize: 256, maxzoom: 12 } };
}

function bboxOf(huc) {
  const m = DATA.sheds.find((x) => x.huc8 === huc);
  const b = m.view || m.bbox;
  return [[b[0], b[1]], [b[2], b[3]]];
}

// Watershed shading: how much network-aware planning adds over ranking at the current budget.
const gainKey = () => `g${state.bi}`;
function hucFillColor() {
  return ["interpolate", ["linear"], ["coalesce", ["get", gainKey()], 0], 0, "#7b878a", 0.02, "#b9d6ea", 0.15, "#5aa3d6", 0.5, "#1c6aa8"];
}
function hucFillOpacity() {
  return ["case", ["==", ["get", "huc8"], state.huc], 0, ["interpolate", ["linear"], ["coalesce", ["get", gainKey()], 0], 0, 0.06, 0.02, 0.2, 0.5, 0.45]];
}
function decorateHucs() {
  const byHuc = new Map(DATA.sheds.map((x) => [x.huc8, x]));
  for (const f of DATA.hucGeo.features) {
    const m = byHuc.get(f.properties.huc8);
    if (!m || !m.opt) continue;
    m.opt.forEach((o, i) => { f.properties[`g${i}`] = Math.max(0, (o - m.rank[i]) / Math.max(m.rank[i], 1)); });
  }
}

function addDataLayers() {
  const empty = { type: "FeatureCollection", features: [] };
  map.addSource("huc", { type: "geojson", data: DATA.hucGeo });
  map.addSource("streams", { type: "geojson", data: empty });
  map.addSource("links", { type: "geojson", data: empty });
  map.addSource("culverts", { type: "geojson", data: empty });
  map.addSource("sel", { type: "geojson", data: empty });
  const before = "labels-place";
  map.addLayer({ id: "huc-fill", type: "fill", source: "huc", paint: { "fill-color": hucFillColor(), "fill-opacity": hucFillOpacity() } }, before);
  map.addLayer({ id: "huc-line", type: "line", source: "huc", paint: { "line-color": "#3c4a4e", "line-width": 0.8, "line-opacity": 0.6 } }, before);
  map.addLayer({ id: "huc-sel", type: "line", source: "huc", filter: ["==", ["get", "huc8"], state.huc], paint: { "line-color": "#1e292d", "line-width": 2.4 } }, before);
  const w = (base) => ["interpolate", ["linear"], ["zoom"], 8, ["*", base, ["interpolate", ["linear"], ["get", "o"], 1, 0.35, 6, 1.4]], 13, ["*", base * 2.2, ["interpolate", ["linear"], ["get", "o"], 1, 0.6, 6, 2.2]]];
  map.addLayer({ id: "streams-base", type: "line", source: "streams", layout: { "line-cap": "round" }, paint: { "line-color": "#86b7d8", "line-width": w(0.8), "line-opacity": 0.5 } }, before);
  map.addLayer({ id: "streams-baseonly", type: "line", source: "streams", filter: ["in", ["get", "net"], ["literal", []]], layout: { "line-cap": "round" }, paint: { "line-color": "#9a6b43", "line-width": w(2.2), "line-dasharray": [1.2, 1] } }, before);
  map.addLayer({ id: "streams-glow", type: "line", source: "streams", filter: ["in", ["get", "net"], ["literal", []]], layout: { "line-cap": "round" }, paint: { "line-color": "#5fb3e4", "line-width": w(7), "line-blur": 5, "line-opacity": 0.6 } }, before);
  map.addLayer({ id: "streams-open", type: "line", source: "streams", filter: ["in", ["get", "net"], ["literal", []]], layout: { "line-cap": "round" }, paint: { "line-color": "#156ead", "line-width": w(3) } }, before);
  map.addLayer({ id: "streams-flow", type: "line", source: "streams", filter: ["in", ["get", "net"], ["literal", []]], paint: { "line-color": "#e9f6ff", "line-width": w(0.9), "line-dasharray": [0, 4, 3] } }, before);
  map.addLayer({ id: "links", type: "line", source: "links", paint: { "line-color": ["case", ["get", "open"], "#1c7fc1", "#8e948d"], "line-width": ["case", ["get", "open"], 2.4, 1], "line-dasharray": [2, 1.5] } }, before);
  map.addLayer({
    id: "culverts", type: "circle", source: "culverts",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, ["+", 2.2, ["*", 0.5, ["sqrt", ["get", "up"]]]], 13, ["+", 5, ["*", 1.4, ["sqrt", ["get", "up"]]]]],
      "circle-color": ["match", ["get", "s"], "plan", "#1c7fc1", "both", "#1c7fc1", "base", "#ffffff", "#8e948d"],
      "circle-stroke-color": ["match", ["get", "s"], "base", "#9a6b43", "both", "#9a6b43", "#ffffff"],
      "circle-stroke-width": ["match", ["get", "s"], "base", 2.4, "both", 2.4, "plan", 1.6, 0.8],
      "circle-opacity": ["match", ["get", "s"], "none", 0.85, 1],
    },
  });
  map.addLayer({ id: "sel", type: "circle", source: "sel", paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#1e292d", "circle-stroke-width": 2 } });

  map.on("click", "culverts", (e) => selectCulvert(e.features[0].properties.id, false));
  map.on("mouseenter", "culverts", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "culverts", () => (map.getCanvas().style.cursor = ""));
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "huc-tip", offset: 8 });
  map.on("mousemove", "huc-fill", (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: ["culverts"] }).length) { tip.remove(); return; }
    const h = e.features[0].properties.huc8;
    const m = DATA.sheds.find((x) => x.huc8 === h);
    if (!m) return;
    const o = m.opt[state.bi], q = m.rank[state.bi];
    const g = q > 0 ? Math.round(((o - q) / q) * 100) : 0;
    const what = o - q > 0.05 ? `Network planning adds ${(o - q).toFixed(1)} river miles at ${money(budgetUsd())} (${q.toFixed(1)} → ${o.toFixed(1)}${q > 0 ? `, +${g}%` : ""}).` : `At ${money(budgetUsd())}, ranking one at a time does as well here (${o.toFixed(1)} mi).`;
    tip.setLngLat(e.lngLat).setHTML(`<b>${esc(m.name)}</b>, ${m.n} assessed culverts<br>${what}${h !== state.huc ? "<br><span class=\"tip-hint\">Click to open</span>" : ""}`).addTo(map);
  });
  map.on("mouseleave", "huc-fill", () => tip.remove());
  map.on("click", "huc-fill", (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: ["culverts"] }).length) return;
    const h = e.features[0].properties.huc8;
    if (h !== state.huc) setState({ huc: h }, { fit: true });
  });
  animateFlow();
}

function animateFlow() {
  if (reduceMotion) return;
  const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
  let i = 0;
  setInterval(() => {
    if (!map.getLayer("streams-flow") || document.hidden) return;
    map.setPaintProperty("streams-flow", "line-dasharray", seq[i]);
    i = (i + 1) % seq.length;
  }, 70);
}

async function loadStreams(huc) {
  if (streamsLoaded === huc) return;
  streamsLoaded = huc;
  const has = DATA.streamManifest?.hucs?.includes(huc);
  const gj = has ? await getJSON(`./data/streams/streams_${huc}.geojson`, true) : null;
  if (streamsLoaded !== huc) return;
  map.getSource("streams").setData(gj || { type: "FeatureCollection", features: [] });
  DATA.hasStreams = !!gj;
  renderMap(compute());
}

function renderMap(r) {
  if (!map || !map.getSource("culverts")) return;
  const { s, planSet, baseSet, plan, base } = r;
  const show = state.showBase;
  const feats = s.recs.map((d) => {
    const inP = planSet.has(d.id), inB = show && baseSet.has(d.id);
    return { type: "Feature", geometry: { type: "Point", coordinates: [d.lon, d.lat] }, properties: { id: d.id, up: d.up, s: inP && inB ? "both" : inP ? "plan" : inB ? "base" : "none" } };
  });
  feats.sort((a, b) => ({ none: 0, base: 1, both: 2, plan: 2 })[a.properties.s] - ({ none: 0, base: 1, both: 2, plan: 2 })[b.properties.s]);
  map.getSource("culverts").setData({ type: "FeatureCollection", features: feats });
  const open = [...plan.open];
  const baseOnly = show ? [...base.open].filter((x) => !plan.open.has(x)) : [];
  for (const id of ["streams-glow", "streams-open", "streams-flow"]) map.setFilter(id, ["in", ["get", "net"], ["literal", open]]);
  map.setFilter("streams-baseonly", ["in", ["get", "net"], ["literal", baseOnly]]);
  map.setFilter("huc-sel", ["==", ["get", "huc8"], state.huc]);
  map.setPaintProperty("huc-fill", "fill-color", hucFillColor());
  map.setPaintProperty("huc-fill", "fill-opacity", hucFillOpacity());
  const links = DATA.hasStreams ? [] : s.recs.filter((d) => d.parent && s.byId.has(d.parent)).map((d) => {
    const p = s.byId.get(d.parent).rec;
    return { type: "Feature", geometry: { type: "LineString", coordinates: [[d.lon, d.lat], [p.lon, p.lat]] }, properties: { open: plan.open.has(d.id) } };
  });
  map.getSource("links").setData({ type: "FeatureCollection", features: links });
  const sel = state.selected && s.byId.get(state.selected);
  map.getSource("sel").setData({ type: "FeatureCollection", features: sel ? [{ type: "Feature", geometry: { type: "Point", coordinates: [sel.rec.lon, sel.rec.lat] }, properties: {} }] : [] });
}

/* ---------- culvert sheet ---------- */
function sheetHTML(r, id) {
  const { s, planSet, baseSet, plan } = r;
  const d = s.byId.get(id);
  const rec = d.rec;
  const order = [...s.items].sort((a, b) => soloScore(s, state.lam)(b) - soloScore(s, state.lam)(a));
  const rank = order.findIndex((x) => x.id === id) + 1;
  const desc = [];
  const stack = [...(s.children.get(id) || [])];
  while (stack.length) { const c = stack.pop(); desc.push(c); stack.push(...(s.children.get(c) || [])); }
  const unlocked = desc.filter((c) => plan.open.has(c));
  const unlockedMiles = unlocked.reduce((t, c) => t + s.byId.get(c).habitat, 0);
  const lines = [];
  const root = s.byId.get(rec.root);
  const capNote = root && root.anchor != null && root.anchor < d.habitat
    ? ` The river below it runs only ${root.anchor.toFixed(1)} mi before the next ${esc(root.rec.anchorKind === "dam" ? "dam" : root.rec.anchorKind === "waterfall" ? "waterfall" : "barrier")}, so it counts for at most that much.`
    : "";
  if (planSet.has(id)) {
    lines.push(`<span class="tag tag-plan">In the network-aware plan</span>`);
    if (plan.open.has(id)) lines.push(`Reopens ${d.habitat.toFixed(1)} mi above it${unlocked.length ? `, and is the way through to ${unlocked.length} more replaced culvert${unlocked.length > 1 ? "s" : ""} (${unlockedMiles.toFixed(1)} mi)` : ""}.${capNote}`);
    if (plan.open.has(id) && d.parent && s.byId.has(d.parent)) lines.push(`That counts only because the culvert just below it, on ${esc(streamName(s.byId.get(d.parent).rec))}, is replaced too. Alone it would open ${rec.gain.toFixed(1)} mi.`);
    else lines.push("Chosen for flood risk. The river above stays cut off by a culvert below.");
  } else lines.push(`<span class="tag tag-none">Not in the network-aware plan</span>${capNote ? `<br>${capNote.trim()}` : ""}`);
  lines.push(`<span class="${baseSet.has(id) ? "tag tag-base" : ""}">Ranks #${rank} of ${s.items.length} on its own${baseSet.has(id) ? ", inside the one-at-a-time budget" : ""}.</span>`);
  if (!plan.open.has(id) && d.parent && baseSet.has(id) && !baseSet.has(d.parent)) lines.push(`Ranked alone, it would be replaced while the culvert below it stays, so fish from the river still cannot reach it.`);
  const st = state.stress;
  if (st && st.key === stressKey() && planSet.has(id)) lines.push(`Chosen in ${Math.round((st.freq.get(id) || 0) * 100)}% of 60 cost scenarios.`);
  const bars = (v) => `<span class="flood-bar">${[0.2, 0.4, 0.6, 0.8, 1].map((t) => `<i class="${v >= t - 1e-9 ? "on" : ""}"></i>`).join("")}</span>`;
  const [fc, fl, fq] = rec.floodParts;
  return `<div class="sheet">
    <div class="sheet-head"><div class="sheet-stream">${esc(streamName(rec))}</div>
      <div class="sheet-road">${esc(rec.road || "Unnamed road")}${rec.roadType && rec.roadType !== "Unknown" ? ` (${esc(rec.roadType.toLowerCase())})` : ""}${rec.county ? `, ${esc(rec.county)} County` : ""}</div></div>
    <div class="sheet-status">${lines.join("<br>")}</div>
    <dl>
      <dt>Field assessment</dt><dd>${esc(rec.severity)}</dd>
      <dt>Constriction</dt><dd>${esc(rec.constriction || "Unknown")}</dd>
      <dt>Drainage area</dt><dd>${rec.daSqKm != null ? `${(rec.daSqKm / 2.59).toFixed(2)} sq mi` : "Unknown"}</dd>
      <dt>River above it</dt><dd>${rec.up.toFixed(1)} mi</dd>
      <dt>River below it</dt><dd>${rec.down.toFixed(1)} mi</dd>
      <dt>Washout risk</dt><dd>${bars(rec.flood)} ${rec.flood.toFixed(2)}</dd>
      <dt>Planning cost</dt><dd>${money(rec.cost)} <span style="color:var(--muted);font-weight:400">(${money(rec.cost * 0.44)}–${money(rec.cost * 2.28)})</span></dd>
    </dl>
    <div class="sheet-foot"><span class="sheet-formula">Washout risk = squeeze ${fc.toFixed(2)} × flow ${fl.toFixed(2)} × road ${fq.toFixed(2)}</span>${rec.url ? `<a href="${esc(rec.url)}" target="_blank" rel="noopener">Open the inventory record</a>` : ""}</div>
  </div>`;
}

function selectCulvert(id, fly) {
  state.selected = id;
  const r = compute();
  const d = r.s.byId.get(id);
  if (!d) return;
  if (popup) popup.remove();
  popup = new maplibregl.Popup({ maxWidth: "320px", offset: 12, focusAfterOpen: false })
    .setLngLat([d.rec.lon, d.rec.lat]).setHTML(sheetHTML(r, id)).addTo(map);
  popup.on("close", () => { if (state.selected === id) { state.selected = null; renderMap(compute()); } });
  if (fly) map.flyTo({ center: [d.rec.lon, d.rec.lat], zoom: Math.max(map.getZoom(), 12.2), offset: [0, -170], duration: reduceMotion ? 0 : 1200 });
  renderMap(r);
}

/* ---------- cost stress test ---------- */
const stressKey = () => `${state.huc}|${state.bi}|${state.lam}`;
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function runStress() {
  const key = stressKey();
  const s = shed(state.huc);
  const units = budgetUnits();
  const rnd = mulberry32(20261003);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const N = 60;
  const freq = new Map();
  let wins = 0, ties = 0, done = 0;
  const btn = $("#stress");
  btn.disabled = true;
  const step = () => {
    if (stressKey() !== key) { btn.disabled = false; return; }
    for (let j = 0; j < 4 && done < N; j++, done++) {
      const items = s.items.map((d) => ({ ...d, cost: Math.max(1, Math.round((d.rec.cost * Math.exp(0.5 * gauss())) / UNIT)) }));
      const p = evaluate(items, solve(items, units, state.lam).plan(units));
      const b = evaluate(items, rankPlan(items, units, soloScore(s, state.lam)));
      for (const id of p.open) freq.set(id, (freq.get(id) || 0) + 1);
      const vp = (1 - state.lam) * p.miles / s.H + state.lam * p.flood / s.F;
      const vb = (1 - state.lam) * b.miles / s.H + state.lam * b.flood / s.F;
      if (vp > vb + 1e-12) wins++; else if (Math.abs(vp - vb) <= 1e-12) ties++;
    }
    $("#stress-out").textContent = `Scenario ${done} of ${N}…`;
    if (done < N) return setTimeout(step, 0);
    for (const [k, v] of freq) freq.set(k, v / N);
    const r = compute();
    const robust = [...r.planSet].filter((id) => (freq.get(id) || 0) >= 0.8).length;
    const summary = `Beat ranking in ${wins} of ${N} cost scenarios${ties ? ` (tied in ${ties})` : ""}. ${robust} of ${r.planSet.size} picks stayed in the plan in at least 80% of them${robust < r.planSet.size / 2 ? ", so get real costs before committing to specific culverts" : ""}.`;
    state.stress = { key, freq, wins, summary };
    btn.disabled = false;
    renderPanel(r);
  };
  step();
}

/* ---------- export ---------- */
function exportPlan() {
  const r = compute();
  const { s, planIds, plan, baseSet } = r;
  const cols = ["order", "inventory_id", "stream", "road", "road_type", "county", "lat", "lon", "field_assessment", "constriction",
    "drainage_sq_mi", "river_above_mi", "river_below_mi", "reconnects_to_river_below", "in_one_at_a_time_plan", "planning_cost_usd",
    "cost_low_usd", "cost_high_usd", "washout_score", "inventory_url"];
  const q = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = planIds.map((id, i) => {
    const d = s.byId.get(id).rec;
    return [i + 1, d.id, streamName(d), d.road || "", d.roadType || "", d.county || "", d.lat, d.lon, d.severity, d.constriction || "",
      d.daSqKm != null ? (d.daSqKm / 2.59).toFixed(3) : "", d.up, d.down, plan.open.has(id) ? "yes" : "no", baseSet.has(id) ? "yes" : "no",
      d.cost, Math.round(d.cost * 0.44), Math.round(d.cost * 2.28), d.flood, d.url || ""].map(q).join(",");
  });
  const meta = `# Pinchpoint plan: ${s.meta.name} (HUC8 ${s.huc}), budget ${money(budgetUsd())}, ${lamLabel(state.lam)}. River reconnected ${plan.miles.toFixed(1)} mi; washout risk removed ${pct(plan.flood / s.F)}. Planning-level costs; see README.`;
  const blob = new Blob([[meta, cols.join(","), ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pinchpoint_${s.meta.name.replace(/\W+/g, "_").toLowerCase()}_${BUDGETS[state.bi]}M.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- state ---------- */
function setState(patch, opts = {}) {
  const hucChanged = patch.huc && patch.huc !== state.huc;
  Object.assign(state, patch);
  if (hucChanged) { state.selected = null; if (popup) popup.remove(); }
  $("#shed").value = state.huc;
  $("#budget").value = state.bi;
  $("#lam").value = Math.round(state.lam * 10);
  $("#show-base").checked = state.showBase;
  const r = compute();
  renderPanel(r);
  renderMap(r);
  if (hucChanged && map) loadStreams(state.huc);
  if (opts.fit && map) map.fitBounds(bboxOf(state.huc), { padding: 40, duration: reduceMotion ? 0 : 900 });
  history.replaceState(null, "", `#huc=${state.huc}&b=${BUDGETS[state.bi]}&p=${state.lam}`);
  return r;
}

/* ---------- tour ---------- */
// The pair the one-at-a-time ranking skips: an upper culvert in the plan whose lower culvert is
// also in the plan, where neither makes the ranking's cut.
function keystone(r) {
  const { s, plan, baseSet } = r;
  let best = null;
  for (const id of plan.open) {
    const d = s.byId.get(id);
    if (!d.parent || !plan.open.has(d.parent) || baseSet.has(id)) continue;
    if (!best || d.habitat > best.d.habitat) best = { id, d, lower: s.byId.get(d.parent) };
  }
  return best;
}

function milesAt(huc, lam, bi) {
  const s = shed(huc);
  const u = Math.round((BUDGETS[bi] * 1e6) / UNIT);
  return evaluate(s.items, solution(s, lam).plan(u));
}

const PIGEON = "06010106";
const TOUR = [
  {
    target: "#map",
    text: () => "This is the Upper French Broad around Asheville, where Helene hit hardest. Each dot is a culvert that field crews assessed as a barrier to fish.",
    run: () => setState({ huc: SHOWCASE, bi: 7, lam: 0, showBase: false }, { fit: true }),
  },
  {
    target: "#results",
    text: (r) => `With $2M, funding the best-scoring culverts one at a time reconnects ${r.base.miles.toFixed(1)} river miles (brown rings). Planning across the network reaches ${r.plan.miles.toFixed(1)} for the same money.`,
    run: () => setState({ showBase: true }),
  },
  {
    target: "#map",
    text: (r) => {
      const k = keystone(r);
      if (!k) return "Click any culvert to see why it was or wasn't chosen.";
      return `Next door in the Pigeon watershed near Canton: two culverts in a row on ${streamName(k.d.rec)}. Alone, each opens only ${k.lower.rec.gain.toFixed(1)} miles, so ranking skips both. Replace both and ${(k.d.habitat + k.lower.habitat).toFixed(1)} miles reconnect. Here $1M goes from ${r.base.miles.toFixed(1)} to ${r.plan.miles.toFixed(1)} river miles.`;
    },
    run: () => {
      if (popup) popup.remove();
      const r = setState({ huc: PIGEON, bi: 3, lam: 0, showBase: true }, { fit: true });
      const k = keystone(r);
      if (k) setTimeout(() => selectCulvert(k.id, true), reduceMotion ? 0 : 950);
    },
  },
  {
    target: "#lam-field",
    text: () => {
      const roads = milesAt(SHOWCASE, 1, 13), rivers = milesAt(SHOWCASE, 0, 13), mix = milesAt(SHOWCASE, 0.7, 13);
      return `Now plan for roads too. Back in the Upper French Broad with $5M, a plan for washout risk alone reconnects ${roads.miles.toFixed(0)} river miles instead of ${rivers.miles.toFixed(0)}. Weighted 70/30 toward roads, the plan keeps ${Math.round((mix.miles / rivers.miles) * 100)}% of the river gain and ${Math.round((mix.flood / roads.flood) * 100)}% of the washout reduction.`;
    },
    run: () => { if (popup) popup.remove(); setState({ huc: SHOWCASE, bi: 13, lam: 0.7, showBase: true }, { fit: true }); },
  },
  {
    target: "#open-methods-2",
    text: () => "Every number is checked: the stream networks against the inventory, the optimizer against brute force, the result against cost uncertainty. Methods has the details, including where ranking one at a time does just as well.",
  },
];
let tourAt = -1;
function showTour(i) {
  document.querySelectorAll(".spot").forEach((n) => n.classList.remove("spot"));
  if (i < 0 || i >= TOUR.length) { $("#tour").hidden = true; tourAt = -1; return; }
  tourAt = i;
  const step = TOUR[i];
  let r = compute();
  if (step.run) { const out = step.run(r); r = compute(); }
  $("#tour-step").textContent = `${i + 1} of ${TOUR.length}`;
  $("#tour-text").textContent = step.text(r);
  $("#tour-back").disabled = i === 0;
  $("#tour-next").textContent = i === TOUR.length - 1 ? "Finish" : "Next";
  const box = $("#tour");
  box.hidden = false;
  const t = document.querySelector(step.target);
  const rect = t.getBoundingClientRect();
  if (step.target !== "#map") t.classList.add("spot");
  if (rect.left < 420 && step.target !== "#map") {
    box.style.left = `${Math.min(rect.right + 16, innerWidth - 350)}px`;
    box.style.top = `${Math.max(12, Math.min(rect.top, innerHeight - box.offsetHeight - 12))}px`;
    box.style.right = "auto";
  } else {
    box.style.left = "auto";
    box.style.right = "16px";
    box.style.top = "64px";
  }
  $("#tour-next").focus();
}

/* ---------- methods ---------- */
function methodsHTML() {
  const S = DATA.summary || {};
  const b2 = S.by_budget?.["$2M per watershed"];
  const b5 = S.by_budget?.["$5M per watershed"];
  const mc = S["cost_monte_carlo_$5M"];
  const v = DATA.validation || {};
  const par = S["showcase_pareto_$5M"] || [];
  const p0 = par[0], p5 = par.find((x) => x.lam === 0.5), p10 = par[par.length - 1];
  return `
  <h2 id="methods-title">How Pinchpoint decides</h2>
  <p>Each assessed culvert splits a river into the stretch above it and the stretch below. The inventory scores a single culvert by its gain: the smaller of the two, min(upstream, downstream) miles. Fish from below can only use what lies above, and only as much as the population below can fill. Pinchpoint uses the same rule for bundles. A chain of culverts hangs from an anchor, the river below its lowest culvert, bounded by a dam, a waterfall or the outlet. Replacing culverts reconnects the miles above every culvert whose path down to the anchor is fully open, capped at the anchor's length. For one culvert this is exactly the inventory's gain.</p>
  <p class="formula">maximize (1 − λ) · river reconnected ⁄ best possible + λ · washout risk removed ⁄ total, subject to cost ≤ budget</p>
  <p>The optimizer is exact. Chains where the cap cannot bind use a dynamic program with two states per culvert: whether the river below it is open or closed. Chains where it can bind (44 in North Carolina, at most 15 culverts) are enumerated. The chains are combined with max-plus convolutions, so one pass gives the best plan for every budget up to $20M. This runs in your browser, so the sliders are live.</p>
  <p>The comparison is how barriers are usually ranked: score each culvert on its own (its gain, plus its flood score when weighted) and fund down the list until the money runs out.</p>

  <h3>Checks</h3>
  <ul class="checks">
    <li><b>244 / 244</b><span>Culvert-to-culvert links where the inventory's downstream network length equals the parent's upstream length. The tree is reconstructed exactly. Links to dams differ because the inventory measures dam networks with dams alone.</span></li>
    <li><b>300 / 300</b><span>Random networks (up to 11 culverts, all budgets and weights) where the optimizer matches brute-force enumeration. The browser solver matches the same answers in 200 / 200.</span></li>
    ${v.within5 != null ? `<li><b>${Math.round(v.within5 * 100)}%</b><span>Culverts in ${v.hucs.length} mountain watersheds (n = ${v.n}) whose upstream miles, rebuilt from raw USGS NHDPlus HR flowlines, fall within 5% of the inventory's value. Median error ${v.medianErr.toFixed(1)}%. These rebuilt networks are the river lines on the map. Most misses sit above waterfalls, which the public data leaves out.</span></li>` : ""}
    ${mc ? `<li><b>${Math.round(mc.share_draws_optimal_better_than_rank_gain * 200)} / 200</b><span>Cost scenarios (each culvert's cost multiplied by a lognormal factor, σ = 0.5) in which the network-aware plans reconnect more river statewide than one-at-a-time ranking at $5M per watershed.</span></li>` : ""}
  </ul>

  <h3>What we found, without the hype</h3>
  <ul>
    <li>Network planning matters where culverts sit in chains. On Cherry Creek near Canton, two culverts in a row each open only 1.4 miles alone, so ranking skips both. Together they reconnect 8.2 miles, and $1M in the Pigeon watershed goes from 7.2 to 12.6 river miles (+75%). On Whiteoak Creek in the Upper Little Tennessee, two culverts that each score zero on their own open 9.6 miles together. Ranking one at a time can never find that pair.</li>
    ${b5 ? `<li>Most of North Carolina has few chains, and there ranking does nearly as well. Across the ${S.watersheds} watersheds with at least 15 assessed culverts, the network-aware plans reconnect ${b5.miles_optimal} miles vs ${b5.miles_rank_gain} at $5M each (+${Math.round((b5.x_vs_rank_gain - 1) * 100)}%). In the Upper French Broad at $2M the gain is +18% (46.6 vs 39.6 miles).</li>` : ""}
    ${b5 ? `<li>Scored by the inventory's own gain rule applied to every merge, including joins between two isolated fragments, the plans are close: ${b5.inventory_gain_optimal} vs ${b5.inventory_gain_rank_gain} miles statewide at $5M. The advantage comes from reconnecting chains to the river below, not from fragment-to-fragment joins.</li>` : ""}
    ${p0 && p5 && p10 ? `<li>Rivers and roads trade off unevenly. At $5M in the Upper French Broad, a plan for washout risk alone reconnects ${Math.round((p10.miles / p0.miles) * 100)}% of the river miles a river plan would. A plan for rivers alone still removes ${Math.round((p0.flood / p10.flood) * 100)}% of the washout risk a roads plan would. Planning for both costs little on either side.</li>` : ""}
  </ul>

  <h3>Limits</h3>
  <ul>
    <li>Costs are planning-level estimates: a stream-width span from NC regional bankfull curves, times a per-foot price by road type, plus mobilization. Real costs come from engineering. The stress test and the cost scenarios above show how much the plan depends on them.</li>
    <li>The washout score is a screening index (constriction × drainage size × road type), not a failure probability. Helene's damaged-culvert locations are not public, so it has not been checked against real failures.</li>
    <li>Only culverts that field crews assessed are candidates: 800 statewide that cut the network. Most of NC's road crossings have never been surveyed.</li>
    <li>Dams and waterfalls are treated as permanent. Habitat is counted in miles, not by species or quality.</li>
  </ul>

  <h3>Data</h3>
  <ul>
    <li>National Aquatic Barrier Inventory &amp; Prioritization Tool (Southeast Aquatic Resources Partnership), public API, downloaded 3 Oct 2026.</li>
    <li>USGS NHDPlus High Resolution flowlines and Watershed Boundary Dataset.</li>
    <li>Basemap © OpenStreetMap contributors via OpenFreeMap; terrain from AWS Terrain Tiles (Mapzen).</li>
    <li>Gillespie et al. 2014, Flood effects on road–stream crossing infrastructure, <i>Fisheries</i> 39(2):62–76. Cote et al. 2009, A new measure of longitudinal connectivity for stream networks, <i>Landscape Ecology</i> 24:101–113.</li>
  </ul>`;
}

/* ---------- boot ---------- */
async function boot() {
  const [culverts, shedsMeta, summary, hucGeo, streamManifest, validation] = await Promise.all([
    getJSON("./data/culverts.json"), getJSON("./data/watersheds.json"), getJSON("./data/summary.json", true),
    getJSON("./data/huc8.geojson"), getJSON("./data/streams/manifest.json", true), getJSON("./data/validation.json", true),
  ]);
  Object.assign(DATA, { culverts, sheds: shedsMeta, summary, hucGeo, streamManifest, validation });
  decorateHucs();

  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("huc") && shedsMeta.some((x) => x.huc8 === hash.get("huc"))) state.huc = hash.get("huc");
  if (hash.get("b")) { const i = BUDGETS.indexOf(Number(hash.get("b"))); if (i >= 0) state.bi = i; }
  if (hash.get("p")) state.lam = Math.min(1, Math.max(0, Math.round(Number(hash.get("p")) * 10) / 10));

  $("#shed").innerHTML = shedsMeta.map((x) => `<option value="${x.huc8}">${esc(x.name)} (${x.n} culverts)</option>`).join("");
  $("#shed").addEventListener("change", (e) => setState({ huc: e.target.value }, { fit: true }));
  $("#budget").addEventListener("input", (e) => setState({ bi: Number(e.target.value) }));
  $("#lam").addEventListener("input", (e) => setState({ lam: Number(e.target.value) / 10 }));
  $("#show-base").addEventListener("change", (e) => setState({ showBase: e.target.checked }));
  $("#stress").addEventListener("click", runStress);
  $("#export").addEventListener("click", exportPlan);
  const openMethods = () => { $("#methods-body").innerHTML = methodsHTML(); $("#methods").showModal(); };
  $("#open-methods").addEventListener("click", openMethods);
  $("#open-methods-2").addEventListener("click", openMethods);
  $("#start-tour").addEventListener("click", () => showTour(0));
  $("#intro-tour").addEventListener("click", () => { $("#intro").hidden = true; showTour(0); });
  $("#intro-skip").addEventListener("click", () => { $("#intro").hidden = true; });
  $("#tour-next").addEventListener("click", () => showTour(tourAt + 1 < TOUR.length ? tourAt + 1 : -1));
  $("#tour-back").addEventListener("click", () => showTour(tourAt - 1));
  $("#tour-close").addEventListener("click", () => showTour(-1));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && tourAt >= 0) showTour(-1); });
  if (location.hash) $("#intro").hidden = true;

  setState({});
  map = new maplibregl.Map({
    container: "map", style: buildStyle(demConfig()), bounds: bboxOf(state.huc),
    fitBoundsOptions: { padding: 40 }, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true },
  });
  window.pinchpoint = { map, state, compute, select: (id) => selectCulvert(id, true) };
  map.on("error", (e) => console.warn("map error:", e.error?.message || e));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
  map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");
  map.on("load", () => {
    addDataLayers();
    renderMap(compute());
    loadStreams(state.huc);
  });
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML("beforeend", `<p style="position:fixed;bottom:12px;left:12px;background:#fff;padding:10px 14px;border:1px solid #c2372e;border-radius:6px">Pinchpoint could not load its data: ${esc(e.message)}. Serve the app folder over HTTP (for example <code>python -m http.server</code>) and reload.</p>`);
});
