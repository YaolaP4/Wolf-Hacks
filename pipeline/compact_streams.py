"""Convert a stream-network GeoJSON into Pinchpoint's compact format.

Same lines and attributes, much smaller:
  * consecutive pieces of the same network and stream order are merged (direction kept,
    so every piece still runs downstream and splits stay at confluences and barriers);
  * coordinates (already rounded to 1e-5 degrees, about 1 m) become integer offsets
    from the previous vertex.

Format: {"v": 1, "scale": 100000, "nets": [network ids], "f": [[net index, stream order,
x0, y0, dx1, dy1, ...], ...]}. app/main.js (decodeStreams) turns it back into GeoJSON.

Usage: python pipeline/compact_streams.py data/processed/streams/streams_06010105.geojson [...]
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

import shapely
from shapely.geometry import LineString, MultiLineString

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "data" / "streams"
SCALE = 100_000


def compact(path: Path) -> Path:
    gj = json.loads(path.read_text())
    groups = defaultdict(list)
    for f in gj["features"]:
        groups[(f["properties"]["net"], f["properties"]["o"])].append(f["geometry"]["coordinates"])
    nets, index, feats = [], {}, []
    for (net, o), parts in groups.items():
        if net not in index:
            index[net] = len(nets)
            nets.append(net)
        merged = shapely.line_merge(MultiLineString(parts), directed=True)
        # line_merge can return a GeometryCollection or nested multi-parts; flatten to LineStrings
        lines = [g for g in shapely.get_parts(merged) if g.geom_type == "LineString" and not g.is_empty]
        for line in lines:
            pts = [(round(x * SCALE), round(y * SCALE)) for x, y in line.coords]
            row = [index[net], o, pts[0][0], pts[0][1]]
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                if x1 == x0 and y1 == y0:
                    continue
                row += [x1 - x0, y1 - y0]
            feats.append(row)
    out = OUT / path.name.replace(".geojson", ".json")
    out.write_text(json.dumps({"v": 1, "scale": SCALE, "nets": nets, "f": feats}, separators=(",", ":")))
    print(f"{path.name}: {len(gj['features'])} pieces -> {len(feats)} lines, "
          f"{path.stat().st_size / 1e6:.2f} MB -> {out.stat().st_size / 1e6:.2f} MB")
    return out


if __name__ == "__main__":
    for p in sys.argv[1:]:
        compact(Path(p))
