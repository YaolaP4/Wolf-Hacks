# Build plan: culvert optimizer (WolfHacks 2026, Geospatial track)

## Rules (from wolfhacks.org portal config, verified 3 Oct 2026)
- No previously existing work. All code is written during the event (hacking began Sat 11:00).
- DevPost submission by **Sun 11:00 AM**. Team present to demo at **12:30 PM**.
- **Cite AI usage properly in a README in the GitHub repo.**
- One track only: Center for Geospatial Analytics. Track and team must be finalized on DevPost and in the portal by **Sat 11:59 PM**.
- Teams need **2-4 people**.
- Judging, equal weight: Track / Technology ("wow") / Design / Execution.

## Framing (answering "culverts are niche")
Lead with roads and floods, then money, then rivers.
- Helene damaged 8,795 NC transportation sites, including 852 culverts (NCDOT, early 2025). Transportation recovery is about $5.8B.
- Undersized culverts both wash out in floods and block fish. Stream-simulation crossings survived Irene while undersized ones failed (Gillespie et al. 2014, *Fisheries* 39(2):62-76).
- $1B federal Culvert AOP program (IIJA, FY22-26). NC won 1 project ($472k) in FY22.
- The method gap: the public prioritization tool ranks barriers one at a time, but rivers are networks. An upstream culvert is worth nothing until the one below is fixed. One-at-a-time ranking wastes money.

## Data (all VERIFIED live)
- NABI small barriers NC: `tool.aquaticbarriers.org/api/v1/public/barriers/state?id=NC` (2,804 rows; 920 cut the network).
- NABI dams NC: `.../public/dams/state?id=NC` (28,759 rows; 27,252 with network).
- Topology: `downstreambarriersarpid`. Lengths: `totalupstreammiles`, `freedownstreammiles`, `gainmiles`. Flood proxy: `constriction`, `totdasqkm`, `roadtype`, `annualflow`.
- NHDPlus HR flowlines (USGS REST layer 3) for drawing: `hydroseq`/`dnhydroseq`, `lengthkm`, `nhdplusid`.

## Model
- Forest: candidates are assessed culverts with severity in {Complete, Moderate, Barrier-unknown, Likely, Indeterminate}. Dams and waterfalls are fixed. Each fixed barrier, and the outlet, anchors a tree.
- Habitat = miles reconnected to the anchor network. This is the DCI_d logic of Cote et al. 2009, generalized so that each anchor counts as a mouth. A culvert's upstream miles count only if every candidate between it and the anchor is also fixed.
- Flood = washout-risk reduction. This is a transparent screening index (constriction x hydrologic load x road consequence), additive per culvert, and not a prediction.
- Objective = (1-λ)·habitat_norm + λ·flood_norm under a budget. Exact tree DP with open/closed path states, then a max-plus merge across trees. This gives the optimum at every budget in one pass.
- Baselines: (a) one-at-a-time ranking by GainMiles (how the public tool ranks); (b) greedy by benefit per dollar. Both are evaluated on the same objective.
- Cost model: transparent assumption by road type x stream size, with a lognormal uncertainty band. Monte Carlo reports how often the optimizer beats the baselines.

## Validation
1. Topology integrity: each culvert's `freedownstreammiles` should equal its parent's `totalupstreammiles`.
2. Exactness: the DP matches brute force on hundreds of random subtrees. The JS solver matches the Python solver.
3. Geometry: networks recomputed from NHDPlus HR reproduce NABI upstream miles.
4. Robustness: cost Monte Carlo.

## Timeline
- 15:10-16:00 pipeline + DP + tests
- 16:00-16:40 statewide analysis and headline numbers
- background: NHDPlus HR fetch for HUC8 06010105
- 16:40-19:00 web app (MapLibre, in-browser solver)
- 19:30 venue closes: commit and push
- evening: README (AI usage), DevPost text, demo script, polish
- Sun 9-11: final checks, deploy, submit
