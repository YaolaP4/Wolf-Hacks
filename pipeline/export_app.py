"""Export compact JSON for the web app (app/data/)."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app" / "data"
APP.mkdir(parents=True, exist_ok=True)
SHOWCASE = 6010105


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
            "chains": int(g.parent.notna().sum()),
            "miles": round(float(g.totalupstreammiles.sum()), 1),
        })
    sheds.sort(key=lambda s: -s["n"])
    (APP / "watersheds.json").write_text(json.dumps(sheds, separators=(",", ":")))

    summ = ROOT / "results" / "summary.json"
    if summ.exists():
        (APP / "summary.json").write_text(summ.read_text())
    print(f"exported {len(culverts)} culverts, {len(sheds)} watersheds")


if __name__ == "__main__":
    main()
