"""Statewide comparison: network-aware optimal plans vs one-at-a-time ranking.

For every NC HUC8 with enough assessed culverts and every budget, compare
  optimal      exact tree DP (pipeline/optimizer.py)
  rank_gain    one-at-a-time ranking by individual gain miles (how barriers are ranked today)
  rank_ratio   one-at-a-time ranking by gain miles per dollar (a stronger baseline)
on two metrics:
  reconnected_miles   miles reconnected to the anchor network (the objective)
  inventory_gain      the inventory's own gain, min(upstream, downstream), generalized to any
                      set of removals (see component_gain). It also credits fragment-to-fragment
                      joins, so it is NOT the optimized metric.
Cost uncertainty: 200 lognormal draws (sigma 0.5) per culvert; both methods see the draw.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from optimizer import Node, evaluate, rank_plan, solve  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
UNIT = 25_000  # dollars per cost unit
BUDGETS_M = [1, 2, 5, 10]
MIN_CULVERTS = 15
SHOWCASE = 6010105
RNG = np.random.default_rng(20261003)


def build_nodes(df: pd.DataFrame, costs=None) -> dict:
    costs = df.cost_usd.to_numpy() if costs is None else costs
    return {
        r.sarpid: Node(
            id=r.sarpid,
            parent=r.parent if isinstance(r.parent, str) else None,
            habitat=float(r.totalupstreammiles),
            flood=float(r.flood_risk),
            cost=max(1, int(round(c / UNIT))),
            anchor=None if isinstance(r.parent, str) else float(r.anchor_miles),
        )
        for r, c in zip(df.itertuples(), costs)
    }


def component_gain(df: pd.DataFrame, chosen) -> float:
    """The inventory's gain, min(upstream, downstream), generalized to any set of removals.

    Pieces are each culvert's upstream functional network plus each tree's anchor network.
    Removing a culvert merges its piece into the piece below it. A merged network gains its
    total length minus its largest original piece. For one removal this is exactly min(up, down),
    including culverts whose downstream side is only the fragment below another culvert.
    """
    s = set(chosen)
    parent = {k: (v if isinstance(v, str) else None) for k, v in zip(df.sarpid, df.parent)}
    up = dict(zip(df.sarpid, df.totalupstreammiles))
    root_of = dict(zip(df.sarpid, df.tree_root))
    anchor = dict(zip(df.tree_root, df.anchor_miles))
    comp = {}
    for v in df.sarpid:
        x = v
        while x in s:
            x = parent[x] if parent[x] is not None else "A:" + root_of[v]
            if x.startswith("A:"):
                break
        comp.setdefault(x, []).append(up[v])
    for r, a in anchor.items():
        comp.setdefault("A:" + r, []).append(a)
    return sum(sum(p) - max(p) for p in comp.values())


def compare(df: pd.DataFrame, budget_units: int, nodes=None, lam: float = 0.0) -> dict:
    nodes = nodes or build_nodes(df)
    sol = solve(nodes, budget_units, lam)
    plans = {
        "optimal": sol.plan(budget_units),
        "rank_gain": rank_plan(nodes, budget_units, dict(zip(df.sarpid, df.gainmiles))),
        "rank_ratio": rank_plan(
            nodes, budget_units, {i: g / nodes[i].cost for i, g in zip(df.sarpid, df.gainmiles)}
        ),
    }
    out = {}
    for k, p in plans.items():
        e = evaluate(nodes, p)
        stranded = [v for v in p if nodes[v].parent and nodes[v].parent not in set(p)]
        out[k] = {
            "miles": e["habitat_miles"],
            "access": component_gain(df, p),
            "spent": e["cost_units"] * UNIT,
            "n": e["n"],
            "stranded_share": sum(nodes[v].cost for v in stranded) / max(1, e["cost_units"]),
            "plan": p,
        }
    return out


def main() -> None:
    df = pd.read_csv(ROOT / "data" / "processed" / "culverts_nc.csv")
    res_dir = ROOT / "results"
    res_dir.mkdir(exist_ok=True)
    rows = []
    hucs = df.groupby("huc8").filter(lambda g: len(g) >= MIN_CULVERTS)
    for huc, g in hucs.groupby("huc8"):
        g = g.reset_index(drop=True)
        base_access = 0.0
        for bm in BUDGETS_M:
            r = compare(g, int(bm * 1e6 / UNIT))
            for method, m in r.items():
                rows.append({"huc8": huc, "subbasin": g.subbasin.iloc[0], "n_culverts": len(g), "budget_m": bm,
                             "method": method, "miles": round(m["miles"], 3),
                             "inventory_gain": round(m["access"] - base_access, 4), "spent": m["spent"],
                             "n_selected": m["n"], "stranded_share": round(m["stranded_share"], 4)})
    res = pd.DataFrame(rows)
    res.to_csv(res_dir / "statewide.csv", index=False)

    piv = res.pivot_table(index=["huc8", "subbasin", "n_culverts", "budget_m"], columns="method",
                          values=["miles", "inventory_gain", "stranded_share"]).reset_index()
    summary = {"watersheds": int(hucs.huc8.nunique()), "culverts": int(len(hucs)), "unit_usd": UNIT, "by_budget": {}}
    for bm in BUDGETS_M:
        p = piv[piv.budget_m == bm]
        mo, mg, mr = p[("miles", "optimal")].sum(), p[("miles", "rank_gain")].sum(), p[("miles", "rank_ratio")].sum()
        ao, ag, ar = (p[("inventory_gain", k)].sum() for k in ["optimal", "rank_gain", "rank_ratio"])
        summary["by_budget"][f"${bm}M per watershed"] = {
            "miles_optimal": round(mo, 1), "miles_rank_gain": round(mg, 1), "miles_rank_ratio": round(mr, 1),
            "x_vs_rank_gain": round(mo / mg, 2) if mg else None, "x_vs_rank_ratio": round(mo / mr, 2) if mr else None,
            "inventory_gain_optimal": round(ao, 2), "inventory_gain_rank_gain": round(ag, 2), "inventory_gain_rank_ratio": round(ar, 2),
            "watersheds_optimal_beats_rank_gain_by_10pct": int((p[("miles", "optimal")] >= 1.1 * p[("miles", "rank_gain")]).sum()),
            "median_stranded_share_rank_gain": round(float(p[("stranded_share", "rank_gain")].median()), 3),
            "mean_stranded_share_rank_gain": round(float(p[("stranded_share", "rank_gain")].mean()), 3),
        }

    # Cost robustness: does the advantage survive cost uncertainty?
    bu = int(5e6 / UNIT)
    ratios, ratios_r = [], []
    for _ in range(200):
        tot = {"optimal": 0.0, "rank_gain": 0.0, "rank_ratio": 0.0}
        for huc, g in hucs.groupby("huc8"):
            g = g.reset_index(drop=True)
            draw = g.cost_usd.to_numpy() * RNG.lognormal(0.0, 0.5, len(g))
            r = compare(g, bu, nodes=build_nodes(g, draw))
            for k in tot:
                tot[k] += r[k]["miles"]
        ratios.append(tot["optimal"] / tot["rank_gain"])
        ratios_r.append(tot["optimal"] / tot["rank_ratio"])
    summary["cost_monte_carlo_$5M"] = {
        "draws": 200, "sigma_lognormal": 0.5,
        "x_vs_rank_gain_p5_p50_p95": [round(float(np.percentile(ratios, q)), 2) for q in (5, 50, 95)],
        "x_vs_rank_ratio_p5_p50_p95": [round(float(np.percentile(ratios_r, q)), 2) for q in (5, 50, 95)],
        "share_draws_optimal_better_than_rank_gain": float(np.mean(np.array(ratios) > 1)),
    }

    # Showcase watershed: selection frequency under cost uncertainty, and the river-vs-road trade-off.
    g = df[df.huc8 == SHOWCASE].reset_index(drop=True)
    freq = {i: 0 for i in g.sarpid}
    for _ in range(200):
        draw = g.cost_usd.to_numpy() * RNG.lognormal(0.0, 0.5, len(g))
        nodes = build_nodes(g, draw)
        for v in solve(nodes, bu, 0.0).plan(bu):
            freq[v] += 1
    (res_dir / f"robustness_{SHOWCASE}.json").write_text(json.dumps({k: v / 200 for k, v in freq.items()}))
    nodes = build_nodes(g)
    pareto = []
    for lam in np.linspace(0, 1, 11):
        e = evaluate(nodes, solve(nodes, bu, float(lam)).plan(bu))
        pareto.append({"lam": round(float(lam), 2), "miles": round(e["habitat_miles"], 2), "flood": round(e["flood"], 3)})
    summary["showcase_pareto_$5M"] = pareto

    (res_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
