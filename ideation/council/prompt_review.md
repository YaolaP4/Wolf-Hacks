You are reviewing the outputs of an LLM Council. Five advisors independently answered this question:

---
## Council question

A student is at WolfHacks (NC State, Raleigh). It is Saturday 3 Oct 2026, about 2 PM. Hacking started at 11:00. DevPost submission is due Sunday 11:00 and judging demos start at 12:30. The venue closes overnight (7:30 PM to 9 AM), so there are about 14 to 18 realistic working hours. The team is small. The strongest builder is a CS+Math student whose research is graph neural networks, wireless channel assignment, and smart-grid communication. They care about claims they can defend: real validation over flashy demos.

TRACK: Center for Geospatial Analytics (NC State). The judges are likely geospatial scientists. The center's own research includes PoPS (pest/pathogen spread forecasting), FUTURES (urban growth), Tangible Landscape, wildfire and land-change modeling.
Problem statement: "Use geospatial data to understand a pressing societal or environmental issue, and develop a software solution that helps determine where to take action."
Judging, equal weight: Track fit; Technology ("did it make you say wow"); Design (usability for the intended user); Execution (does it work).

The student asked for ideas that are genuinely unique and not generic "win the hackathon" pitches. Ideally they also have real-world application and could scale. The ideas below came from more than one source and have been anonymized and shuffled. The ideas teams will predictably build (food deserts, heat islands, flood choropleths, EV chargers, broadband gaps, generic AI-chatbot-over-map) are excluded on purpose.

DATA RULE: each dataset is tagged VERIFIED (public download confirmed on 3 Oct 2026) or UNVERIFIED. Treat UNVERIFIED data as missing. Do not assume it exists.

THE DECISION: choose the 3 ideas to put in front of the student. They will pick one to build. The three should be meaningfully different from each other. For each, say what would make it stronger. That can mean merging two ideas, or sharpening the decision output or the validation.

## Idea pool (16 ideas, anonymized and shuffled)

### I01
**Cutoff Cuts.** Inspect the slope whose failure would isolate a community.
- Decision/user: NCDOT district maintenance engineer. Which roadside slopes to inspect before a forecast storm.
- Method: landslide-evidence screening (distance to mapped movements, DEM slope) shown separately from consequence (graph bridges, articulation points, detour change when a segment fails). Inspections ranked by both, without pretending to be a failure probability.
- Data: Henderson County / NCGS landslide initiation points, outlines, deposits, and debris-flow pathways (VERIFIED), 3DEP (VERIFIED), OSM (VERIFIED).
- Validation: spatially held-out landslide clusters for a terrain baseline; graph isolation checked independently. Closure prediction would need closure observations (UNVERIFIED).
- Demo moment: a dramatic hillside ranks below an unremarkable road cut because the cut is the only route out of a settlement.
- Main risk: the inventory is not proof of present instability.

### I02
**Legacy Dump, New Creek.** Which forgotten pre-regulation landfill needs an erosion walkover?
- Decision/user: NC DEQ Pre-Regulatory Landfill program or county environmental health. Which sites and stream reaches to inspect and possibly sample.
- Method: treat landfill points as search anchors. Stream proximity plus downslope surface-routing across several possible source extents. Rank sites that stay concerning across scenarios and pick an accessible downstream inspection reach.
- Data: NC DEQ Pre-Regulatory Landfill Sites (VERIFIED, 667 sites), 3DEP (VERIFIED), NHDPlus HR (VERIFIED), OSM (VERIFIED).
- Validation: erosion/exposed-waste notes in case documents where available. A statewide outcome dataset is UNVERIFIED.
- Demo moment: two equally close streams get different priorities because one lies upslope.
- Main risk: sites are points, not footprints, and there is little supervised validation.

### I03
**Salt Sentinel.** Which coastal monitoring well should be sampled next for chloride?
- Decision/user: NC DEQ Division of Water Resources groundwater staff. Which existing wells to resample, and where the geographic gaps are.
- Method: aquifer- and depth-aware Gaussian process on log chloride with censored values handled. Batch sampling by expected variance reduction, with a stratified-coverage fallback.
- Data: Water Quality Portal chloride results (VERIFIED, but sparse: one query returned 50 results at 34 NC wells, 2020-2022).
- Validation: leave-whole-well-out error and uncertainty coverage vs. a nearest-neighbor baseline.
- Demo moment: a nearby well at a different depth barely reduces uncertainty, while a farther well in the same aquifer resolves a real gap.
- Main risk: data too sparse and old to say much.

