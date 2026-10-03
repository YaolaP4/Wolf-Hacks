"""Export compact JSON for the web app (app/data/)."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app" / "data"
APP.mkdir(parents=True, exist_ok=True)
SHOWCASE = 6010105
UNIT = 25_000
BUDGETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import build_nodes  # noqa: E402
from optimizer import evaluate, rank_plan, solve  # noqa: E402


def planning_gain(g: pd.DataFrame) -> dict:
    """River miles for network-aware vs one-at-a-time plans at every app budget (rivers only)."""
    g = g.reset_index(drop=True)
    nodes = build_nodes(g)
    sol = solve(nodes, int(BUDGETS[-1] * 1e6 / UNIT), 0.0)
    gain = dict(zip(g.sarpid, g.gainmiles))
    opt, rank = [], []
    for b in BUDGETS:
        u = int(round(b * 1e6 / UNIT))
        opt.append(round(evaluate(nodes, sol.plan(u))["habitat_miles"], 2))
        rank.append(round(evaluate(nodes, rank_plan(nodes, u, gain))["habitat_miles"], 2))
    return {"opt": opt, "rank": rank}


def clean(x):
    if isinstance(x, float) and np.isnan(x):
        return None
    return x


def main() -> None:
    df = pd.read_csv(ROOT / "data" / "processed" / "culverts_nc.csv")
    robust_path = ROOT / "results" / f"robustness_{SHOWCASE}.json"
    robust = json.loads(robust_path.read_text()) if robust_path.exists() else {}

    culverts = []
    for r in df.itertuples():
        culverts.append({
            "id": r.sarpid,
            "lat": round(r.lat, 6), "lon": round(r.lon, 6),
            "huc8": f"{int(r.huc8):08d}",
            "name": clean(r.name), "river": clean(r.river), "road": clean(r.road),
            "roadType": clean(r.roadtype), "crossing": clean(r.crossingtype),
            "severity": clean(r.barrierseverity), "constriction": clean(r.constriction),
            "county": clean(r.county), "subwatershed": clean(r.subwatershed),
            "daSqKm": clean(round(r.totdasqkm, 3)) if not pd.isna(r.totdasqkm) else None,
            "up": round(r.totalupstreammiles, 3), "down": round(r.totaldownstreammiles, 3),
            "gain": round(r.gainmiles, 3),
            "parent": r.parent if isinstance(r.parent, str) else None,
            "root": r.tree_root, "anchorKind": r.anchor_kind, "anchorMiles": round(r.anchor_miles, 3),
            "spanFt": r.span_ft, "cost": int(r.cost_usd),
            "flood": r.flood_risk, "floodParts": [r.flood_constriction, r.flood_load, r.flood_consequence],
            "trout": clean(r.trout), "tespp": int(r.tespp) if not pd.isna(r.tespp) else 0,
            "nhdplusid": int(r.nhdplusid) if not pd.isna(r.nhdplusid) else None,
            "robust": robust.get(r.sarpid),
            "url": clean(r.url),
        })
    (APP / "culverts.json").write_text(json.dumps(culverts, separators=(",", ":")))

    sheds = []
    for huc, g in df.groupby("huc8"):
        sheds.append({
            "huc8": f"{int(huc):08d}", "name": g.subbasin.iloc[0], "n": len(g),
            "bbox": [round(g.lon.min(), 4), round(g.lat.min(), 4), round(g.lon.max(), 4), round(g.lat.max(), 4)],
            "view": [round(float(g.lon.quantile(0.05)), 4), round(float(g.lat.quantile(0.05)), 4),
                     round(float(g.lon.quantile(0.95)), 4), round(float(g.lat.quantile(0.95)), 4)] if len(g) >= 20 else None,
            "chains": int(g.parent.notna().sum()),
            "miles": round(float(g.totalupstreammiles.sum()), 1),
            **planning_gain(g),
        })
    sheds.sort(key=lambda s: -s["n"])
    (APP / "watersheds.json").write_text(json.dumps(sheds, separators=(",", ":")))

    summ = ROOT / "results" / "summary.json"
    if summ.exists():
        (APP / "summary.json").write_text(summ.read_text())
    print(f"exported {len(culverts)} culverts, {len(sheds)} watersheds")


if __name__ == "__main__":
    main()
