"""Exact budgeted culvert-replacement optimizer on a forest of stream networks.

Problem
  Choose a set S of culverts with total cost <= budget to maximize
      (1 - lam) * habitat(S) / H  +  lam * flood(S) / F
  The culverts form trees. Each tree hangs from an anchor: the river network below its
  lowest culvert, bounded by a dam, waterfall or the outlet, of length D_T.
  habitat(S) = sum over trees T of  min( sum of upstream miles of culverts in T whose path
               down to the anchor is open,  D_T ).
               For one culvert this is exactly the inventory's gain, min(upstream, downstream).
               For a chain it is the river reconnected to the anchor, capped by what the river
               below can hold.
  flood(S)   = sum of washout-risk scores of culverts in S (no path condition).
  H normalizes by the best possible habitat, F by the total flood score.

Method (exact)
  * Trees where the cap cannot bind (D_T >= total upstream miles in T): tree DP with two
    states per node, river below OPEN or CLOSED.
        O_v = max( merge_c C_c ,  shift_w( val_open_v   + merge_c O_c ) )
        C_v = max( merge_c C_c ,  shift_w( val_closed_v + merge_c C_c ) )
  * Trees where it can bind (44 in NC, at most 15 culverts): enumerate every subset.
  * Trees are joined with a max-plus convolution over budget, so one pass gives the
    optimum for every budget up to B.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

import numpy as np

NEG = -1e18
MAX_ENUM = 18


@dataclass
class Node:
    id: str
    parent: str | None
    habitat: float  # upstream miles
    flood: float  # washout-risk score
    cost: int  # cost units (>= 1)
    anchor: float | None = None  # D_T, only read on tree roots; None means uncapped
    children: list = field(default_factory=list)


def _ext(a: np.ndarray, n: int) -> np.ndarray:
    if len(a) >= n:
        return a[:n]
    return np.concatenate([a, np.full(n - len(a), a[-1])])


def maxplus(a: np.ndarray, b: np.ndarray, cap: int) -> tuple[np.ndarray, np.ndarray]:
    """res[k] = max_i a[k-i] + b[i]; split[k] = budget given to b."""
    n = min(len(a) + len(b) - 1, cap + 1)
    a_ext = _ext(a, n)
    res = np.full(n, NEG)
    split = np.zeros(n, dtype=np.int32)
    for i in range(min(len(b), n)):
        cand = b[i] + a_ext[: n - i]
        better = cand > res[i:]
        res[i:][better] = cand[better]
        split[i:][better] = i
    return res, split


def link(nodes: dict[str, Node]) -> list[str]:
    for n in nodes.values():
        n.children = []
    roots = []
    for n in nodes.values():
        if n.parent is not None and n.parent in nodes:
            nodes[n.parent].children.append(n.id)
        else:
            roots.append(n.id)
    return roots


def subtree(nodes, r) -> list[str]:
    out, stack = [], [r]
    while stack:
        v = stack.pop()
        out.append(v)
        stack.extend(nodes[v].children)
    return out  # parents before children


def tree_cap(nodes, r, ids) -> float:
    a = nodes[r].anchor
    return float("inf") if a is None else float(a)


def normalizers(nodes) -> tuple[float, float]:
    roots = link(nodes)
    H = 0.0
    for r in roots:
        ids = subtree(nodes, r)
        H += min(sum(nodes[i].habitat for i in ids), tree_cap(nodes, r, ids))
    F = sum(n.flood for n in nodes.values())
    return (H or 1.0), (F or 1.0)


@dataclass
class Solution:
    best: np.ndarray
    nodes: dict
    H: float
    F: float
    _trees: list  # (root, kind, payload)
    _root_splits: list

    def plan(self, budget_units: int) -> list[str]:
        k = min(budget_units, len(self.best) - 1)
        chosen: list[str] = []
        for (idx, split) in reversed(self._root_splits):
            kr = int(split[min(k, len(split) - 1)])
            root, kind, pay = self._trees[idx]
            if kind == "dp":
                self._walk(pay, root, "O", kr, chosen)
            else:
                ids, arr, mask = pay
                kk = min(kr, len(arr) - 1)
                m = int(mask[kk])
                chosen.extend(i for j, i in enumerate(ids) if m >> j & 1)
            k = k - kr
        return chosen

    def _walk(self, store, vid, state, k, chosen):
        st = store[vid]
        arr, fix = (st["O"], st["fixO"]) if state == "O" else (st["C"], st["fixC"])
        k = min(k, len(arr) - 1)
        if fix[k]:
            chosen.append(vid)
            k -= self.nodes[vid].cost
            child_state = state
        else:
            child_state = "C"
        merges = st["mergeO"] if child_state == "O" else st["mergeC"]
        for (cid, split, prev_len) in reversed(merges):
            kk = min(k, len(split) - 1)
            kc = int(split[kk])
            self._walk(store, cid, child_state, kc, chosen)
            k = min(kk - kc, prev_len - 1)


def _tree_dp(nodes, ids, B, lam, H, F):
    store = {}
    for vid in reversed(ids):  # children before parents
        v = nodes[vid]
        mO, mC = np.zeros(1), np.zeros(1)
        mergeO, mergeC = [], []
        for cid in v.children:
            prev = len(mO)
            mO, sO = maxplus(mO, store[cid]["O"], B)
            mergeO.append((cid, sO, prev))
            prev = len(mC)
            mC, sC = maxplus(mC, store[cid]["C"], B)
            mergeC.append((cid, sC, prev))
        val_open = (1 - lam) * v.habitat / H + lam * v.flood / F
        val_closed = lam * v.flood / F
        n = min(max(len(mO), len(mC)) + v.cost, B + 1)
        notfix = _ext(mC, n)
        fo = np.full(n, NEG)
        fc = np.full(n, NEG)
        if v.cost < n:
            fo[v.cost:] = val_open + _ext(mO, n - v.cost)
            fc[v.cost:] = val_closed + _ext(mC, n - v.cost)
        store[vid] = {"O": np.maximum(notfix, fo), "C": np.maximum(notfix, fc), "fixO": fo > notfix, "fixC": fc > notfix,
                      "mergeO": mergeO, "mergeC": mergeC}
    return store


def _tree_enum(nodes, ids, cap, B, lam, H, F):
    k = len(ids)
    if k > MAX_ENUM:
        raise ValueError(f"capped tree with {k} culverts is too large to enumerate")
    pos = {v: j for j, v in enumerate(ids)}
    masks = np.arange(1 << k, dtype=np.int64)
    sel = ((masks[:, None] >> np.arange(k)) & 1).astype(bool)
    cost = sel @ np.array([nodes[v].cost for v in ids])
    is_open = np.zeros_like(sel)
    for v in ids:  # parents come first
        j = pos[v]
        p = nodes[v].parent
        is_open[:, j] = sel[:, j] & (is_open[:, pos[p]] if p in pos else True)
    hab = np.minimum(is_open @ np.array([nodes[v].habitat for v in ids]), cap)
    flood = sel @ np.array([nodes[v].flood for v in ids])
    val = (1 - lam) * hab / H + lam * flood / F
    n = int(min(cost.max(), B)) + 1
    arr = np.zeros(n)
    arg = np.zeros(n, dtype=np.int64)
    ok = cost < n
    order = np.lexsort((-val[ok], cost[ok]))  # by cost, best value first
    c_ok, v_ok, m_ok = cost[ok][order], val[ok][order], masks[ok][order]
    first = np.r_[True, c_ok[1:] != c_ok[:-1]]
    exact = np.full(n, NEG)
    exact_m = np.zeros(n, dtype=np.int64)
    exact[c_ok[first]] = v_ok[first]
    exact_m[c_ok[first]] = m_ok[first]
    best, bm = NEG, 0
    for c in range(n):  # turn "exactly c" into "at most c"
        if exact[c] > best:
            best, bm = exact[c], exact_m[c]
        arr[c], arg[c] = best, bm
    return arr, arg


def solve(nodes: dict[str, Node], budget_units: int, lam: float = 0.0) -> Solution:
    H, F = normalizers(nodes)
    roots = link(nodes)
    trees = []
    best = np.zeros(1)
    root_splits = []
    for r in roots:
        ids = subtree(nodes, r)
        cap = tree_cap(nodes, r, ids)
        if cap >= sum(nodes[i].habitat for i in ids):
            store = _tree_dp(nodes, ids, budget_units, lam, H, F)
            trees.append((r, "dp", store))
            arr = store[r]["O"]
        else:
            arr, mask = _tree_enum(nodes, ids, cap, budget_units, lam, H, F)
            trees.append((r, "enum", (ids, arr, mask)))
        best, s = maxplus(best, arr, budget_units)
        root_splits.append((len(trees) - 1, s))
    best = _ext(best, budget_units + 1)
    return Solution(best=best, nodes=nodes, H=H, F=F, _trees=trees, _root_splits=root_splits)


def evaluate(nodes: dict[str, Node], chosen) -> dict:
    """Capped habitat miles, flood score and cost of a plan."""
    s = set(chosen)
    roots = link(nodes)
    habitat = 0.0
    for r in roots:
        ids = subtree(nodes, r)
        open_miles = 0.0
        is_open = {}
        for v in ids:
            p = nodes[v].parent
            is_open[v] = v in s and (is_open[p] if p in is_open else True)
            if is_open[v]:
                open_miles += nodes[v].habitat
        habitat += min(open_miles, tree_cap(nodes, r, ids))
    return {
        "habitat_miles": habitat,
        "flood": sum(nodes[v].flood for v in s),
        "cost_units": sum(nodes[v].cost for v in s),
        "n": len(s),
    }


def objective(nodes, chosen, lam: float) -> float:
    H, F = normalizers(nodes)
    e = evaluate(nodes, chosen)
    return (1 - lam) * e["habitat_miles"] / H + lam * e["flood"] / F


def rank_plan(nodes: dict[str, Node], budget_units: int, score: dict[str, float]) -> list[str]:
    """One-at-a-time ranking: fund culverts in descending score while they fit the budget."""
    chosen, spent = [], 0
    for vid in sorted(score, key=lambda x: (-score[x], x)):
        if spent + nodes[vid].cost <= budget_units:
            chosen.append(vid)
            spent += nodes[vid].cost
    return chosen


def brute_force(nodes: dict[str, Node], budget_units: int, lam: float) -> float:
    ids = list(nodes)
    best = 0.0
    for r in range(len(ids) + 1):
        for combo in combinations(ids, r):
            if sum(nodes[i].cost for i in combo) <= budget_units:
                best = max(best, objective(nodes, combo, lam))
    return best