### I04
**The Cleaner Next Door.** Turn legacy dry-cleaning contamination records into a building-level review shortlist, instead of treating the source parcel as the whole problem.
- Decision/user: NC DEQ Dry-Cleaning Solvent Cleanup Act program manager. Which nearby buildings get case-file review, occupant outreach, and possibly soil-gas/indoor-air sampling.
- Method: join buildings to source sites and case-file evidence. Digitize plume footprints where reports provide them; otherwise use a labeled review buffer (no simulated plume).
- Data: NC DEQ Dry-Cleaning Remediation Program layer (VERIFIED, 597 sites), DEQ risk-management report PDFs (VERIFIED, at least one), OSM buildings (VERIFIED, incomplete).
- Validation: retrospective checks against off-source impacts described in reports. Indoor-air validation needs measurements.
- Demo moment: the off-property parcel a report describes, which a "contamination at this address" pin misses.
- Main risk: PDF extraction effort, and proximity does not establish exposure.

### I05
**Invisible Field Workers.** H-2A farmworkers are largely absent from Census residence counts. Where should heat-safety outreach go on dangerous-heat days?
- Decision/user: NC farmworker health programs and labor inspectors.
- Method: geocode H-2A worksites from DOL disclosure data, weighted by certified worker counts and crop season. Combine with NOAA heat-index forecasts.
- Data: DOL OFLC H-2A disclosure data (VERIFIED), NOAA forecasts (VERIFIED).
- Validation: weak. Geocoded heat-illness outcomes are not public.
- Demo moment: a county with low Census population carries a large temporary workforce in peak heat.
- Main risk: worksite addresses are often employer offices, not fields, and there is no outcome validation.

### I06
**Unknown Lines.** Utilities must inventory water service lines, and many are listed as material "unknown". Predict which unknown lines are lead, and choose which to excavate next so each dig removes the most uncertainty.
- Decision/user: a municipal water utility's lead service line program. Excavation order.
- Method: classifier on parcel year-built and neighborhood features, then value-of-information selection of the next digs.
- Data: parcel year-built (VERIFIED for Wake County). NC utility service-line inventories with known materials (UNVERIFIED). Children under 6 from ACS (VERIFIED).
- Validation: held-out known-material lines.
- Demo moment: the next 20 digs are chosen by information value, not by proximity.
- Main risk: without public labeled inventories there is nothing to train or validate on.

### I07
**Stream Sleuth.** Which three samples would most narrow the upstream search for the source of a downstream water-quality anomaly?
- Decision/user: NC DEQ basin investigator or riverkeeper. Which accessible tributary junctions or bridges to sample next.
- Method: upstream subcatchments are the candidate origins. A Bayesian hypothesis model with false-negative/dilution assumptions; greedy expected-information-gain sample selection under a budget on the directed stream tree.
- Data: NHDPlus HR (VERIFIED), Water Quality Portal (VERIFIED), OSM road-stream crossings as access points (VERIFIED).
- Validation: historical upstream/downstream gradients where available; otherwise synthetic injections on the real network (algorithm test only).
- Demo moment: three tributaries remain plausible, and one well-chosen sample eliminates two of them.
- Main risk: sparse sampling dates and dilution destroy identifiability, so real-event validation may not exist.

