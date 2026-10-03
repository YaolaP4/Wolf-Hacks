"""Build the culvert forest for North Carolina from the National Aquatic Barrier Inventory.

Each assessed culvert that cuts the stream network becomes a node. Its parent is the
next barrier downstream (`downstreambarriersarpid`). Dams, waterfalls and culverts with
no upstream habitat are fixed: they cannot be part of a plan, and each one (or the
river outlet) anchors a tree of candidate culverts above it.

Outputs
  data/processed/culverts_nc.csv   one row per candidate culvert, with cost and flood fields
  data/processed/topology_check.csv  integrity check of the parent links
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

CANDIDATE_SEVERITY = {
    "Complete barrier",
    "Moderate barrier",
    "Barrier - unknown severity",
    "Likely barrier",
    "Indeterminate barrier",
    "Unknown",
}

# Planning-level cost model (assumption, documented in docs/methods.md).
# Stream-simulation span ~ 1.2 x bankfull width + 2 ft, bankfull width from NC regional curves
# (mountain: 19.9 * DA^0.36, piedmont/coastal: 11.89 * DA^0.43; ft and sq mi).
MOBILIZATION = 40_000
PER_FT_SPAN = {"Paved": 12_000, "Railroad": 25_000, "Unpaved": 6_000, "Unknown": 9_000}
MOUNTAIN_HUC2 = {6, 5}  # Tennessee and Ohio drainages in NC are mountain streams

CONSTRICTION_SCORE = {
    "Severe": 1.0,
    "Moderate": 0.6,
    "Minor": 0.25,
    "Spans only bankfull/active channel": 0.1,
    "Spans full channel & banks": 0.0,
    "Unknown": 0.5,
}
ROAD_CONSEQUENCE = {"Paved": 1.0, "Railroad": 1.0, "Unpaved": 0.5, "Unknown": 0.7}


def bankfull_width_ft(da_sqkm: np.ndarray, mountain: np.ndarray) -> np.ndarray:
    da_sqmi = np.clip(da_sqkm, 0.01, None) / 2.58999
    return np.where(mountain, 19.9 * da_sqmi**0.36, 11.89 * da_sqmi**0.43)


def main() -> None:
    sb = pd.read_csv(RAW / "nabi_small_barriers_NC.csv", low_memory=False)
    dams = pd.read_csv(RAW / "nabi_dams_NC.csv", low_memory=False)

    sb = sb[(sb.hasnetwork == "yes") & (sb.removed != "yes")].copy()
    sb["candidate"] = sb.barrierseverity.isin(CANDIDATE_SEVERITY)
    print(f"culverts cutting the network: {len(sb)}  candidates: {int(sb.candidate.sum())}")

    # Integrity check: a barrier's downstream functional network is its parent's upstream network.
    up_by_id = pd.concat(
        [
            sb[["sarpid", "totalupstreammiles"]],
            dams.loc[dams.hasnetwork == "yes", ["sarpid", "totalupstreammiles"]],
        ]
    ).drop_duplicates("sarpid").set_index("sarpid")["totalupstreammiles"]
    chk = sb[["sarpid", "downstreambarriersarpid", "downstreambarrier", "totaldownstreammiles", "freedownstreammiles"]].copy()
    chk["parent_upstream_miles"] = chk.downstreambarriersarpid.map(up_by_id)
    chk = chk.dropna(subset=["parent_upstream_miles"])
    chk["abs_err"] = (chk.totaldownstreammiles - chk.parent_upstream_miles).abs()
    chk.to_csv(OUT / "topology_check.csv", index=False)
    ok = (chk.abs_err <= 0.01 + 0.01 * chk.parent_upstream_miles).mean()
    print(
        f"topology check: {len(chk)} parent links resolvable; "
        f"{ok:.1%} match parent upstream miles within 1%; median abs err {chk.abs_err.median():.4f} mi"
    )

    cand = sb[sb.candidate].copy()
    cand_ids = set(cand.sarpid)
    # parent within the candidate set; otherwise the culvert sits directly on its anchor network
    cand["parent"] = cand.downstreambarriersarpid.where(cand.downstreambarriersarpid.isin(cand_ids))
    cand["anchor_kind"] = np.where(
        cand.parent.notna(), "culvert", cand.downstreambarrier.fillna("outlet").replace({"": "outlet"})
    )

    # each tree is identified by its root anchor; walk parents to the root candidate
    parent = dict(zip(cand.sarpid, cand.parent))
    def root_of(x):
        seen = set()
        while isinstance(parent.get(x), str) and x not in seen:
            seen.add(x)
            x = parent[x]
        return x
    cand["tree_root"] = cand.sarpid.map(root_of)
    root_down = dict(zip(cand.sarpid, cand.totaldownstreammiles))
    cand["anchor_miles"] = cand.tree_root.map(root_down)

    da = cand.totdasqkm.fillna(cand.totdasqkm.median()).to_numpy()
    mountain = cand.huc2.isin(MOUNTAIN_HUC2).to_numpy()
    span = 1.2 * bankfull_width_ft(da, mountain) + 2.0
    road = cand.roadtype.fillna("Unknown").where(cand.roadtype.isin(PER_FT_SPAN), "Unknown")
    cand["span_ft"] = span.round(1)
    cand["cost_usd"] = (MOBILIZATION + span * road.map(PER_FT_SPAN).to_numpy()).round(-3)

    load = np.log1p(da) / np.log1p(np.percentile(da, 95))
    cand["flood_constriction"] = cand.constriction.fillna("Unknown").map(CONSTRICTION_SCORE).fillna(0.5)
    cand["flood_load"] = np.clip(load, 0, 1).round(3)
    cand["flood_consequence"] = road.map(ROAD_CONSEQUENCE).to_numpy()
    cand["flood_risk"] = (cand.flood_constriction * cand.flood_load * cand.flood_consequence).round(4)

    keep = [
        "sarpid", "lat", "lon", "name", "river", "road", "roadtype", "crossingtype", "barrierseverity", "constriction",
        "huc8", "subbasin", "huc12", "subwatershed", "county", "totdasqkm", "streamorder", "trout", "tespp",
        "diadromoushabitat", "flowstoocean", "totalupstreammiles", "totaldownstreammiles", "freedownstreammiles",
        "gainmiles", "milestooutlet", "downstreambarriersarpid", "downstreambarrier", "parent", "anchor_kind",
        "tree_root", "anchor_miles", "span_ft", "cost_usd", "flood_constriction", "flood_load", "flood_consequence",
        "flood_risk", "nhdplusid", "url",
    ]
    cand[keep].to_csv(OUT / "culverts_nc.csv", index=False)
    print(f"wrote {len(cand)} candidate culverts in {cand.huc8.nunique()} HUC8s; "
          f"{cand.parent.notna().sum()} sit above another candidate (chains)")
    print("cost range ($k):", (cand.cost_usd.describe(percentiles=[.1, .5, .9]) / 1000).round(0).to_dict())


if __name__ == "__main__":
    main()
