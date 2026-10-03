// Exact budgeted culvert optimizer (port of pipeline/optimizer.py). Browser and Node, no DOM.
//
// Culverts form trees, each hanging from an anchor network below it of length D_T.
// For a set S under a budget, maximize
//   (1 - lam) * habitat(S) / H + lam * flood(S) / F
// habitat(S) = sum over trees of min(upstream miles of culverts whose path to the anchor is
//              open, D_T). For one culvert this is the inventory's gain, min(upstream, downstream).
// flood(S)   = sum of washout-risk scores of culverts in S.
// Trees where the cap cannot bind use a two-state tree DP; trees where it can are enumerated.

const NEG = -1e18;
const MAX_ENUM = 18;

function ext(a, n) {
  if (a.length >= n) return a.subarray(0, n);
  const out = new Float64Array(n);
  out.set(a);
  out.fill(a[a.length - 1], a.length);
  return out;
}

function maxplus(a, b, cap) {
  const n = Math.min(a.length + b.length - 1, cap + 1);
  const ae = ext(a, n);
  const res = new Float64Array(n).fill(NEG);
  const split = new Int32Array(n);
  const m = Math.min(b.length, n);
  for (let i = 0; i < m; i++) {
    const bi = b[i];
    for (let k = i; k < n; k++) {
      const c = bi + ae[k - i];
      if (c > res[k]) { res[k] = c; split[k] = i; }
    }
  }
  return { res, split };
}

/** Link items into trees. Returns { nodes, roots, trees: [{root, ids (parents first), cap, U}] }. */
export function forest(items) {
  const nodes = new Map(items.map((d) => [d.id, { ...d, children: [] }]));
  const roots = [];
  for (const n of nodes.values()) {
    if (n.parent && nodes.has(n.parent)) nodes.get(n.parent).children.push(n.id);
    else roots.push(n.id);
  }
  const trees = roots.map((r) => {
    const ids = [], stack = [r];
    while (stack.length) { const v = stack.pop(); ids.push(v); stack.push(...nodes.get(v).children); }
    const a = nodes.get(r).anchor;
    const U = ids.reduce((s, v) => s + nodes.get(v).habitat, 0);
    return { root: r, ids, cap: a == null ? Infinity : a, U };
  });
  return { nodes, roots, trees };
}

function treeDP(nodes, ids, B, lam, H, F) {
  const store = new Map();
  for (let j = ids.length - 1; j >= 0; j--) {
    const v = nodes.get(ids[j]);
    let mO = new Float64Array([0]), mC = new Float64Array([0]);
    const mergeO = [], mergeC = [];
    for (const cid of v.children) {
      const sc = store.get(cid);
      let prev = mO.length;
      let r = maxplus(mO, sc.O, B);
      mO = r.res; mergeO.push([cid, r.split, prev]);
      prev = mC.length;
      r = maxplus(mC, sc.C, B);
      mC = r.res; mergeC.push([cid, r.split, prev]);
    }
    const valOpen = (1 - lam) * v.habitat / H + lam * v.flood / F;
    const valClosed = lam * v.flood / F;
    const n = Math.min(Math.max(mO.length, mC.length) + v.cost, B + 1);
    const notfix = ext(mC, n), mOe = ext(mO, n), mCe = ext(mC, n);
    const O = new Float64Array(n), C = new Float64Array(n);
    const fixO = new Uint8Array(n), fixC = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      let fo = NEG, fc = NEG;
      if (k >= v.cost) { fo = valOpen + mOe[k - v.cost]; fc = valClosed + mCe[k - v.cost]; }
      if (fo > notfix[k]) { O[k] = fo; fixO[k] = 1; } else O[k] = notfix[k];
      if (fc > notfix[k]) { C[k] = fc; fixC[k] = 1; } else C[k] = notfix[k];
    }
    store.set(v.id, { O, C, fixO, fixC, mergeO, mergeC });
  }
  return store;
}

function treeEnum(nodes, ids, cap, B, lam, H, F) {
  const k = ids.length;
  if (k > MAX_ENUM) throw new Error(`capped tree with ${k} culverts is too large to enumerate`);
  const pos = new Map(ids.map((v, j) => [v, j]));
  const par = ids.map((v) => (pos.has(nodes.get(v).parent) ? pos.get(nodes.get(v).parent) : -1));
  const cost = ids.map((v) => nodes.get(v).cost), hab = ids.map((v) => nodes.get(v).habitat), fl = ids.map((v) => nodes.get(v).flood);
  const total = cost.reduce((s, c) => s + c, 0);
  const n = Math.min(total, B) + 1;
  const exact = new Float64Array(n).fill(NEG), exactM = new Int32Array(n);
  const open = new Uint8Array(k);
  for (let m = 0; m < 1 << k; m++) {
    let c = 0, h = 0, f = 0;
    for (let j = 0; j < k; j++) {
      const s = (m >> j) & 1;
      if (s) { c += cost[j]; f += fl[j]; }
      open[j] = s && (par[j] < 0 || open[par[j]]) ? 1 : 0;
      if (open[j]) h += hab[j];
    }
    if (c >= n) continue;
    const val = (1 - lam) * Math.min(h, cap) / H + lam * f / F;
    if (val > exact[c]) { exact[c] = val; exactM[c] = m; }
  }
  const arr = new Float64Array(n), arg = new Int32Array(n);
  let best = NEG, bm = 0;
  for (let c = 0; c < n; c++) {
    if (exact[c] > best) { best = exact[c]; bm = exactM[c]; }
    arr[c] = best; arg[c] = bm;
  }
  return { arr, arg };
}

