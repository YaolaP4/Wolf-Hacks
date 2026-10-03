# Chairman verdict (fresh Claude sub-agent, blind to idea sources)

## Where the Council Agrees
These points have support from both model families, so they carry high confidence:
- **Kill I06.** The labeled inventories are UNVERIFIED, so there is nothing to train on and nothing to test against.
- **Stacking merges is the trap.** All five reviewers, from both families, named B's triple merges as the worst blind spot. A merge has to justify the scope it adds.
- **I15 is credible.** D, A and B back it, which covers both families. The condition: it compares bundles against individual ranking and never claims to beat SARP.
- **I07 was wrongly ignored.** R2 (Claude) and R4 and R5 (GPT) all flagged it. Of all the ideas, it is the closest to PoPS-style survey targeting.
- **I12's decision output fails.** No dataset identifies hardened shelters, and the fact-check confirmed this.
- **Claims stop where the data stops.** Say modeled travel times, not response times. Say "inspect," not "contaminated."

## Where the Council Clashes
- **I08.** Claude advisors B and E made it their top pick; GPT advisors A and D killed it. **Ruling: out.**
  - The finest resolution is the county, and no backhaul routes are public.
  - The product's decision (which valley, which corridor) sits below county level. A model that fits 21 county totals can still have the network wrong.
  - R3, a Claude reviewer, added that tower, power and corridor failures all rise with storm severity. That confounds even E's county-level test.
  - EAGLE-I tests the power pathway, not the map. What survives is a research finding, not a tool for deciding where to act.
- **What counts as validation.** E says that without a verified outcome, the tool's correctness is just opinion. D and R4 say an optimizer's correctness can be checked objectively. **Ruling: both are right, for different claims.** A prediction about the world needs outcome data. An optimization claim needs exhaustive verification. Each pick below says which kind of claim it makes.
- **Picks backed by only one family are hypotheses.**
  - GPT only: I09, I02, I04. Claude only: I10, I12 and the landslide merges.
  - I09 duplicates the road-isolation engine in pick #1.
  - I10 is the safest backup, but R4's objection holds: an address added later does not prove 911 couldn't find the house.
  - My #1 came from Claude advisors. It earns its place through a verified outcome test, not votes.

## Blind Spots the Council Caught
- **I10's back-test is confounded by new construction (E).** The fact-check confirms the date fields exist, so filtering on parcel year-built fixes it.
- **No one said what the user sees and clicks (R1–R3).** Design is a quarter of the score.
- **No time was budgeted for data prep, and no go/no-go was set before 7:30 PM (R1–R3).** C also put demos at 11:00. That is the submission deadline; demos start at 12:30.
- **Storm severity confounds I08 (R3).**
- **Missed by everyone:**
  - Henderson's NCGS inventory plus the USGS Helene inventory allow a **pre-Helene to Helene temporal holdout**. That is the strongest test available for any idea in the pool.
  - Many NABI road crossings have never been assessed for fish passage. Counting them as barriers would sink I15.

## The Recommendation

### 1. Cutoff Slopes (I01 + I13, Henderson County only). Build this.
- **Pitch:** Rank roadside slopes on two axes: terrain evidence that a landslide starts there, and how many people lose their only route to a hospital if it does.
- **Decision/user:** An NCDOT district maintenance engineer choosing which slopes to inspect before a storm.
- **Design:** A hazard-vs-consequence scatter with the Pareto front highlighted, linked to a map.
  - Clicking a road segment shows the slope above it and the mapped landslides nearby.
  - Pressing "fail" greys out the cut-off area and shows its population and the extra detour minutes.
  - The top 20 export as a CSV. The two scores are never multiplied into one.
- **Technology:**
  - Slope, curvature and flow accumulation from the 10 m 3DEP DEM.
  - A classifier checked with spatially blocked cross-validation.
  - A D8 downslope trace from high-hazard cells to the first road it hits.
  - An OSMnx road graph using nx.bridges, checked by removing each edge by brute force, to count the Census-block population cut off and the detour change.
