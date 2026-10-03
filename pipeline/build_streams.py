"""Rebuild functional river networks from USGS NHDPlus HR and export them for the map.

Every barrier (assessed culvert or dam that cuts the network) is placed on its NHDPlus HR
flowline. Each stretch of river belongs to the first barrier downstream of it. That barrier's
upstream functional network is all stretches it owns. Recomputed miles are compared with the
inventory's `totalupstreammiles` as an independent check, and the stretches are exported with a
`net` property so the app can light up exactly the river a plan reconnects.

Usage: python pipeline/build_streams.py 06010105
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
from shapely import force_2d
from shapely.geometry import LineString, MultiLineString, Point, mapping
from shapely.ops import linemerge, substring

ROOT = Path(__file__).resolve().parents[1]
HUC8 = sys.argv[1] if len(sys.argv) > 1 else "06010105"
GDB = next((ROOT / "data" / "raw").glob(f"nhdplushr_{HUC8[:4]}/*.gdb"))
OUT = ROOT / "app" / "data" / "streams"
OUT.mkdir(parents=True, exist_ok=True)
KM_TO_MI = 0.621371


def as_line(g):
    g = force_2d(g)
    if isinstance(g, MultiLineString):
        m = linemerge(g)
        g = m if isinstance(m, LineString) else max(m.geoms, key=lambda x: x.length)
    return g


def main() -> None:
    fl = pyogrio.read_dataframe(GDB, layer="NHDFlowline", columns=["NHDPlusID", "ReachCode", "LengthKM", "FlowDir", "FType"],
                                where=f"ReachCode LIKE '{HUC8}%'")
    vaa = pyogrio.read_dataframe(GDB, layer="NHDPlusFlowlineVAA", columns=["NHDPlusID", "HydroSeq", "DnHydroSeq", "StreamOrde"],
                                 read_geometry=False)
    fl = fl.merge(vaa, on="NHDPlusID", how="inner")
    fl = fl[fl.HydroSeq > 0].copy()
    if fl.crs is not None and fl.crs.to_epsg() != 4326:
        fl = fl.to_crs(4326)
    fl["NHDPlusID"] = fl.NHDPlusID.astype("int64")
    fl["geometry"] = fl.geometry.apply(as_line)
    print(f"{HUC8}: {len(fl)} network flowlines, CRS {fl.crs}")

    sb = pd.read_csv(ROOT / "data" / "raw" / "nabi_small_barriers_NC.csv", low_memory=False)
    dams = pd.read_csv(ROOT / "data" / "raw" / "nabi_dams_NC.csv", low_memory=False)
    cand = pd.read_csv(ROOT / "data" / "processed" / "culverts_nc.csv")
    cand = cand[cand.huc8 == int(HUC8)]
    bars = pd.concat([
        sb[(sb.hasnetwork == "yes") & (sb.removed != "yes")][["sarpid", "lat", "lon", "totalupstreammiles"]].assign(kind="culvert"),
        dams[dams.hasnetwork == "yes"][["sarpid", "lat", "lon", "totalupstreammiles"]].assign(kind="dam"),
    ])
    x0, y0, x1, y1 = fl.total_bounds
    bars = bars[bars.lon.between(x0, x1) & bars.lat.between(y0, y1)]
    # The inventory snaps to a newer NHDPlus HR release whose IDs differ from the published
    # regional geodatabase, so barriers are placed on the nearest flowline within 50 m.
    pts = gpd.GeoDataFrame(bars, geometry=gpd.points_from_xy(bars.lon, bars.lat), crs=4326).to_crs(5070)
    lines = fl[["NHDPlusID", "geometry"]].to_crs(5070)
    j = gpd.sjoin_nearest(pts, lines, max_distance=50, distance_col="dist").sort_values("dist").drop_duplicates("sarpid")
    bars = j[["sarpid", "lat", "lon", "totalupstreammiles", "kind", "NHDPlusID", "dist"]].rename(columns={"NHDPlusID": "nhdplusid"})
    print(f"barriers placed on these flowlines: {len(bars)} ({(bars.kind == 'culvert').sum()} culverts, "
          f"{(bars.kind == 'dam').sum()} dams), median snap {bars.dist.median():.1f} m")

    geom = dict(zip(fl.NHDPlusID, fl.geometry))
    on_line: dict[int, list] = {}
    for b in bars.itertuples():
        frac = geom[b.nhdplusid].project(Point(b.lon, b.lat), normalized=True)
        on_line.setdefault(b.nhdplusid, []).append((frac, b.sarpid))
    for v in on_line.values():
        v.sort()

    by_hs = dict(zip(fl.HydroSeq, fl.NHDPlusID))
    down_owner: dict[int, str] = {}
    for r in fl.sort_values("HydroSeq").itertuples():  # ascending HydroSeq = downstream first
        nxt = by_hs.get(r.DnHydroSeq)
        if nxt is None:
            down_owner[r.NHDPlusID] = "out"
        elif nxt in on_line:
            down_owner[r.NHDPlusID] = on_line[nxt][0][1]
        else:
            down_owner[r.NHDPlusID] = down_owner.get(nxt, "out")

    segs = []
    for r in fl.itertuples():
        cuts = on_line.get(r.NHDPlusID, [])
        bounds = [0.0] + [c[0] for c in cuts] + [1.0]
        owners = [c[1] for c in cuts] + [down_owner[r.NHDPlusID]]
        for a, b, o in zip(bounds[:-1], bounds[1:], owners):
            if b - a <= 1e-9:
                continue
            segs.append((r.NHDPlusID, a, b, o, r.LengthKM * (b - a) * KM_TO_MI, int(r.StreamOrde)))
    seg = pd.DataFrame(segs, columns=["nhd", "a", "b", "net", "miles", "o"])

    miles = seg.groupby("net").miles.sum()
    cmp = cand[["sarpid", "totalupstreammiles"]].copy()
    cmp["ours"] = cmp.sarpid.map(miles).fillna(0.0)
    cmp = cmp[cmp.totalupstreammiles > 0.1]
    cmp["rel"] = (cmp.ours - cmp.totalupstreammiles).abs() / cmp.totalupstreammiles
    val = {"huc8": HUC8, "n": int(len(cmp)), "within5": float((cmp.rel <= 0.05).mean()),
           "within10": float((cmp.rel <= 0.10).mean()), "medianErr": float(cmp.rel.median() * 100)}
    cmp.to_csv(ROOT / "results" / f"stream_validation_{HUC8}.csv", index=False)
    (ROOT / "app" / "data" / "validation.json").write_text(json.dumps(val))
    print("validation vs inventory upstream miles:", val)

    # export: candidate networks, their anchor networks, and main stems for context
    cand_ids = set(cand.sarpid)
    anchors = set(cand.loc[cand.parent.isna(), "downstreambarriersarpid"].dropna())
    keep = seg[seg.net.isin(cand_ids) | seg.net.isin(anchors) | (seg.o >= 4)]
    feats = []
    for r in keep.itertuples():
        line = geom[r.nhd]
        part = line if (r.a <= 0 and r.b >= 1) else substring(line, r.a, r.b, normalized=True)
        part = part.simplify(0.00006, preserve_topology=False)
        if part.is_empty or part.geom_type != "LineString":
            continue
        coords = np.round(np.asarray(part.coords), 5).tolist()
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                      "properties": {"net": r.net, "o": r.o}})
    path = OUT / f"streams_{HUC8}.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))
    man_path = OUT / "manifest.json"
    man = json.loads(man_path.read_text()) if man_path.exists() else {"hucs": []}
    if HUC8 not in man["hucs"]:
        man["hucs"].append(HUC8)
    man_path.write_text(json.dumps(man))
    print(f"wrote {len(feats)} stream segments ({path.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