### I08
**Blackout Islands.** Where does cellular service die first when power, fiber backhaul, and towers fail together?
- Decision/user: county EM and carriers. Where to pre-stage satellite kits and cells-on-wheels; which sites get backup power first.
- Method: tower-to-population coverage graph from FCC tower registrations, FCC mobile coverage polygons, and DEM viewshed. Find towers whose loss uncovers the most people. Cascade model in which backhaul is assumed to follow road corridors, so road/stream washouts cut backhaul.
- Data: FCC DIRS Helene reports (VERIFIED). Daily per-county tables for 21 WNC counties: cell sites served and out, split by cause (damage / transport-backhaul / power / on backup). Example: on 9 Oct 2024, 116 of 184 NC outages were transport, 39 power, 0 damage. FCC ASR tower registrations (VERIFIED), FCC BDC mobile coverage (VERIFIED), DEM (VERIFIED). Actual fiber routes are NOT public.
- Validation: predicted vs. reported outage share per county and per day, including the cause split.
- Demo moment: the "towers fell" assumption is wrong. Helene outages were mostly backhaul. The map shows which valleys go silent when one road corridor fails.
- Main risk: only 21 counties of ground truth, and the backhaul routing is assumed.

### I09
**RailLock.** Where should an ambulance wait when a train cuts a town in two?
- Decision/user: county EMS deployment supervisor. Which stations or approved standby sites to use during a crossing-blockage scenario, in one NC rail town.
- Method: routable road graph with at-grade crossings matched to edges (grade separation preserved). Crossings the same train would block together are removed as a correlated scenario. Multi-source Dijkstra plus a small p-center optimization minimizes worst-case response time.
- Data: FRA crossing inventory (VERIFIED; some revision dates are very old), OSM roads and emergency facilities (VERIFIED). Standby sites are operator inputs.
- Validation: manual audit of crossings against imagery. Dispatch-time improvement would need EMS data (UNVERIFIED).
- Demo moment: block a corridor and a nearby ambulance becomes effectively far away. Moving one standby unit restores access.
- Main risk: crossing matching errors and a stale inventory. No live train prediction.

### I10
**Ghost Addresses.** Buildings that 911 cannot find: footprints with no NG911 address point nearby.
- Decision/user: county 911 addressing coordinators. Which buildings to address first.
- Method: spatial join of building footprints to address points. Classify likely-occupied buildings (size, shape, road access). Prioritize by hazard exposure and distance from the road.
- Data: AddressNC statewide address points (VERIFIED, NC OneMap), Overture/Microsoft footprints (VERIFIED). AddressNC "New Locations" (VERIFIED) works as a back-test, because addresses added later were once missing.
- Validation: did previously unaddressed buildings flagged by the tool later appear in New Locations?
- Demo moment: a cluster of homes a dispatcher could not route to.
- Main risk: moderate wow; mostly a data-quality tool.

### I11
**Checkerboard Buyouts.** Scattered flood buyouts leave holes in neighborhoods and raise per-household infrastructure costs. Choose contiguous buyout clusters.
- Decision/user: state and county hazard-mitigation officers.
- Method: spatial optimization for contiguity under a budget.
- Data: OpenFEMA HMA mitigated properties and NFIP claims (VERIFIED, but locations are coarse or redacted).
- Validation: weak at parcel level.
- Demo moment: two buyout plans, one checkerboarded and one contiguous.
- Main risk: coarse public data makes parcel-level optimization speculative.

### I12
**Ten-Minute Shelter Gap.** A tornado warning gives about 10 minutes, and mobile-home residents die disproportionately in tornadoes. Which mobile home parks have no sturdy building reachable on foot inside the warning lead time?
- Decision/user: county EM applying for FEMA P-361 community safe-room grants. Where to build the next safe room.
- Method: mobile home park polygons, plus a building-footprint shape detector for parks missing from the list (dense clusters of roughly 4-5 m x 18-25 m rectangles). OSMnx walking isochrones, at night and with children, to hardened public buildings. Weight by historical tornado track density. Max-coverage facility location for k new safe rooms.
- Data: HIFLD Mobile Home Parks (VERIFIED via archive after the Aug 2025 HIFLD Open shutdown), SPC tornado tracks GIS (VERIFIED), Microsoft/Overture footprints (VERIFIED), OSM (VERIFIED).
- Validation: detector recall vs. the HIFLD list. Historical tornado-fatality location by housing type from NWS storm data (VERIFIED, coarse).
- Demo moment: the footprint detector finds parks the federal list misses. A park's 10-minute walk polygon contains no shelter.
- Main risk: safe-room siting needs land and permission, and the walking-speed assumptions are judgment calls.

