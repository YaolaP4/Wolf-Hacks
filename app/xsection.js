const NS = "http://www.w3.org/2000/svg";
let nextId = 0;

export function crossSection(container, opts = {}) {
  if (!container || container.nodeType !== 1) {
    throw new TypeError("crossSection requires an HTMLElement.");
  }
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const colors = {
    water: "#58b8d4", waterDeep: "#22647c", ink: "#263c42",
    muted: "#687b7f", road: "#85837a", soil: "#adba9c",
    accent: "#bc6345", paper: "#fafbf5", ...opts.colors
  };
  const channelPx = 220;
  const bankfull = Number.isFinite(opts.bankfullFt) && opts.bankfullFt > 0
    ? opts.bankfullFt : 30;
  const uid = `xsection-${++nextId}-${Math.random().toString(36).slice(2, 8)}`;
  let variant, ratio, geometry, nodes;
  let level = 0, transition = null, frame = null, destroyed = false;
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");

  function el(tag, attrs = {}, parent, text) {
    const node = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }
  const svg = el("svg", {
    viewBox: "0 0 640 300", width: "100%", role: "img",
    "aria-labelledby": `${uid}-title ${uid}-description`,
    style: "display:block;width:100%;height:auto;overflow:hidden",
    "font-family": "system-ui, sans-serif", "font-size": 12
  }, container);
  const title = el("title", { id: `${uid}-title` }, svg);
  const description = el("desc", { id: `${uid}-description` }, svg);
  const defs = el("defs", {}, svg);
  const gradient = el("linearGradient", {
    id: `${uid}-soil`, x1: 0, y1: 0, x2: 0, y2: 1,
    gradientUnits: "objectBoundingBox"
  }, defs);
  el("stop", { offset: 0, "stop-color": colors.soil }, gradient);
  el("stop", { offset: 1, "stop-color": colors.ink, "stop-opacity": 0.65 }, gradient);
  const basin = el("clipPath", { id: `${uid}-basin` }, defs);
  el("path", { d: "M0 0H640V135L430 248H210L0 135Z" }, basin);
  const openingClip = el("clipPath", { id: `${uid}-opening` }, defs);
  const mask = el("mask", {
    id: `${uid}-road-mask`, maskUnits: "userSpaceOnUse",
    x: 0, y: 0, width: 640, height: 300,
    style: "mask-type:luminance"
  }, defs);
  el("rect", { width: 640, height: 300, fill: "white" }, mask);
  const cut = el("path", { fill: "black" }, mask);
  const scene = el("g", {}, svg);

  function text(x, y, value, extra = {}) {
    return el("text", { x, y, fill: colors.ink, ...extra }, scene, value);
  }
  function dimension(x1, x2, y, label) {
    el("path", {
      d: `M${x1} ${y - 5}V${y + 5}M${x2} ${y - 5}V${y + 5}
          M${x1} ${y}H${x2}
          M${x1 + 5} ${y - 3}L${x1} ${y}L${x1 + 5} ${y + 3}
          M${x2 - 5} ${y - 3}L${x2} ${y}L${x2 - 5} ${y + 3}`,
      fill: "none", stroke: colors.muted, "stroke-width": 1
    }, scene);
    text((x1 + x2) / 2, y - 7, label, { "text-anchor": "middle" });
  }
  function configure(v, r) {
    if (v !== "existing" && v !== "fixed") {
      throw new RangeError('variant must be "existing" or "fixed".');
    }
    variant = v;
    ratio = Number.isFinite(r) && r > 0 ? r : (v === "fixed" ? 1.3 : 0.4);
    ratio = Math.max(v === "existing" ? 0.2 : 1.05,
      Math.min(v === "existing" ? 1 : 2, ratio));
  }
  function draw() {
    scene.replaceChildren();
    openingClip.replaceChildren();
    const width = ratio * channelPx;
    geometry = {
      width, left: 320 - width / 2, right: 320 + width / 2,
      crown: variant === "existing" ? 244 - width : 139
    };
    const openingAttrs = variant === "existing"
      ? { cx: 320, cy: 244 - width / 2, r: width / 2 }
      : { x: geometry.left, y: 139, width, height: 105 };
    const openingTag = variant === "existing" ? "circle" : "rect";
    el(openingTag, openingAttrs, openingClip);
    el("rect", { width: 640, height: 300, fill: colors.paper }, scene);
    el("path", {
      d: "M0 62L100 62L225 226H415L540 62H640V252H0Z",
      fill: `url(#${uid}-soil)`
    }, scene);
    const road = el("g", { mask: `url(#${uid}-road-mask)` }, scene);
    el("path", {
      d: "M0 120H640V210L430 246H210L0 210Z", fill: colors.soil
    }, road);
    el("path", {
      d: "M0 120H640V210L430 246H210L0 210Z",
      fill: colors.paper, opacity: 0.2
    }, road);
    el("rect", { x: 0, y: 120, width: 640, height: 10, fill: colors.road }, road);
    el("path", {
      d: "M0 125H640", stroke: colors.paper,
      "stroke-width": 1.3, "stroke-dasharray": "12 10", opacity: 0.8
    }, road);
    el("path", {
      d: "M194 244L210 231H430L446 244L430 251H210Z",
      fill: colors.road
    }, scene);
    el(openingTag, { ...openingAttrs, fill: colors.waterDeep }, scene);
    const bed = el("g", { "clip-path": `url(#${uid}-opening)` }, scene);
    el("path", {
      d: `M${geometry.left} 238Q320 232 ${geometry.right} 238V249H${geometry.left}Z`,
      fill: colors.soil
    }, bed);
    if (variant === "fixed") {
      for (let i = 0; i < 23; i++) {
        el("circle", {
          cx: geometry.left + 7 + i * (width - 14) / 22,
          cy: 238 + Math.sin(i * 2.3) * 2, r: 2 + (i % 3),
          fill: i % 2 ? colors.road : colors.paper, opacity: 0.8
        }, bed);
      }
    }
    const back = el("g", { "clip-path": `url(#${uid}-opening)` }, scene);
    const inside = el("path", { fill: colors.water, opacity: 0.88 }, back);
    const pool = el("g", { "clip-path": `url(#${uid}-basin)` }, scene);
    const water = el("path", { fill: colors.water, opacity: 0.76 }, pool);
    const highlight = el("path", {
      fill: "none", stroke: colors.paper, "stroke-width": 1.7, opacity: 0.8
    }, pool);
    if (variant === "existing") {
      el("circle", {
        ...openingAttrs, fill: "none", stroke: colors.road, "stroke-width": 5
      }, scene);
      el("circle", {
        ...openingAttrs, r: width / 2 - 4, fill: "none",
        stroke: colors.paper, "stroke-width": 1.5,
        "stroke-dasharray": "2 5", opacity: 0.6
      }, scene);
    } else {
      el("path", {
        d: `M${geometry.left} 244V139H${geometry.right}V244`,
        fill: "none", stroke: colors.road, "stroke-width": 6
      }, scene);
      el("path", {
        d: `M${geometry.left} 244V139H${geometry.right}V244`,
        fill: "none", stroke: colors.paper, "stroke-width": 2, opacity: 0.8
      }, scene);
    }
    const spill = el("g", {}, scene);
    el("path", {
      d: "M246 118Q320 114 394 118L407 130Q320 124 233 130Z",
      fill: colors.water, opacity: 0.95
    }, spill);
    el("path", {
      d: "M266 129L277 144L291 136L310 160L326 141L344 150L360 131",
      fill: "none", stroke: colors.accent, "stroke-width": 2
    }, spill);
    const streaks = Array.from({ length: 6 }, () => el("path", {
      fill: "none", stroke: colors.paper, "stroke-width": 1.6,
      "stroke-linecap": "round"
    }, spill));
    const stage = text(18, 25, "");
    text(622, 49, String(opts.roadLabel ?? "Stream crossing"), { "text-anchor": "end" });
    const status = text(320, 76, "", { "text-anchor": "middle" });
    dimension(geometry.left, geometry.right, 266,
      `Opening ≈ ${Math.round(ratio * bankfull)} ft`);
    dimension(210, 430, 290, `Stream ≈ ${bankfull} ft wide`);
    text(12, 294, "Illustration, not to scale", { fill: colors.muted });
    nodes = { inside, water, highlight, spill, streaks, stage, status };
    title.textContent = variant === "existing"
      ? "Existing culvert flood cross-section" : "Open-bottom crossing flood cross-section";
  }
  function render(now) {
    const storm = Math.min(geometry.crown - 10, 153);
    const peak = Math.max(4, Math.min(108, storm - 14));
    const y = variant === "fixed" ? 236 - level * 76
      : level <= 0.6 ? 236 + (storm - 236) * level / 0.6
      : storm + (peak - storm) * (level - 0.6) / 0.4;
    const phase = motion.matches ? 0 : now / 850;
    let surface = "";
    for (let x = 0; x <= 640; x += 8) {
      const dy = motion.matches ? 0 : Math.sin(x / 31 + phase) * 1.1;
      surface += `${x === 0 ? "M" : "L"}${x} ${(y + dy).toFixed(2)} `;
    }
    const polygon = `${surface}L640 250H0Z`;
    nodes.inside.setAttribute("d", polygon);
    nodes.water.setAttribute("d", polygon);
    nodes.highlight.setAttribute("d", surface);
    const overtops = variant === "existing" && y < 119;
    const erosion = overtops ? Math.min(1, (119 - y) / 10) : 0;
    cut.setAttribute("d", erosion
      ? `M267 119H365L352 ${130 + erosion * 14}L337 133L316 ${133 + erosion * 29}L295 137L282 ${129 + erosion * 13}Z`
      : "");
    nodes.spill.setAttribute("display", overtops ? "inline" : "none");
    nodes.streaks.forEach((node, i) => {
      const t = motion.matches ? 0.35 : ((now / 1100 + i / 6) % 1);
      const x = 254 + i * 25, sy = 120 + t * 28;
      node.setAttribute("d", `M${x} ${sy}q${i % 2 ? 4 : -4} 4 1 10`);
      node.setAttribute("opacity", String(1 - t * 0.8));
    });
    const label = level < 0.2 ? "Normal flow"
      : level <= 0.75 ? "Storm flow" : "Helene-scale flood";
    if (nodes.stage.textContent !== label) nodes.stage.textContent = label;
    const message = overtops ? "Road overtops"
      : variant === "fixed" && level >= 0.6 ? "Flood passes under" : "";
    nodes.status.textContent = message;
    nodes.status.setAttribute("fill", overtops ? colors.accent : colors.water);
    description.textContent = `${label}. ${message || "Water flows through the opening."}`;
  }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  function update(now) {
    if (!transition) return;
    const t = Math.min(1, Math.max(0, (now - transition.start) / transition.ms));
    level = transition.from + (transition.to - transition.from) * ease(t);
    if (t === 1) transition = null;
  }
  function tick(now) {
    frame = null;
    if (destroyed) return;
    update(now);
    render(now);
    if (!motion.matches) frame = win.requestAnimationFrame(tick);
  }
  function motionChanged() {
    if (destroyed) return;
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    if (motion.matches && transition) { level = transition.to; transition = null; }
    tick(win.performance.now());
  }
  configure(opts.variant ?? "existing", opts.ratio);
  draw();
  motion.addEventListener("change", motionChanged);
  tick(win.performance.now());
  return {
    flood(target, ms = 900) {
      if (destroyed) return;
      if (!Number.isFinite(target)) throw new TypeError("Flood level must be finite.");
      const now = win.performance.now();
      update(now);
      target = Math.max(0, Math.min(1, target));
      if (motion.matches || !Number.isFinite(ms) || ms <= 0) {
        level = target; transition = null;
      } else transition = { from: level, to: target, start: now, ms };
      render(now);
    },
    setVariant(v, r) {
      if (destroyed) return;
      update(win.performance.now());
      configure(v, r);
      draw();
      render(win.performance.now());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) win.cancelAnimationFrame(frame);
      motion.removeEventListener("change", motionChanged);
      transition = null;
      svg.remove();
    }
  };
}
