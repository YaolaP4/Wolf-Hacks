# Three proposals (pick one)

Written 3 Oct 2026, 14:20. The full reasoning is in `council/verdict.md`. The method is described in `../README.md`.

All three are graph problems on real NC geography. Each makes one claim, and each comes with a test you can score by Sunday.

---

## 1. Cutoff Slopes (recommended)
**The slope that matters most is not always the steepest. It is the one above the only road out.**

- **Problem:** Helene triggered more than 2,200 landslides across Appalachia and cut mountain communities off from hospitals for days. NCDOT can't inspect every roadside slope before the next storm.
- **User / decision:** An NCDOT district maintenance engineer choosing which slopes to inspect and which drains to clear before a forecast storm.
- **What they see:** A hazard-vs-consequence scatter with the Pareto front highlighted, linked to a MapLibre map.
  - Click a road segment to see the slope above it and the landslides mapped near it.
  - Press **fail** to grey out the area that gets cut off and show how many people are stranded and how many detour minutes are added.
  - Export the top 20 for field crews.
  - Hazard and consequence stay on separate axes, never multiplied into a fake probability.
- **Tech:**
  - Hazard: terrain features from the 10 m USGS 3DEP DEM (slope, curvature, flow accumulation) and a susceptibility classifier.
  - Runout: D8 tracing downslope to the first road hit.
  - Consequence: an OSMnx road graph. `nx.bridges` and articulation points find single points of failure, Census-block population is counted per cut, and a brute-force edge-removal check confirms every count.
- **Validation (verified feasible today):**
  - Train on the NC Geological Survey's pre-Helene inventory for Henderson County: 90 initiation zones collected mostly in 2010, plus 1,384 debris-flow pathways and 419 deposits.
  - Test on the USGS Helene inventory: **253 landslides inside Henderson County**, mapped from satellite and aerial imagery, **75 tagged as hitting a road**.
  - Report the share of Helene landslides captured in the top 10% of screened area, against a slope-only baseline.
  - Also test the consequence side: did the slopes flagged above high-consequence road segments match where Helene actually hit roads?
- **Known trap:** 61 of the 90 NCGS training points are road embankments or road cuts, because geologists mapped from roads. Report capture for cells more than 100 m from roads separately. The satellite-mapped Helene test set doesn't share this bias, so say that too.
- **Track fit:** Landslide hazard is the Center for Geospatial Analytics' home turf. The consequence axis is where your graph skills add something new.
- **Scales to:** Any mountainous county with an inventory. The USGS Helene inventory alone covers 5 states.
- **Go/no-go 5:30 PM:** Henderson DEM derivatives are computed and the first hazard-model result exists. If behind, shrink to the two watersheds with the most landslides.

## 2. Culvert Combinations
**Fund the pair, not the two best singles. Some culverts only matter if the one downstream goes too.**

- **Problem:** Thousands of culverts and dams fragment NC streams. Agencies rank removals one at a time, but habitat behind two barriers opens only when both are fixed, so the one-at-a-time ranking misses the best combinations.
- **User / decision:** NC Wildlife Resources Commission connectivity staff or a watershed nonprofit deciding which barriers to advance to engineering under a budget.
- **What they see:**
  - A budget slider.
  - A split map: the top-N one-at-a-time plan next to the optimal bundle, with newly reachable stream miles lit up.
  - Click a barrier to see which downstream barriers it depends on.
  - Costs are labeled "assumed," and the result is shown to hold across cost ranges.
- **Tech:** A directed stream tree from NHDPlus HR, cut into the stretches between barriers. An exact tree-knapsack dynamic program with a precedence rule (a barrier only counts once every barrier below it is removed), verified by brute force on small instances.
- **Validation:**
  - First reproduce the National Aquatic Barrier Inventory's published per-barrier network gains for the watershed (rank correlation and the share within 10%).
  - Then show a real case where a bundle beats top-N ranking at a plausible budget.
- **Known trap:** Counting crossings that were never assessed as barriers. Use only assessed barriers.
- **Scales to:** All 50 states. The inventory is national.
- **Go/no-go 5 PM:** The gains match the inventory, and at least one real bundle-beats-top-N case exists.

## 3. Stream Sleuth
**A downstream sample spikes. Which three bridges do you sample next to find the source fastest?**

- **Problem:** When a water-quality monitor flags an anomaly, investigators work upstream by hunch. Each sampling trip costs a day.
- **User / decision:** An NC DEQ regional water-quality investigator or a riverkeeper choosing the next sampling locations.
- **What they see:**
  - Click the station that flagged the anomaly, and the upstream catchments shade by probability of being the source.
  - The tool suggests 3 accessible road-stream crossings, each with its expected information gain.
  - Enter each result as hit or miss, and the map updates.
  - The dilution and false-negative assumptions sit on screen as sliders.
- **Tech:** Bayesian source localization on the directed NHDPlus catchment tree. Detection depends on whether the source is upstream, on dilution estimated from the drainage-area ratio, and on false-positive and false-negative rates. Samples are chosen greedily in batches by expected information gain. This is the PoPS idea of choosing where to survey next, applied to rivers.
- **Validation:**
  - Inject synthetic pollution sources on the real network and measure the median number of samples needed to find each one.
  - Compare against random sampling and against splitting the watershed in half by drainage area, which is what an experienced investigator does.
  - Include a run where the dilution assumption is wrong.
  - This validates the algorithm, not real-world attribution, and the slide says so.
- **Known trap:** A hydrologist asks what the detection model assumes. Pick one pollutant class and show the method is robust when the assumptions are wrong.
- **Go/no-go 5 PM:** Information-gain sampling beats the halving strategy at realistic noise. A tie kills the technology claim.

---

### What was cut, and why
- **Blackout Islands** (Helene cell outages: FCC data shows most were backhaul failures, not fallen towers). It was the closest fit to your wireless background. The council ruled it out because the only ground truth is county-level, while the decision it supports ("which valley goes silent") is finer than that. A good research finding, but not a where-to-act tool.
- **Unknown Lines** (lead pipes): no public labeled inventories. **Ten-Minute Shelter Gap:** no data identifies hardened tornado shelters. **RidgeRelay:** no way to validate radio coverage by Sunday.

### Bias note
Source-blinding didn't remove self-preference. Both GPT advisors picked only ideas from the GPT pool (6 of 6). The Claude advisors picked mostly Claude-pool ideas (8 of 9). Every peer reviewer rated the advisor from its own model family strongest (5 of 5). That is small-sample evidence, not a measured effect. So the chairman counted only points both families agreed on, rather than votes. The final slate is mixed: #1 merges a GPT idea with a Claude idea, and #2 and #3 came from the GPT pool. #3 was overlooked by all five advisors and surfaced only in peer review, from both families.