### I13
**Next Slope.** Helene triggered more than 2,200 mapped landslides. Which occupied homes and roads sit in the runout path of the next one?
- Decision/user: county planners and NC Geological Survey. Where to place slope monitors and send buyout/notification outreach.
- Method: susceptibility model trained on Helene initiation points (slope, curvature, flow accumulation, soils), with spatially blocked cross-validation. Downslope runout tracing to buildings and roads.
- Data: USGS Helene landslide inventory (VERIFIED, doi:10.5066/P14CHGKS), Henderson County / NCGS landslide initiation points, deposits, and debris-flow pathways (VERIFIED), 3DEP DEM (VERIFIED), footprints (VERIFIED).
- Validation: spatially held-out landslide clusters. Compare predicted runout against mapped debris-flow pathways.
- Demo moment: a home far from any steep slope sits in a runout path.
- Main risk: susceptibility modeling is well-trodden science, so novelty rests on the runout-to-occupancy step.

### I14
**RidgeRelay.** Where should temporary emergency radio relays go to connect field teams across mountain terrain, and on which channels?
- Decision/user: county EM communications unit. Which accessible sites to stage portable relays at during an outage.
- Method: terrain line-of-sight plus Fresnel clearance for a declared band and antenna height. Feasible-link graph; node-weighted Steiner tree integer program to connect required terminals via relays. DSATUR coloring on an explicit interference graph for channel assignment.
- Data: 3DEP terrain (VERIFIED), OSM (VERIFIED). Team positions and radio parameters are scenario inputs.
- Validation: measured RSSI/packet delivery if legal equipment exists. A campus test validates the pipeline, not mountain propagation.
- Demo moment: a relay dragged to an impressive ridge still leaves one valley disconnected. The solver picks a less obvious saddle.
- Main risk: no real RF validation within 20 hours, and terrain alone misses foliage and interference.

### I15
**Culvert Combinations.** Fund the pair, not the individually highest-ranked projects. Find bundles of aquatic-barrier removals that reconnect habitat only when done together.
- Decision/user: NC Wildlife Resources Commission or a watershed nonprofit. Which culverts/dams to advance to engineering under a budget.
- Method: snap barriers to a directed stream graph. Mixed-integer or bundle search maximizes reachable habitat from a downstream anchor under a cost cap, with serial barriers explicit.
- Data: National Aquatic Barrier Inventory (VERIFIED), NHDPlus HR (VERIFIED). Costs are scenario inputs.
- Validation: compare with inventory network metrics. Ecological outcome data is UNVERIFIED.
- Demo moment: two mediocre projects jointly unlock a tributary that top-two ranking misses.
- Main risk: SARP already runs a sophisticated prioritization tool, so this must beat it on bundle complementarity.

### I16
**Lifeline Crossings.** Which road-stream crossings, if they wash out, cut people off from a hospital? (Helene isolated WNC communities through a few failed culverts and bridges.)
- Decision/user: NCDOT division engineers and county EM. Which crossings to harden first; where to pre-stage supplies on the side that would become an island.
- Method: snap a crossing inventory to an OSMnx road graph. Get upstream drainage area per crossing from DEM flow accumulation (washout proxy). Isolation analysis: remove a crossing and count Census-block population that loses every route to a hospital. Greedy hardening plan for the k crossings that keep the most people connected.
- Data: National Aquatic Barrier Inventory road-stream crossings (VERIFIED), USGS 3DEP DEM (VERIFIED), NHDPlus HR (VERIFIED), OSM (VERIFIED), Census blocks (VERIFIED). Helene closure locations: NCDOT dashboard / NC Helene Data hub exists (VERIFIED), but a downloadable historical closure layer was NOT confirmed (UNVERIFIED).
- Validation: back-test top-ranked crossings against real Helene closures, if the closure layer can be obtained.
- Demo moment: replay Helene. Communities go dark as crossings fail, then the "harden these 10" plan keeps them connected.
- Main risk: closure ground truth may not be downloadable, and drainage area is only a proxy for washout.

---

Here are their anonymized responses:

**Response A:**
1. I09 — RailLock

A judge arriving cold understands this immediately: “The ambulance is nearby, but the train is in the way.” The map can show the problem, the intervention, and the result without a lecture about models. It also gives the intended user an actual decision: move this unit to this standby site during this blockage scenario. That is a software product, not merely a map of vulnerability.