- **Merge justification:** Both ideas use the same inventory and DEM. I13 adds only the held-out training step that I01 lacked. Drop I13's buyout outreach and I16's washout proxy.
- **Validation:** Train on pre-Helene NCGS initiation points and score on USGS Helene initiation points inside Henderson. Report the share of Helene initiations that fall in the top 10% of screened area, against a slope-only baseline.
- **Go/no-go (5:30 PM):** At least 30 Helene points fall in Henderson, the NCGS points predate Sept 2024, and the county DEM layers are computed.
  - If the dates fail, use spatially blocked CV instead.
  - If the DEM work is behind, shrink the study area to the two watersheds with the most landslides.
- **Embarrassment:** A judge asks, "Isn't your model learning where people mapped landslides, which is beside roads?" That mapping bias inflates the hazard score exactly where the consequence axis lives. Also report the capture rate for cells more than 100 m from roads, and never call the score a probability.

### 2. Culvert Combinations (I15, one HUC8 watershed, no merge)
- **Pitch:** Fund the pair: barrier removals that reconnect habitat only when done together.
- **Decision/user:** NC Wildlife Resources Commission connectivity staff or a watershed nonprofit, deciding which barriers move to engineering under a budget.
- **Design:**
  - A budget slider and a cost table labeled "assumed."
  - A split map: the top-N individual plan beside the best bundle, with the newly reachable stream miles colored.
  - Clicking a barrier shows which downstream barriers must go first.
- **Technology:**
  - A directed stream tree from NHDPlus HR, with the stream network divided into the stretches between barriers.
  - An exact tree-knapsack dynamic program, with the constraint that a barrier counts only once every barrier below it is also removed.
  - A brute-force check on small instances.
- **No I16 merge:** I16's closure validation is UNVERIFIED, and it would double the scope.
- **Validation:** Reproduce NABI's published single-barrier network gains for the watershed, and report rank correlation and the share within 10%. If you can't reproduce SARP's numbers, the bundle result means nothing.
- **Go/no-go (5 PM):** The gains match NABI, and there is at least one real case where a bundle beats the top-N plan at a plausible budget. With no such case there is no demo moment, so switch watersheds or drop the idea.
- **Embarrassment:** Counting unassessed crossings as barriers, or presenting invented costs as real. Use only assessed barriers, and show the bundle still wins across a range of costs.

### 3. Stream Sleuth (I07, one HUC10 watershed)
- **Pitch:** When a downstream sample spikes, pick the three bridges to sample next that find the source fastest.
- **Decision/user:** An NC DEQ regional water-quality investigator or a riverkeeper.
- **Design:**
  - Click the station showing the anomaly, and the upstream catchments shade by probability of being the source.
  - The tool suggests three road-stream crossings, each with its expected information gain.
  - Enter hit or miss for each sample and the map updates.
  - The dilution and false-negative assumptions sit on screen as sliders.
- **Technology:** Each upstream NHDPlus catchment is a candidate source. The chance of detecting it at a sample point depends on whether the source is upstream of that point, on dilution (estimated from the ratio of drainage areas), and on false-negative and false-positive rates. Samples are chosen greedily, in batches of three, by expected information gain on the directed tree. Pitch it as PoPS-style survey targeting applied to water.
- **Validation:** Inject synthetic pollution sources on the real network and measure the median number of samples needed to find each one. Compare against sampling random crossings and against splitting the watershed in half by drainage area, which is what an experienced investigator does. Include a run where the dilution assumption is wrong. This validates the algorithm, not real-world source finding, and the slide says so.
- **Go/no-go (5 PM):** The information-gain method beats the halving strategy at realistic noise. A tie kills the technology claim.
- **Embarrassment:** A hydrologist asks what pollutant, flow and decay the detection model assumes. Name one pollutant class, and show the ranking holds up when the assumptions are wrong.

**Rank: 1 > 2 > 3. Build #1.** It is the only pick with an out-of-sample outcome test on VERIFIED data. Hazard modeling is the Center for Geospatial Analytics' own field, and the student's graph skills carry the consequence axis.

## The One Thing to Do First
Clip the USGS Helene inventory and the NCGS layer to Henderson County, count the Helene initiation points, and check the NCGS event dates. That 20-minute check decides whether #1 has its headline validation. If it fails, fall back to spatially blocked CV or move to #2.
