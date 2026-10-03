// Cinematic flyover of one culvert: 3D satellite terrain, a flood cross-section, the river it
// cuts off traced upstream, what lies below, the fix, and where it sits in the budget plan.
// Every sentence is assembled from the culvert's inventory record and the live plan.

const SAT = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
const DEM = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
const HIDE = ["shade", "contour", "wood", "urban", "water", "waterway", "road-minor", "road-major", "huc-fill", "streams-base", "links"];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);

/* ---------- words ---------- */
function prettyStream(r) {
  const n = (r.river || "").trim();
  if (!n || n === "Unknown") return "an unnamed tributary";
  const m = n.match(/^ut\d*\s+(?:to\s+)?(.+)$/i);
  if (m) return `a tributary of ${m[1]}`;
  if (/^ut/i.test(n)) return "an unnamed tributary";
  return n;
}
function prettyRoad(r) {
  const n = (r.road || "").trim();
  if (!n || /^unnamed/i.test(n)) return "an unnamed road";
  let m;
  if ((m = n.match(/^fs\s*r?\s*(\w+)/i))) return `Forest Service Road ${m[1]}`;
  if ((m = n.match(/^us\s*(\d+\w*)/i))) return `US ${m[1]}`;
  if ((m = n.match(/^nc\s*(\d+\w*)/i))) return `NC ${m[1]}`;
  if (/^\d+\w*$/.test(n)) return `road ${n}`;
  return n;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const RATIO = { Severe: 0.4, Moderate: 0.75, Minor: 0.9, "Spans only bankfull/active channel": 1.0, "Spans full channel & banks": 1.2 };
function constrictionSentence(c) {
  if (c === "Severe") return "Its opening is less than half as wide as the stream: a severe constriction.";
  if (c === "Moderate") return "Its opening is narrower than the stream: a moderate constriction.";
  if (c && /Spans/.test(c)) return "Its opening is about as wide as the stream, so the problem here is passage, not width.";
  return "The crew didn't record how much it squeezes the stream.";
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
  let i = cum.findIndex((c) => c >= t);
  if (i <= 0) return coords[0];
  const r = (t - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
  return [coords[i - 1][0] + r * (coords[i][0] - coords[i - 1][0]), coords[i - 1][1] + r * (coords[i][1] - coords[i - 1][1])];
}

/* ---------- camera ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function move(map, kind, opts) {
  return new Promise((res) => {
    const t = setTimeout(res, (opts.duration || 0) + 1500);
    map.once("moveend", () => { clearTimeout(t); res(); });
    const o = { ...opts, duration: reduceMotion ? 0 : opts.duration, essential: true };
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
    u.rate = 1.02;
    // Some machines have no voices and never fire "end"; never let narration stall the flyover.
    const guard = setTimeout(res, 2500 + (text.split(/\s+/).length / 2.5) * 1000);
    u.onend = () => { clearTimeout(guard); res(); };
    u.onerror = () => { clearTimeout(guard); res(); };
    speechSynthesis.speak(u);
  });
}

/* ---------- the flyover ---------- */
export async function startFlyover(ctx) {
  const { map, rec, colors, money } = ctx;
  const at = [rec.lon, rec.lat];
  const stream = prettyStream(rec);
  const road = prettyRoad(rec);
  const bankfull = Math.max(4, Math.round(((rec.spanFt || 20) - 2) / 1.2));
  const ratio = RATIO[rec.constriction] ?? 0.6;
  const daMi = rec.daSqKm != null ? rec.daSqKm / 2.59 : null;
  const path = upstreamPath(ctx.streams, rec.id, at);
  const P = ctx.plan;
  const view0 = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };

  /* scenes */
  const helene = rec.slides2mi > 0
    ? `After Hurricane Helene, USGS mapped ${plural(rec.slides2mi, "landslide", "landslides")} within two miles of this crossing.`
    : rec.slideMi != null && rec.slideMi < 15 ? `The nearest landslide USGS mapped after Hurricane Helene is ${rec.slideMi.toFixed(1)} miles away.` : "";
  const scenes = [
    {
      title: "Where",
      say: `This is ${stream}${rec.county ? `, in ${rec.county} County` : ""}, in the ${ctx.shedName} watershed. ${helene}`,
      facts: [["Watershed", ctx.shedName], ["County", rec.county || "—"], ["Drains", daMi != null ? `${daMi.toFixed(2)} sq mi` : "—"], ["Mean flow", rec.flowCfs != null ? `${rec.flowCfs} cfs` : "—"], ["Helene landslides within 2 mi", rec.slides2mi ?? "—"]],
      run: async () => {
        await move(map, "flyTo", { center: at, zoom: 12.6, pitch: 55, bearing: -20, duration: 5200, curve: 1.6 });
      },
    },
    {
      title: "The crossing",
      say: `${cap(road)} crosses the stream here through a ${(rec.crossing || "culvert").toLowerCase()}. Field crews ${rec.surveyed ? `surveyed it in ${rec.surveyed}` : "assessed it"} and rated it a ${(rec.severity || "barrier").toLowerCase().replace("barrier - unknown severity", "barrier of unknown severity")}. ${constrictionSentence(rec.constriction)}`,
      facts: [["Field rating", rec.severity || "—"], ["Constriction", rec.constriction || "Not recorded"], ["Road surface", rec.roadType || "—"], ["Condition", rec.condition || "—"], ["Inventory ID", rec.id]],
      pulse: true,
      run: async () => {
        await move(map, "flyTo", { center: at, zoom: 16.6, pitch: 72, bearing: 10, duration: 4200 });
        if (!reduceMotion) await move(map, "easeTo", { bearing: 85, duration: 7000, easing: (t) => t });
      },
    },
    {
      title: "Why it fails",
      say: `The stream here ${daMi != null ? `drains ${daMi.toFixed(1)} square miles and ` : ""}runs about ${bankfull} feet wide at bankfull. Squeezed through a narrower opening, storm water piles up behind the road, scours the outlet, and can wash the road out, the kind of failure Helene repeated across western North Carolina. At normal flows, fast water through the pipe keeps fish from moving upstream. Pinchpoint scores its washout risk ${rec.flood.toFixed(2)} out of 1.`,
      facts: [["Stream width (est.)", `${bankfull} ft`], ["Opening (est.)", rec.constriction && RATIO[rec.constriction] ? `≈ ${Math.round(ratio * bankfull)} ft` : "not recorded"], ["Washout score", rec.flood.toFixed(2)], ["Squeeze × flow × road", rec.floodParts.map((x) => x.toFixed(2)).join(" × ")]],
      xs: { variant: "existing", ratio, levels: [0.05, 0.6, 1.0], note: RATIO[rec.constriction] ? "Opening drawn from the field constriction class (NAACC: severe < 50% of stream width)." : "Constriction not recorded; opening drawn at a typical size." },
      run: async () => { await move(map, "easeTo", { pitch: 60, zoom: 16, bearing: 120, duration: 2500 }); },
    },
    {
      title: "What it cuts off",
      say: `Above this crossing: ${rec.up.toFixed(1)} miles of stream${rec.ebtMiles ? `, including ${rec.ebtMiles.toFixed(1)} miles mapped as Eastern brook trout habitat` : ""}. ${rec.natural != null ? `${rec.natural}% of its floodplain is still natural cover.` : ""} ${rec.sgcn ? `${rec.sgcn} state Species of Greatest Conservation Need are recorded in this subwatershed.` : ""}`,
      facts: [["River above", `${rec.up.toFixed(1)} mi`], ["Brook trout habitat", rec.ebtMiles ? `${rec.ebtMiles.toFixed(1)} mi` : "none mapped"], ["Natural floodplain", rec.natural != null ? `${rec.natural}%` : "—"], ["Species of concern nearby", rec.sgcn || 0]],
      trace: true,
      run: async (sig) => {
        if (!path) { await move(map, "easeTo", { zoom: 13.6, pitch: 60, bearing: 30, duration: 4000 }); return; }
        const total = reduceMotion ? 0 : Math.min(16000, 6000 + path.km * 1800);
        const t0 = performance.now();
        const tick = () => {
          if (sig.stopped) return;
          const p = total ? Math.min(1, (performance.now() - t0) / total) : 1;
          setTrace(map, p, colors.trace);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const fs = [0.18, 0.42, 0.66, 0.88, 1];
        let prev = at;
        for (const f of fs) {
          if (sig.stopped) return;
          const pt = along(path.coords, f);
          await move(map, "easeTo", { center: pt, zoom: 14.6, pitch: 68, bearing: bearing(prev, pt), duration: total / fs.length, easing: (t) => t });
          prev = pt;
        }
      },
    },
    {
      title: "What's below",
      say: P.parent
        ? `Just downstream, another barrier culvert on ${prettyStream(P.parent)} blocks the same river. Fixed alone, this one opens only ${rec.gain.toFixed(1)} miles to fish. Fixed together with the ${plural(P.chainCount, "culvert", "culverts")} below it, they reconnect ${P.chainMiles.toFixed(1)} miles for ${money(P.chainCost)}.`
        : rec.anchorXY
          ? `Below it, ${rec.down.toFixed(1)} miles of open river run down to ${rec.anchorName ? rec.anchorName : "a dam"}. Fish in that stretch are the ones that would move upstream, so the miles it can reconnect are capped at ${Math.min(rec.up, rec.anchorMiles).toFixed(1)}.`
          : `Below it, ${rec.down.toFixed(1)} miles of open river lead to the next barrier downstream. That's the population that would move upstream once it's fixed.`,
      facts: P.parent
        ? [["Fixed alone", `${rec.gain.toFixed(1)} mi`], ["Fixed with the chain", `${P.chainMiles.toFixed(1)} mi`], ["Chain cost", money(P.chainCost)]]
        : [["Open river below", `${rec.down.toFixed(1)} mi`], ["Next barrier", rec.anchorXY ? "Dam" : cap(rec.anchorKind || "barrier")], ["Credited gain", `${Math.min(rec.up, rec.anchorMiles).toFixed(1)} mi`]],
      run: async () => {
        const tgt = P.parent ? [P.parent.lon, P.parent.lat] : rec.anchorXY;
        if (tgt) {
          const mid = [(at[0] + tgt[0]) / 2, (at[1] + tgt[1]) / 2];
          const far = km(at, tgt);
          await move(map, "flyTo", { center: mid, zoom: Math.max(12.2, Math.min(15.5, 15.6 - Math.log2(Math.max(0.2, far)))), pitch: 62, bearing: bearing(tgt, at), duration: 4500 });
          ctx.mark(tgt);
        } else {
          await move(map, "flyTo", { center: at, zoom: 13.4, pitch: 58, bearing: 200, duration: 4500 });
        }
      },
    },
    {
      title: "The fix",
      say: `A stream-width crossing here would span about ${Math.round(rec.spanFt)} feet and keep a natural streambed through it. Planning cost: about ${money(rec.cost)}, with a range of ${money(rec.cost * 0.44)} to ${money(rec.cost * 2.28)}. Crossings built this way came through Tropical Storm Irene intact where undersized pipes failed.`,
      facts: [["Span", `≈ ${Math.round(rec.spanFt)} ft`], ["Planning cost", money(rec.cost)], ["Cost range", `${money(rec.cost * 0.44)}–${money(rec.cost * 2.28)}`], ["Evidence", "Gillespie et al. 2014"]],
      xs: { variant: "fixed", ratio: 1.3, levels: [0.05, 0.6, 1.0], note: "Same storm stages as before, through a stream-width crossing." },
      run: async () => { ctx.mark(null); await move(map, "flyTo", { center: at, zoom: 16.2, pitch: 70, bearing: 300, duration: 4200 }); },
    },
    {
      title: "In the plan",
      say: P.inPlan
        ? `With ${P.budget}, ${P.lam}, Pinchpoint picks this culvert as one of ${P.n}. Together they reconnect ${P.miles.toFixed(1)} river miles and remove ${P.floodPct}% of this watershed's washout risk${P.delta > 0.05 ? `, ${P.delta.toFixed(1)} more river miles than ranking culverts one at a time` : ""}.`
        : `At ${P.budget}, this culvert doesn't make the plan. It ranks number ${P.rank} of ${P.N} on its own${P.enter ? `, and joins the plan once the budget reaches ${P.enter}` : ""}.`,
      facts: P.inPlan
        ? [["Budget", P.budget], ["Culverts in plan", P.n], ["River reconnected", `${P.miles.toFixed(1)} mi`], ["Washout risk removed", `${P.floodPct}%`]]
        : [["Budget", P.budget], ["Rank on its own", `#${P.rank} of ${P.N}`], ["Joins the plan at", P.enter || "over $20M"]],
      run: async () => { await move(map, "fitBounds", { ...ctx.planBounds(), pitch: 45, bearing: -15, duration: 5000, padding: 80 }); },
    },
  ];

  /* stage */
  document.body.classList.add("cinema");
  await sleep(50);
  map.resize();
  const hidden = HIDE.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
  hidden.forEach((id) => map.setLayoutProperty(id, "visibility", "none"));
  if (!map.getSource("sat")) map.addSource("sat", { type: "raster", tiles: [SAT], tileSize: 256, maxzoom: 16, attribution: "Imagery: USGS The National Map" });
  if (!map.getLayer("sat")) map.addLayer({ id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": -0.15, "raster-contrast": 0.05, "raster-fade-duration": 200 } }, "huc-line");
  if (!map.getSource("terrain-dem")) map.addSource("terrain-dem", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 14 });
  map.setTerrain({ source: "terrain-dem", exaggeration: 1.35 });
  if (map.setSky) map.setSky({ "sky-color": "#8ec5f2", "horizon-color": "#e6f1fb", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-color": "#dfe9f2", "fog-ground-blend": 0.3 });
  if (path && !map.getSource("trace")) {
    map.addSource("trace", { type: "geojson", lineMetrics: true, data: { type: "Feature", geometry: { type: "LineString", coordinates: path.coords }, properties: {} } });
    map.addLayer({ id: "trace-glow", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 14, "line-blur": 8, "line-opacity": 0.55, "line-gradient": grad(colors.traceGlow, 0) } });
    map.addLayer({ id: "trace", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 5, "line-gradient": grad(colors.trace, 0) } });
  }
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

  let xsCtl = null;
  let xsMod = null;
  try { xsMod = await import("./xsection.js"); } catch { xsMod = null; }

  let i = 0, paused = false, token = 0, sig = { stopped: false };
  const finish = () => {
    token++; sig.stopped = true;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (xsCtl) { xsCtl.destroy(); xsCtl = null; }
    ui.root.hidden = true; ui.xs.hidden = true;
    document.body.classList.remove("cinema");
    for (const id of ["trace", "trace-glow"]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource("trace")) map.removeSource("trace");
    if (map.getLayer("sat")) map.removeLayer("sat");
    map.setTerrain(null);
    hidden.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "visible"));
    ctx.pulse(null, false); ctx.mark(null);
    setTimeout(() => { map.resize(); map.jumpTo(view0); }, 60);
    document.removeEventListener("keydown", onKey);
    ctx.onExit?.();
  };
  const onKey = (e) => {
    if (e.key === "Escape") finish();
    else if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === " ") { e.preventDefault(); togglePause(); }
  };
  document.addEventListener("keydown", onKey);
  $("#cine-exit").onclick = finish;
  $("#cine-next").onclick = () => go(i + 1);
  $("#cine-back").onclick = () => go(i - 1);
  ui.play.onclick = togglePause;
  ui.bar.querySelectorAll("button").forEach((b) => (b.onclick = () => go(Number(b.dataset.i))));
  ui.voice.onchange = () => { if (!ui.voice.checked && "speechSynthesis" in window) speechSynthesis.cancel(); };

  function togglePause() {
    paused = !paused;
    ui.play.textContent = paused ? "Play" : "Pause";
    if ("speechSynthesis" in window) paused ? speechSynthesis.pause() : speechSynthesis.resume();
    if (!paused) waitThenNext(token);
  }

  function render(s) {
    ui.scene.textContent = `${i + 1} of ${scenes.length}: ${s.title}`;
    ui.caption.textContent = s.say.replace(/\s+/g, " ").trim();
    ui.facts.innerHTML = s.facts.map(([k, v]) => `<div class="cf"><span>${k}</span><b>${v}</b></div>`).join("");
    ui.bar.querySelectorAll("button").forEach((b, j) => b.classList.toggle("done", j < i) || b.classList.toggle("now", j === i));
    ui.bar.querySelectorAll("button").forEach((b, j) => b.classList.toggle("now", j === i));
  }

  let sceneDone = Promise.resolve();
  async function go(n) {
    if (n < 0) n = 0;
    if (n >= scenes.length) return finish();
    i = n;
    const my = ++token;
    sig.stopped = true;
    sig = { stopped: false };
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const s = scenes[i];
    render(s);
    if (!s.trace) setTrace(map, s === scenes[i] && i > 3 ? 1 : 0, colors.trace);
    ctx.pulse(at, !!s.pulse || i < 3);
    if (xsCtl) { xsCtl.destroy(); xsCtl = null; }
    ui.xs.hidden = true;
    if (s.xs && xsMod) {
      ui.xs.hidden = false;
      ui.xsHead.textContent = s.xs.variant === "existing" ? "Today: an undersized culvert in a storm" : "The fix: a stream-width crossing, same storm";
      ui.xsNote.textContent = s.xs.note;
      try {
        xsCtl = xsMod.crossSection(ui.xsSvg, { variant: s.xs.variant, ratio: s.xs.ratio, bankfullFt: bankfull, roadLabel: cap(road), colors: colors.xs });
        (async () => { for (const lv of s.xs.levels) { if (token !== my || !xsCtl) return; xsCtl.flood(lv, 2600); await sleep(3600); } })();
      } catch (e) { console.warn("cross-section failed", e); ui.xs.hidden = true; }
    }
    const spoken = speak(ui.caption.textContent, ui.voice.checked);
    const moved = s.run(sig).catch(() => {});
    sceneDone = Promise.all([spoken, moved, sleep(s.xs ? 11000 : 6500)]);
    waitThenNext(my);
  }
  async function waitThenNext(my) {
    await sceneDone;
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
function setTrace(map, p, color) {
  if (!map.getLayer("trace")) return;
  map.setPaintProperty("trace", "line-gradient", grad(color, p));
  map.setPaintProperty("trace-glow", "line-gradient", grad(color, p));
}