Single change: make the entire demo one manually audited blockage scenario in one town, with operator-supplied standby candidates. Show before-and-after modeled road travel times—not claimed emergency response times. Correctly representing the crossings matters more than adding towns or pretending to predict trains.

2. I15 — Culvert Combinations

“Fixing either one alone achieves little; fixing both reconnects the stream” is the strongest explanatory hook in the pool. A nonexpert can understand why ordinary rankings fail, and a scientist can inspect whether the network actually supports the claim. The decision is concrete: which projects should advance together under a budget? It is meaningfully different from ambulance deployment: this is environmental investment planning with interacting projects.

Single change: build the demo around one explicit comparison between the best individually ranked affordable projects and the best affordable bundle, using identical costs and habitat assumptions. Show the blocked and newly reachable stream segments. Do not claim to beat SARP unless that comparison is actually made; demonstrate the value of the bundle decision itself.

3. I04 — The Cleaner Next Door

This has a clear surprise: the address on the contamination record is not necessarily the boundary of the problem. More importantly, a report can supply evidence a judge can read. That creates a different kind of credibility from a plausible-looking simulation. The intended action—review these neighboring buildings’ case evidence—is understandable and appropriately limited.

Single change: constrain the project to one report-backed case and make every shortlisted building clickable to the exact supporting report passage or figure. Do not scale the shortlist with proximity buffers for the demo. One traceable off-property finding is more convincing than hundreds of buildings colored as vaguely concerning.

Kill I08 — Blackout Islands

Its central visual claim depends on fiber routes that are unavailable. County outage totals and cause categories cannot establish which assumed road corridor disconnects which valley. A cold judge will read the detailed map as infrastructure knowledge the team does not possess. The impressive part is precisely the unsupported part.

Kill I12 — Ten-Minute Shelter Gap

The supplied data do not establish which buildings are hardened, accessible shelters. A footprint and a walking route cannot establish tornado protection. The demo’s natural interpretation—“you can reach safety here”—therefore exceeds its evidence. Finding mobile-home parks does not repair the missing destination data.

**Response B:**
**1. I08 Blackout Islands.** This has the biggest upside in the pool, and it sits squarely in the student's own research (wireless, smart-grid communication, graphs). The FCC DIRS cause split is rare ground truth: per county, per day, by cause. It already carries a headline finding most people don't know: 116 of 184 outages were backhaul and zero were damage. Every future DIRS activation adds another validation set, so the model gets more defensible over time. Judges get interdependent-infrastructure modeling instead of another hazard map.
*Stronger:* merge with I14. On its own, I08 stops at "these valleys go silent." Add RidgeRelay's line-of-sight Steiner placement and DSATUR channel assignment as the fix: where to stage cells-on-wheels or portable relays to reconnect the islands I08 finds. That gives a find-then-fix loop, and the channel-assignment half is the student's actual research.

**2. I12 Ten-Minute Shelter Gap.** The real value is the footprint detector, not the safe-room siting. HIFLD Open shut down in Aug 2025, and the mobile-home-park layer now only survives in an archive. A detector that rebuilds that layer from open footprints, with recall measured against the archived list, replaces a dead federal dataset. It also works in any state, which takes it well past NC.
*Stronger:* merge with I10. Run every detected park through the AddressNC join. A park that is missing from the federal list, has no shelter within 10 minutes, and has no address points is invisible three times over. That one map gives EM, 911 addressing coordinators, and FEMA grant writers each a reason to care.

**3. I15 Culvert Combinations, merged with I16.** One crossings layer (NABI) serves two groups of users. Undersized culverts block fish, and they also wash out in floods. Run the bundle optimizer on a two-objective frontier: habitat reconnected, and population kept connected to hospitals. That beats SARP on something SARP doesn't model at all. It also widens the user from a watershed nonprofit to NCDOT and WRC funding projects together. Choosing complementary bundles on a directed stream graph is a hard optimization problem, because projects are worth more together than apart. That gives a graph researcher real algorithmic work to show.
*Stronger:* make the demo the single crossing that ranks mediocre on the fish list and on the people list alone but tops the joint frontier.

