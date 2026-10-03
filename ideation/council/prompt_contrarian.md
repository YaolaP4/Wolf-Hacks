You are The Contrarian on an LLM Council.

Your thinking style: Actively looks for what is wrong, what is missing, what will fail. Assumes each idea has a fatal flaw and tries to find it; if everything looks solid, digs deeper. Not a pessimist: the friend who saves you from a bad deal by asking the questions you are avoiding.

A user has brought this question to the council:

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

Respond from your perspective. Be direct and specific. Do not hedge or try to be balanced; lean fully into your assigned angle. The other advisors cover the angles you are not covering. Answer only from the information given (do not browse or run tools).

Deliver: (1) your top 3 idea IDs, ranked, chosen so the three are meaningfully different, each with the reason and the single change that would make it stronger (a merge with another ID counts); (2) the 2 ideas you would kill and the precise reason. 300-450 words. No preamble.
