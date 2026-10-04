// Cinematic flyover of one culvert: 3D satellite terrain, a flood cross-section, the river it
// cuts off traced upstream, the barrier below, the fix, and where it sits in the budget plan.
// Every sentence is assembled from the culvert's inventory record and the live plan.

const SAT = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
const DEM = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
const TOPO = ["shade", "contour", "wood", "urban", "water", "waterway", "road-minor", "road-major", "huc-fill", "streams-base", "links"];
const FOREST = "#2f4630"; // shows where satellite tiles haven't loaded yet
const AMBER = "#f5a524";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
const KEY = matchMedia("(hover: hover)").matches ? " (space)" : ""; // no keyboard hint on touch screens

/* ---------- words ---------- */
function prettyStream(r) {
  const n = (r.river || "").trim();
  if (!n || n === "Unknown") return "an unnamed creek";
  const m = n.match(/^ut\d*\s+(?:to\s+)?(.+)$/i);
  if (m) return `a small creek that feeds ${m[1]}`;
  if (/^ut/i.test(n)) return "an unnamed creek";
  return n;
}
function prettyRoad(r) {
  const n = (r.road || "").trim();
  if (!n || /^unnamed/i.test(n)) return "an unnamed road";
  let m;
  if ((m = n.match(/^fs\s*r?\s*(\w+)/i))) return `Forest Service Road ${m[1]}`;
  if ((m = n.match(/^us\s*(\d+\w*)/i))) return `US ${m[1]}`;
  if ((m = n.match(/^nc\s*(\d+\w*)/i))) return `NC ${m[1]}`;
  if (/^\d+\w*$/.test(n)) return `Road ${n}`;
  return n;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mi = (x) => (x < 0.05 ? "less than a tenth of a mile" : x >= 100 ? `${Math.round(x).toLocaleString("en-US")} miles` : `${x.toFixed(1)} miles`);
const RATIO = { Severe: 0.4, Moderate: 0.75, Minor: 0.9, "Spans only bankfull/active channel": 1.0, "Spans full channel & banks": 1.2 };
const RATIO_NOTE = {
  Severe: "Pipe drawn from the field rating: severe means the opening is less than half the stream's width.",
  Moderate: "Pipe drawn from the field rating: moderate means the opening is between half and the full width of the stream.",
  Minor: "Pipe drawn from the field rating: minor means the opening is only slightly narrower than the stream.",
  "Spans only bankfull/active channel": "Field rating: the opening is about as wide as the stream.",
  "Spans full channel & banks": "Field rating: the opening is wider than the stream.",
};
function severityPlain(s) {
  if (s === "Complete barrier") return "found that fish can't get through it at all";
  if (s === "Moderate barrier") return "found that most fish can't get through it";
  return "found that it blocks fish, though they didn't record how badly";
}
function widthPlain(c) {
  if (c === "Severe") return "The pipe is less than half as wide as the stream.";
  if (c === "Moderate") return "The pipe is narrower than the stream.";
  if (c === "Minor") return "The pipe is a little narrower than the stream.";
  if (c && /Spans/.test(c)) return "The pipe is about as wide as the stream, but it still blocks fish.";
  return "They didn't measure how much narrower the pipe is than the stream.";
}

/* ---------- geometry ---------- */
const toRad = (d) => (d * Math.PI) / 180;
function bearing(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function km(a, b) {
  const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
// Main stem upstream of a culvert: start at the stretch ending nearest the culvert, then keep
// stepping to the largest tributary that flows into the upstream end.
function upstreamPath(gj, id, at) {
  if (!gj) return null;
  const segs = gj.features.filter((f) => f.properties.net === id && f.geometry.type === "LineString");
  if (!segs.length) return null;
  const key = (c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
  const len = segs.map((f) => f.geometry.coordinates.reduce((t, c, i, a) => t + (i ? km(a[i - 1], c) : 0), 0));
  const byEnd = new Map();
  segs.forEach((f, i) => { const k = key(f.geometry.coordinates.at(-1)); if (!byEnd.has(k)) byEnd.set(k, []); byEnd.get(k).push(i); });
  let cur = 0, bd = Infinity;
  segs.forEach((f, i) => { const e = f.geometry.coordinates.at(-1); const d = (e[0] - at[0]) ** 2 + (e[1] - at[1]) ** 2; if (d < bd) { bd = d; cur = i; } });
  const path = [at], used = new Set();
  while (cur != null && !used.has(cur)) {
    used.add(cur);
    const c = segs[cur].geometry.coordinates;
    for (let j = c.length - 1; j >= 0; j--) path.push(c[j]);
    const next = (byEnd.get(key(c[0])) || []).filter((i) => !used.has(i));
    cur = next.length ? next.sort((a, b) => (segs[b].properties.o - segs[a].properties.o) || (len[b] - len[a]))[0] : null;
  }
  const out = [path[0]];
  for (const p of path.slice(1)) if (km(out.at(-1), p) > 0.005) out.push(p);
  const total = out.reduce((t, c, i, a) => t + (i ? km(a[i - 1], c) : 0), 0);
  return total > 0.25 ? { coords: out, km: total } : null;
}
function along(coords, f) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + km(coords[i - 1], coords[i]));
  const t = cum.at(-1) * f;
  const i = cum.findIndex((c) => c >= t);
  if (i <= 0) return coords[0];
  const r = (t - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
  return [coords[i - 1][0] + r * (coords[i][0] - coords[i - 1][0]), coords[i - 1][1] + r * (coords[i][1] - coords[i - 1][1])];
}

/* ---------- camera ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// With 3D terrain the camera must aim at the ground, not at sea level, or the subject drifts to
// the top of the screen. MapLibre doesn't update that height after scripted moves, and setting it
// mid-animation cancels the animation. So set it to the destination's ground before each move,
// then ease out any leftover difference once the camera is still.
const hasTerrain = (map) => !!(map.getTerrain && map.getTerrain() && map.setCenterElevation);
function groundAt(map, lngLat) {
  const e = map.queryTerrainElevation ? map.queryTerrainElevation(lngLat) : null;
  return e != null && Number.isFinite(e) ? e : null;
}
function settle(map) {
  return new Promise((res) => {
    if (!hasTerrain(map)) return res();
    const g = groundAt(map, map.getCenter());
    const from = map.getCenterElevation();
    if (g == null || Math.abs(g - from) < 15) return res();
    const t0 = performance.now(), ms = reduceMotion ? 0 : 500;
    const step = () => {
      if (map.isMoving()) return res();
      const k = ms ? Math.min(1, (performance.now() - t0) / ms) : 1;
      map.setCenterElevation(from + (g - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
function move(map, kind, opts) {
  return new Promise((res) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(t); setTimeout(() => settle(map).then(res), 0); };
    const t = setTimeout(finish, (opts.duration || 0) + 1500);
    const o = { ...opts, duration: reduceMotion ? 0 : opts.duration, essential: true };
    if (o.center && hasTerrain(map)) { const g = groundAt(map, o.center); if (g != null) map.setCenterElevation(g); }
    map.once("moveend", finish);
    if (kind === "fitBounds") { const { bounds, ...rest } = o; map.fitBounds(bounds, rest); } else map[kind](o);
  });
}

/* ---------- narration ---------- */
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => /^en(-|_)US/i.test(v.lang));
  voice = vs.find((v) => /natural|neural/i.test(v.name) && /aria|jenny|guy|ava|andrew|emma|brian/i.test(v.name))
    || vs.find((v) => /natural|neural/i.test(v.name)) || vs.find((v) => /google us english/i.test(v.name)) || vs[0] || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, on) {
  return new Promise((res) => {
    if (!on || !("speechSynthesis" in window)) return res();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.0;
    // Some machines have no voices and never fire "end"; never let narration stall the flyover.
    const guard = setTimeout(res, 2500 + (text.split(/\s+/).length / 2.4) * 1000);
    u.onend = () => { clearTimeout(guard); res(); };
    u.onerror = () => { clearTimeout(guard); res(); };
    speechSynthesis.speak(u);
  });
}

/* ---------- labeled pins ---------- */
function pin(map, at, label, kind) {
  const el = document.createElement("div");
  el.className = `cine-pin cine-pin--${kind}`;
  el.innerHTML = `<span class="cine-pin-label"></span><i class="cine-pin-dot"></i>`;
  el.querySelector(".cine-pin-label").textContent = label;
  // Stay fully visible even when a ridge sits between the camera and the pin.
  return new window.maplibregl.Marker({ element: el, anchor: "bottom", opacity: "1", opacityWhenCovered: "1" }).setLngLat(at).addTo(map);
}

/* ---------- the flyover ---------- */
export async function startFlyover(ctx) {
  const { map, rec, money } = ctx;
  const at = [rec.lon, rec.lat];
  const stream = prettyStream(rec);
  const road = prettyRoad(rec);
  const bankfull = Math.max(4, Math.round(((rec.spanFt || 20) - 2) / 1.2));
  const ratio = RATIO[rec.constriction] ?? 0.6;
  const daMi = rec.daSqKm != null ? rec.daSqKm / 2.59 : null;
  const path = upstreamPath(ctx.streams, rec.id, at);
  const P = ctx.plan;
  const view0 = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
  const belowNet = P.parent ? P.parent.id : rec.anchorId;
  const belowAt = P.parent ? [P.parent.lon, P.parent.lat] : rec.anchorXY;
  const belowLabel = P.parent ? "Next blocking culvert" : rec.anchorKind === "waterfall" ? "Waterfall" : rec.anchorXY ? `Dam${rec.anchorName ? `: ${rec.anchorName}` : ""}` : null;
  const credit = Math.min(rec.up, rec.anchorMiles);
  const marks = [];

  /* captions: short sentences, plain words, every number from the data */
  const helene = rec.slides2mi > 0
    ? `After Hurricane Helene, scientists mapped ${rec.slides2mi} ${rec.slides2mi === 1 ? "landslide" : "landslides"} within two miles of this spot.`
    : rec.slideMi != null && rec.slideMi < 15 ? `The closest landslide mapped after Hurricane Helene is ${rec.slideMi.toFixed(1)} miles away.` : "";
  const ups = P.upstream || [];
  const scenes = [
    {
      title: "Where we are",
      say: `This is ${stream}${rec.county ? ` in ${rec.county} County, North Carolina` : ""}. ${helene}`,
      facts: [["County", rec.county || "—"], ["Watershed", ctx.shedName], ["Land draining to this spot", daMi != null ? `${daMi.toFixed(2)} sq mi` : "—"], ["Helene landslides within 2 mi", rec.slides2mi ?? "—"]],
      run: async () => { await move(map, "flyTo", { center: at, zoom: 12.4, pitch: 50, bearing: -20, duration: 5200, curve: 1.6 }); },
    },
    {
      title: "The problem crossing",
      say: `Here, ${road} crosses the creek. Under the road, the water squeezes through a pipe called a culvert. ${rec.surveyed ? `In ${rec.surveyed}, a` : "A"} field crew inspected it and ${severityPlain(rec.severity)}. ${widthPlain(rec.constriction)}`,
      facts: [["What the crew found", rec.severity || "—"], ["How narrow the pipe is", rec.constriction || "Not measured"], ["Road surface", rec.roadType || "—"], ["Inventory ID", rec.id]],
      pulse: true,
      run: async () => {
        await move(map, "flyTo", { center: at, zoom: 14.1, pitch: 52, bearing: 10, duration: 4200 });
        if (!reduceMotion) await move(map, "easeTo", { bearing: 70, duration: 7000, easing: (t) => t });
      },
    },
    {
      title: "Why it fails",
      say: `In a big storm, more water arrives than the pipe can carry. It backs up behind the road, spills over it, and can wash the road away. That's how many roads failed during Helene. On normal days, water shoots through the narrow pipe too fast for fish to swim up. This creek is about ${bankfull} feet wide${RATIO[rec.constriction] ? `, and the pipe is about ${Math.round(ratio * bankfull)} feet` : ""}.`,
      facts: [["Creek width (estimated)", `${bankfull} ft`], ["Pipe opening (estimated)", RATIO[rec.constriction] ? `${Math.round(ratio * bankfull)} ft` : "not measured"], ["Washout risk score", `${rec.flood.toFixed(2)} of 1`], ["Score rises with", "narrower pipe, bigger stream, paved road"]],
      xs: { variant: "existing", ratio, levels: [0.05, 0.6, 1.0], note: RATIO_NOTE[rec.constriction] || "Pipe width wasn't measured, so it's drawn at a typical size." },
      run: async () => { await move(map, "easeTo", { pitch: 50, zoom: 14, bearing: 110, duration: 2500 }); },
    },
    {
      title: "What it blocks",
      say: `Upstream of this pipe, highlighted in blue, are ${mi(rec.up)} of creek that fish can't reach today${rec.ebtMiles ? `, including ${mi(rec.ebtMiles)} mapped as habitat for native brook trout` : ""}. ${rec.natural != null ? `${rec.natural}% of the land along it is still natural.` : ""} ${ups.length ? `Farther up, ${ups.length === 1 ? "another blocking culvert is" : `${ups.length} more blocking culverts are`} marked in orange.` : ""}`,
      facts: [["Creek blocked upstream", `${rec.up.toFixed(1)} mi`], ["Brook trout habitat", rec.ebtMiles ? `${rec.ebtMiles.toFixed(1)} mi` : "none mapped"], ["Natural land along it", rec.natural != null ? `${rec.natural}%` : "—"], ["Other barriers upstream", ups.length]],
      trace: true,
      enter: () => ups.forEach((u) => marks.push(pin(map, [u.lon, u.lat], "Another blocking culvert", "amber"))),
      run: async (sig) => {
        if (!path) { await move(map, "easeTo", { zoom: 13.4, pitch: 55, bearing: 30, duration: 4000 }); return; }
        const total = reduceMotion ? 0 : Math.min(16000, 6000 + path.km * 1800);
        const t0 = performance.now();
        const tick = () => {
          if (sig.stopped) return;
          const p = total ? Math.min(1, (performance.now() - t0) / total) : 1;
          setTrace(map, p);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const fs = [0.18, 0.42, 0.66, 0.88, 1];
        let prev = at;
        for (const f of fs) {
          if (sig.stopped) return;
          const pt = along(path.coords, f);
          await move(map, "easeTo", { center: pt, zoom: 14.5, pitch: 60, bearing: bearing(prev, pt), duration: total / fs.length, easing: (t) => t });
          prev = pt;
        }
      },
    },
    {
      title: "What's downstream",
      say: P.parent
        ? `Follow the creek down and you hit another blocking culvert, marked in orange. The highlighted stretch between the two is all the river fish below could gain if we fixed only this pipe: ${rec.gain < 0.05 ? "almost nothing" : mi(rec.gain)}. Fix both pipes and ${mi(P.chainMiles)} open up, for about ${money(P.chainCost)}.`
        : rec.anchorXY
          ? `Downstream, the creek runs ${mi(rec.down)}, highlighted in orange, to ${rec.anchorName ? `${rec.anchorName}, a dam` : "a dam"}. The fish living in that stretch are the ones that would swim up once this pipe is fixed. ${rec.down < rec.up ? `Because that stretch is short, we only count ${mi(credit)} of benefit, not the full ${mi(rec.up)}.` : `They'd gain all ${mi(rec.up)} upstream.`}`
          : rec.down >= 50
            ? `Downstream, this creek joins a big, open river system: about ${mi(rec.down)} of river with no dam or blocking culvert in the way. Fish from that whole system could swim up once this pipe is fixed, gaining ${mi(credit)} of creek.`
            : `Downstream, the creek runs ${mi(rec.down)}, highlighted in orange, before the next barrier. The fish living there are the ones that would swim up once this pipe is fixed, gaining ${mi(credit)}.`,
      facts: P.parent
        ? [["Fix only this pipe", rec.gain < 0.05 ? "≈ 0 mi gained" : `${rec.gain.toFixed(1)} mi gained`], ["Fix both pipes", `${P.chainMiles.toFixed(1)} mi gained`], ["Cost of both", money(P.chainCost)]]
        : [["Open river below", rec.down >= 100 ? `${Math.round(rec.down).toLocaleString("en-US")} mi` : `${rec.down.toFixed(1)} mi`], ["Next barrier down", rec.anchorXY ? "Dam" : rec.down >= 50 ? "None nearby" : cap(rec.anchorKind || "barrier")], ["Benefit we count", `${credit.toFixed(1)} mi`]],
      enter: () => {
        if (belowNet) showBelow(true);
        if (belowAt && belowLabel) marks.push(pin(map, belowAt, belowLabel, "amber"));
      },
      run: async () => {
        if (belowAt) {
          const mid = [(at[0] + belowAt[0]) / 2, (at[1] + belowAt[1]) / 2];
          const far = km(at, belowAt);
          await move(map, "flyTo", { center: mid, zoom: Math.max(12, Math.min(14.2, 14.6 - Math.log2(Math.max(0.2, far)))), pitch: 50, bearing: bearing(belowAt, at), duration: 4500 });
        } else {
          await move(map, "flyTo", { center: at, zoom: 13.2, pitch: 52, bearing: 200, duration: 4500 });
        }
      },
    },
    {
      title: "The fix",
      say: `The fix is to take out the pipe and build a crossing as wide as the creek, like a small bridge or a bottomless arch, so the natural creek bed runs right under the road. Here that means an opening about ${Math.round(rec.spanFt)} feet wide. In a big storm, the water passes underneath instead of over the road, and fish can swim through. It would cost about ${money(rec.cost)}, likely between ${money(rec.cost * 0.44)} and ${money(rec.cost * 2.28)}. After Tropical Storm Irene in Vermont, crossings built this way survived while narrow pipes washed out.`,
      facts: [["What gets built", "Creek-wide bridge or arch"], ["Opening", `≈ ${Math.round(rec.spanFt)} ft`], ["Estimated cost", money(rec.cost)], ["Likely range", `${money(rec.cost * 0.44)}–${money(rec.cost * 2.28)}`]],
      xs: { variant: "fixed", ratio: Math.max(1.05, (rec.spanFt || bankfull * 1.3) / bankfull), levels: [0.05, 0.6, 1.0], note: "The same storm, after the pipe is replaced by a crossing as wide as the creek." },
      run: async () => { await move(map, "flyTo", { center: at, zoom: 14.4, pitch: 52, bearing: 300, duration: 4200 }); },
    },
    {
      title: "Why it's in the plan",
      say: P.inPlan
        ? `With a ${P.budget} budget, Pinchpoint picks ${P.n} culverts to fix ${P.where}, and this is one of them. Together they reopen ${mi(P.miles)} of creek and remove ${P.floodPct}% of the washout risk ${P.where}${P.delta > 0.05 ? `. That's ${mi(P.delta)} more than picking the best culverts one at a time` : ""}.`
        : `With a ${P.budget} budget, this culvert doesn't make the cut. Judged on its own, it ranks ${P.rank} out of ${P.N} ${P.where}${P.enter ? `, and it gets picked once the budget reaches ${P.enter}` : ""}.`,
      facts: P.inPlan
        ? [["Budget", P.budget], ["Culverts picked", P.n], ["Creek reopened", `${P.miles.toFixed(1)} mi`], ["Washout risk removed", `${P.floodPct}%`]]
        : [["Budget", P.budget], ["Rank on its own", `${P.rank} of ${P.N}`], ["Gets picked at", P.enter || "over $20M"]],
      run: async () => { await move(map, "fitBounds", { ...ctx.planBounds(), pitch: 45, bearing: -15, duration: 5000, padding: 80 }); },
    },
  ];

  /* stage: crossfade from the map into satellite and 3D terrain */
  document.body.classList.add("cinema");
  await sleep(50);
  map.resize();
  const bg0 = map.getPaintProperty("bg", "background-color");
  if (!map.getSource("sat")) map.addSource("sat", { type: "raster", tiles: [SAT], tileSize: 256, maxzoom: 16, attribution: "Imagery: USGS The National Map" });
  if (!map.getLayer("sat")) map.addLayer({ id: "sat", type: "raster", source: "sat", paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: reduceMotion ? 0 : 1600 }, "raster-saturation": -0.1, "raster-fade-duration": 250 } }, "huc-line");
  requestAnimationFrame(() => map.getLayer("sat") && map.setPaintProperty("sat", "raster-opacity", 1));
  const hidden = TOPO.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
  setTimeout(() => {
    if (!document.body.classList.contains("cinema")) return;
    hidden.forEach((id) => map.setLayoutProperty(id, "visibility", "none"));
    map.setPaintProperty("bg", "background-color", FOREST);
  }, reduceMotion ? 0 : 1700);
  if (!map.getSource("terrain-dem")) map.addSource("terrain-dem", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 13 });
  const w = (base) => ["interpolate", ["linear"], ["zoom"], 10, base, 15, base * 2.4];
  // Highlights get their own sources: with terrain on, MapLibre caches draped layers and doesn't
  // redraw on a filter change, but it always redraws when a source's data changes.
  const netFeats = (net) => ({ type: "FeatureCollection", features: net && ctx.streams ? ctx.streams.features.filter((f) => f.properties.net === net) : [] });
  const empty = { type: "FeatureCollection", features: [] };
  const upData = netFeats(rec.id), belowData = netFeats(belowNet);
  map.addSource("cine-up-src", { type: "geojson", data: empty });
  map.addSource("cine-below-src", { type: "geojson", data: empty });
  map.addLayer({ id: "cine-up", type: "line", source: "cine-up-src", layout: { "line-cap": "round" }, paint: { "line-color": "#62d5ff", "line-width": w(2.2), "line-opacity": 0.95 } }, "culverts");
  // Downstream highlight: dark outline for contrast on satellite, a wide warm glow, a bright core.
  map.addLayer({ id: "cine-below-case", type: "line", source: "cine-below-src", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2a1a00", "line-width": w(5.2), "line-opacity": 0.55 } }, "culverts");
  map.addLayer({ id: "cine-below-glow", type: "line", source: "cine-below-src", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffc93c", "line-width": w(11), "line-blur": 6, "line-opacity": 0.8 } }, "culverts");
  map.addLayer({ id: "cine-below", type: "line", source: "cine-below-src", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffbe1a", "line-width": w(3.6) } }, "culverts");
  const showUp = (on) => map.getSource("cine-up-src")?.setData(on ? upData : empty);
  const showBelow = (on) => map.getSource("cine-below-src")?.setData(on ? belowData : empty);
  if (path) {
    map.addSource("trace", { type: "geojson", lineMetrics: true, data: { type: "Feature", geometry: { type: "LineString", coordinates: path.coords }, properties: {} } });
    map.addLayer({ id: "trace-glow", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 14, "line-blur": 8, "line-opacity": 0.55, "line-gradient": grad("#2fb6ff", 0) } });
    map.addLayer({ id: "trace", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 5, "line-gradient": grad("#7fe3ff", 0) } });
  }
  // Turn terrain on only after every flyover layer exists, so they are all draped onto it.
  map.setTerrain({ source: "terrain-dem", exaggeration: 1.15 });
  map.setCenterClampedToGround?.(false);
  const thisPin = pin(map, at, "This culvert", "this");
  ctx.pulse(at, true);

  const ui = {
    root: $("#cine"), caption: $("#cine-caption"), scene: $("#cine-scene"), facts: $("#cine-facts"), xs: $("#cine-xs"),
    xsSvg: $("#cine-xs-svg"), xsHead: $("#cine-xs-head"), xsNote: $("#cine-xs-note"), bar: $("#cine-progress"), play: $("#cine-play"),
    voice: $("#cine-voice"),
  };
  ui.root.hidden = false;
  $("#cine-stream").textContent = cap(stream);
  $("#cine-road").textContent = `${cap(road)}${rec.county ? `, ${rec.county} County` : ""}`;
  ui.bar.innerHTML = scenes.map((s, i) => `<button type="button" data-i="${i}" title="${s.title}"><i></i><span>${s.title}</span></button>`).join("");
  ui.play.textContent = `Pause${KEY}`;

  let xsCtl = null;
  let xsMod = null;
  try { xsMod = await import("./xsection.js"); } catch { xsMod = null; }

  let i = 0, paused = false, token = 0, sig = { stopped: false }, xsLevel = 0;
  const clearMarks = () => { while (marks.length) marks.pop().remove(); };
  const finish = () => {
    token++; sig.stopped = true;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (xsCtl) { xsCtl.destroy(); xsCtl = null; }
    ui.root.hidden = true; ui.xs.hidden = true;
    ui.root.classList.remove("paused");
    document.body.classList.remove("cinema");
    clearMarks(); thisPin.remove();
    for (const id of ["trace", "trace-glow", "cine-up", "cine-below", "cine-below-glow", "cine-below-case"]) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of ["trace", "cine-up-src", "cine-below-src"]) if (map.getSource(id)) map.removeSource(id);
    if (map.getLayer("sat")) map.removeLayer("sat");
    if (map.setCenterElevation) map.setCenterElevation(0);
    map.setCenterClampedToGround?.(true);
    map.setTerrain(null);
    map.setPaintProperty("bg", "background-color", bg0);
    hidden.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "visible"));
    ctx.pulse(null, false);
    setTimeout(() => { map.resize(); map.jumpTo(view0); }, 60);
    document.removeEventListener("keydown", onKey, true);
    ctx.onExit?.();
  };
  // Capture phase, so a focused button can't also react to the same key.
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); finish(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
    else if (e.key === " " || e.code === "Space") { e.preventDefault(); e.stopPropagation(); togglePause(); }
  };
  document.addEventListener("keydown", onKey, true);
  const press = (fn) => (e) => { e.currentTarget.blur(); fn(); };
  $("#cine-exit").onclick = press(finish);
  $("#cine-next").onclick = press(() => go(i + 1));
  $("#cine-back").onclick = press(() => go(i - 1));
  ui.play.onclick = press(togglePause);
  ui.bar.querySelectorAll("button").forEach((b) => (b.onclick = press(() => go(Number(b.dataset.i)))));
  ui.voice.onchange = () => { ui.voice.blur(); if (!ui.voice.checked && "speechSynthesis" in window) speechSynthesis.cancel(); };

  // Pause stops everything at once: camera, river trace, flood animation and voice.
  // Play restarts the current scene from its beginning.
  function togglePause() {
    paused = !paused;
    ui.play.textContent = paused ? `Play${KEY}` : `Pause${KEY}`;
    ui.root.classList.toggle("paused", paused);
    if (paused) {
      token++;
      sig.stopped = true;
      map.stop();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      if (xsCtl) xsCtl.flood(xsLevel, 0);
    } else {
      go(i);
    }
  }

  function render(s) {
    ui.scene.textContent = `${i + 1} of ${scenes.length}: ${s.title}`;
    ui.caption.textContent = s.say.replace(/\s+/g, " ").trim();
    ui.facts.innerHTML = s.facts.map(([k, v]) => `<div class="cf"><span>${k}</span><b>${v}</b></div>`).join("");
    ui.bar.querySelectorAll("button").forEach((b, j) => { b.classList.toggle("done", j < i); b.classList.toggle("now", j === i); });
  }

  async function go(n) {
    if (n < 0) n = 0;
    if (n >= scenes.length) return finish();
    if (paused) { paused = false; ui.play.textContent = `Pause${KEY}`; ui.root.classList.remove("paused"); }
    i = n;
    const my = ++token;
    sig.stopped = true;
    sig = { stopped: false };
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const s = scenes[i];
    render(s);
    clearMarks();
    showBelow(false);
    showUp(i >= 3);
    if (!s.trace) setTrace(map, i > 3 ? 1 : 0);
    ctx.pulse(at, !!s.pulse || i < 3);
    s.enter?.();
    if (xsCtl) { xsCtl.destroy(); xsCtl = null; }
    ui.xs.hidden = true;
    if (s.xs && xsMod) {
      ui.xs.hidden = false;
      ui.xsHead.textContent = s.xs.variant === "existing" ? "Today: the narrow pipe in a storm" : "After the fix: a creek-wide crossing in the same storm";
      ui.xsNote.textContent = s.xs.note;
      try {
        xsCtl = xsMod.crossSection(ui.xsSvg, { variant: s.xs.variant, ratio: s.xs.ratio, bankfullFt: bankfull, roadLabel: cap(road), colors: ctx.colors.xs });
        (async () => { for (const lv of s.xs.levels) { if (token !== my || !xsCtl) return; xsLevel = lv; xsCtl.flood(lv, 2600); await sleep(3600); } })();
      } catch (e) { console.warn("cross-section failed", e); ui.xs.hidden = true; }
    }
    const spoken = speak(ui.caption.textContent, ui.voice.checked);
    const moved = s.run(sig).catch(() => {});
    await Promise.all([spoken, moved, sleep(s.xs ? 11000 : 6500)]);
    await sleep(900);
    if (token === my && !paused) go(i + 1);
  }
  go(0);
}

function grad(color, p) {
  if (p >= 0.999) return ["interpolate", ["linear"], ["line-progress"], 0, color, 1, color];
  const a = Math.max(0.0001, p);
  return ["interpolate", ["linear"], ["line-progress"], 0, color, a, color, Math.min(0.9999, a + 0.0005), "rgba(0,0,0,0)", 1, "rgba(0,0,0,0)"];
}
function setTrace(map, p) {
  if (!map.getLayer("trace")) return;
  map.setPaintProperty("trace", "line-gradient", grad("#7fe3ff", p));
  map.setPaintProperty("trace-glow", "line-gradient", grad("#2fb6ff", p));
}