**Kill:**
- **I06 Unknown Lines.** All of its value comes from choosing digs that remove the most uncertainty, which needs labeled service-line inventories, and those are UNVERIFIED. Without labels there is no classifier and nothing to rank digs by. The upside isn't small; it's zero.
- **I03 Salt Sentinel.** It rests on 50 results at 34 wells from 2020–2022. Even done perfectly, the best output is "resample these three wells," and nothing grows from there. Its best case is a footnote.

**Response C:**
**Top 3**

**1. I16, merged with I01 (Henderson County only).** This is the most buildable idea with a strong wow. Hour one: an OSMnx drive graph for Henderson, NABI crossings snapped to edges, hospitals from OSM, Census block centroids. Removing each candidate edge and running a BFS from the hospitals is seconds of compute. You have a working isolation ranking by dinner, and everything after that is polish. The "Helene replay" demo is a slider that fails crossings in order of drainage area. **Change:** merge in I01's slope cuts as a second failure type in the same engine, and confine the study area to Henderson, where the NCGS landslide inventory is VERIFIED. That swaps I16's UNVERIFIED closure back-test for a validation you can actually run: spatially held-out landslide clusters for the hazard screen, plus a brute-force check of every isolation count against nx.bridges.

**2. I12 Ten-Minute Shelter Gap.** Every input is VERIFIED, every step is a library call (OSMnx walk isochrones, greedy max-coverage), and the 11 AM demo can't fail: click a park, its 10-minute polygon contains no shelter, place a safe room, the coverage count jumps. **Change:** make the park detector purely geometric (minimum rotated rectangle 4–5 × 18–25 m, then DBSCAN clustering), no ML, and lead with one number: recall against HIFLD in one county. That number is your Execution score. Build it before the isochrones.

**3. I10 Ghost Addresses.** Lowest risk on the list, and the only idea with an outcome back-test built from VERIFIED data. The spatial join runs in minutes, which leaves 12+ hours for ranking and UI. **Change:** in hour one, confirm that AddressNC New Locations carries add dates and that the footprints predate them. If both hold, headline precision@k of "flagged, then later addressed" against a size-only baseline. If not, drop it, because it's a data-cleaning script with nothing to validate.

These three fail in different ways: road network fragility, walking access to fixed shelters, and gaps in administrative records.

**Kill**

**I06 Unknown Lines.** The labeled service-line inventories are UNVERIFIED, so the classifier has no labels, no training set and no held-out test. It can't be built today. Stop considering it.

**I14 RidgeRelay.** This is the trap because it's the builder's home field (channel assignment, Steiner trees). The idea itself admits there's no real RF validation in 20 hours, so the demo comes down to "trust my Fresnel math" in front of geospatial judges. You'd spend the night tuning an integer program whose output nobody can check. If you want a wireless angle with real ground truth, that's I08, not this.

**Response D:**
1. I09 — RailLock

Best chance of finishing something whose central claim survives questioning. It answers a bounded operational question: given these blocked crossings, where should an ambulance wait? It does not need unavailable dispatch records to demonstrate that the routing and placement optimization work. The train blockage is an explicit scenario, not a fabricated forecast. The visual surprise follows directly from network topology.

Single change: make one manually audited town the entire product. Verify each affected crossing’s grade separation and graph connectivity before optimizing anything. An incorrectly severed overpass can manufacture the whole “wow” moment. Present improvements as modeled travel-time changes, never observed response-time savings. A trustworthy small demonstration beats a statewide map of routing errors.

2. I15 — Culvert Combinations

This has a defensible decision output, available inputs, and a mathematical mechanism worth demonstrating: serial barriers make project benefits interdependent. It fits the builder without requiring a hastily trained model or pretending that synthetic tests establish environmental outcomes.

The fatal competitive risk is claiming to invent prioritization in front of scientists who know the existing tools.

Single change: replace the “better prioritization tool” pitch with a transparent bundle-complementarity benchmark. On one small watershed, compare bundle selection with individual-project ranking under identical declared costs, and verify the optimum by exhaustive enumeration on a small candidate set. That proves the algorithmic claim. It does not prove superiority to SARP or actual ecological recovery; say neither.

