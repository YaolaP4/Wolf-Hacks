**Top 3**

**1. I16, merged with I01 (Henderson County only).** This is the most buildable idea with a strong wow. Hour one: an OSMnx drive graph for Henderson, NABI crossings snapped to edges, hospitals from OSM, Census block centroids. Removing each candidate edge and running a BFS from the hospitals is seconds of compute. You have a working isolation ranking by dinner, and everything after that is polish. The "Helene replay" demo is a slider that fails crossings in order of drainage area. **Change:** merge in I01's slope cuts as a second failure type in the same engine, and confine the study area to Henderson, where the NCGS landslide inventory is VERIFIED. That swaps I16's UNVERIFIED closure back-test for a validation you can actually run: spatially held-out landslide clusters for the hazard screen, plus a brute-force check of every isolation count against nx.bridges.

**2. I12 Ten-Minute Shelter Gap.** Every input is VERIFIED, every step is a library call (OSMnx walk isochrones, greedy max-coverage), and the 11 AM demo can't fail: click a park, its 10-minute polygon contains no shelter, place a safe room, the coverage count jumps. **Change:** make the park detector purely geometric (minimum rotated rectangle 4–5 × 18–25 m, then DBSCAN clustering), no ML, and lead with one number: recall against HIFLD in one county. That number is your Execution score. Build it before the isochrones.

**3. I10 Ghost Addresses.** Lowest risk on the list, and the only idea with an outcome back-test built from VERIFIED data. The spatial join runs in minutes, which leaves 12+ hours for ranking and UI. **Change:** in hour one, confirm that AddressNC New Locations carries add dates and that the footprints predate them. If both hold, headline precision@k of "flagged, then later addressed" against a size-only baseline. If not, drop it, because it's a data-cleaning script with nothing to validate.

These three fail in different ways: road network fragility, walking access to fixed shelters, and gaps in administrative records.

**Kill**

**I06 Unknown Lines.** The labeled service-line inventories are UNVERIFIED, so the classifier has no labels, no training set and no held-out test. It can't be built today. Stop considering it.

**I14 RidgeRelay.** This is the trap because it's the builder's home field (channel assignment, Steiner trees). The idea itself admits there's no real RF validation in 20 hours, so the demo comes down to "trust my Fresnel math" in front of geospatial judges. You'd spend the night tuning an integer program whose output nobody can check. If you want a wireless angle with real ground truth, that's I08, not this.