/** Best habitat each tree could reach and total flood: the normalizers H and F. */
export function normalizers(items) {
  const { trees } = forest(items);
  const H = trees.reduce((s, t) => s + Math.min(t.U, t.cap), 0) || 1;
  const F = items.reduce((s, d) => s + d.flood, 0) || 1;
  return { H, F };
}

/**
 * @param items {id, parent, habitat, flood, cost (integer units >= 1), anchor (roots only)}
 * @param maxUnits largest budget to solve for
 * @param lam weight on flood risk, 0..1
 */
export function solve(items, maxUnits, lam = 0) {
  const { nodes, trees } = forest(items);
  const { H, F } = normalizers(items);
  let best = new Float64Array([0]);
  const solved = [], splits = [];
  for (const t of trees) {
    let arr;
    if (t.cap >= t.U) {
      const store = treeDP(nodes, t.ids, maxUnits, lam, H, F);
      solved.push({ kind: "dp", root: t.root, store });
      arr = store.get(t.root).O;
    } else {
      const e = treeEnum(nodes, t.ids, t.cap, maxUnits, lam, H, F);
      solved.push({ kind: "enum", ids: t.ids, arr: e.arr, arg: e.arg });
      arr = e.arr;
    }
    const m = maxplus(best, arr, maxUnits);
    best = m.res;
    splits.push(m.split);
  }
  best = ext(best, maxUnits + 1);

  function walk(store, vid, state, k, chosen) {
    const st = store.get(vid);
    const arr = state === "O" ? st.O : st.C;
    const fix = state === "O" ? st.fixO : st.fixC;
    k = Math.min(k, arr.length - 1);
    let childState = "C";
    if (fix[k]) { chosen.push(vid); k -= nodes.get(vid).cost; childState = state; }
    const merges = childState === "O" ? st.mergeO : st.mergeC;
    for (let j = merges.length - 1; j >= 0; j--) {
      const [cid, split, prevLen] = merges[j];
      const kk = Math.min(k, split.length - 1);
      const kc = split[kk];
      walk(store, cid, childState, kc, chosen);
      k = Math.min(kk - kc, prevLen - 1);
    }
  }

  function plan(units) {
    let k = Math.min(units, best.length - 1);
    const chosen = [];
    for (let j = solved.length - 1; j >= 0; j--) {
      const split = splits[j];
      const kr = split[Math.min(k, split.length - 1)];
      const t = solved[j];
      if (t.kind === "dp") walk(t.store, t.root, "O", kr, chosen);
      else {
        const m = t.arg[Math.min(kr, t.arr.length - 1)];
        t.ids.forEach((id, b) => { if ((m >> b) & 1) chosen.push(id); });
      }
      k -= kr;
    }
    return chosen;
  }

  return { best, plan, H, F };
}

/**
 * Capped habitat, flood and cost for a plan.
 * Returns `open` (culverts whose path to the anchor is open) and `treeMiles` (root -> miles).
 */
export function evaluate(items, ids) {
  const { nodes, trees } = forest(items);
  const s = new Set(ids);
  const open = new Set();
  const treeMiles = new Map();
  let miles = 0, flood = 0, cost = 0;
  for (const id of s) { const d = nodes.get(id); flood += d.flood; cost += d.cost; }
  for (const t of trees) {
    let h = 0;
    for (const v of t.ids) {
      const p = nodes.get(v).parent;
      if (s.has(v) && (!p || !nodes.has(p) || open.has(p))) { open.add(v); h += nodes.get(v).habitat; }
    }
    const got = Math.min(h, t.cap);
    if (got > 0) treeMiles.set(t.root, got);
    miles += got;
  }
  return { miles, flood, cost, n: s.size, open, treeMiles };
}

/** One-at-a-time ranking: fund items by descending score while they fit. */
export function rankPlan(items, units, score) {
  const sorted = [...items].sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1));
  const chosen = [];
  let spent = 0;
  for (const d of sorted) {
    if (spent + d.cost <= units) { chosen.push(d.id); spent += d.cost; }
  }
  return chosen;
}