3. I02 — Legacy Dump, New Creek

The least glamorous choice, but it targets a concrete environmental workflow without demanding missing labels. “Inspect this downstream reach” is a supportable recommendation; “this landfill is contaminating this creek” is not. Its uncertainty is visible and structurally different from the other two projects.

Single change: make sensitivity to the unknown landfill footprint the primary output. Show whether a site remains a priority across plausible source extents, and explicitly withhold a confident ranking when it does not. Otherwise, precise-looking drainage paths from imprecise source points are just cartographic theater. This is surface-erosion screening, not a contaminant-transport model.

Kill I06 — Unknown Lines

The known-material inventory is UNVERIFIED, therefore missing. That removes both the training target and the proposed validation set. Parcel age and Census demographics cannot repair that absence. This is not a risky implementation; it is an unavailable project.

Kill I08 — Blackout Islands

Its claimed intervention depends on infrastructure topology it does not have. Registered towers, coverage polygons, and assumed road-following fiber cannot establish actual service dependencies. County-level outage totals and cause splits cannot validate which valley depends on which corridor. Matching those totals could reward an entirely wrong network. The compelling Helene statistic does not rescue the invented backhaul map.

**Response E:**
**The question is wrong.** Asking which idea is "unique" doesn't help with these judges. Geospatial scientists have seen every topic. What they rarely see is a hackathon team checking a prediction against outcome data it didn't train on. So the real filter is this: is there a VERIFIED outcome for the tool's core claim, and can it be scored by Sunday? Only four ideas pass: I08, I13, I01 and I10. For everything else, whether the tool is right is a matter of opinion at demo time.

**1. I08 Blackout Islands.** It is the only idea with an outcome series that is broken down by county and day and labeled by cause. The headline is a finding, not a feature: the towers didn't fall, the backhaul did. It also uses the student's wireless and graph strength without turning into a radio toy.
*Change:* merge in I16's crossing-washout proxy (upstream drainage area at road-stream crossings) as the thing that cuts road-corridor backhaul. Then score three competing hypotheses against the DIRS cause split: towers fail, power fails, or a corridor is cut. Compare all three to a null model based on towers per county. Score at county level only, and don't claim valley-level accuracy you can't check.

**2. I13 merged with I01 (Next Slope with Cutoff Cuts).** Susceptibility mapping is solved science, and nobody needs another map. What's left is consequence.
*Change:* keep I13's spatially blocked susceptibility model and runout tracing, scored against the VERIFIED mapped debris-flow pathways. Rank on two separate axes. One is the evidence of hazard. The other is I01's consequence: occupied homes in the runout, plus road segments in the runout whose loss cuts a community off (articulation points). Never multiply the two into a fake probability. Say plainly that training on one storm's landslides limits how well it transfers.

**3. I10 Ghost Addresses.** It has the least wow, but the cleanest natural experiment in the pool and the lowest execution risk. A dispatcher understands "911 can't find this house" in five seconds.
*Change:* fix the flaw in the back-test. An address added later may belong to a house built later, not one 911 missed. Restrict the test to Wake County. Keep only New Locations on parcels whose year-built is at least two years before the address was added. Report precision@k for the ranked ghost list on that subset. That turns a data-cleaning tool into a measured result.

**Kill I06 Unknown Lines.** The utility inventories with known pipe materials are UNVERIFIED, so under the data rule there are no labels. With no labels there is nothing to train the classifier on, and the value-of-information step has no likelihood to compute. It's a method looking for data.

**Kill I14 RidgeRelay.** It's the student's comfort zone, and that is exactly why to kill it. Every input that matters is a scenario assumption: team positions, radio parameters, foliage. The idea itself admits RF validation can't happen by Sunday. Steiner trees and DSATUR would impress a wireless reviewer. Judges who build PoPS and FUTURES will see a radio-planning exercise with no geospatial finding about a societal problem.

Answer these three questions. Be specific. Reference responses by letter and ideas by ID.

1. Which response is the strongest? Why?
2. Which response has the biggest blind spot? What is it missing?
3. What did ALL five responses miss that the council should consider?

Answer only from the information given (do not browse or run tools). Keep your review under 250 words. Be direct.