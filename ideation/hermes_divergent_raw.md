PART 1 — THE MODE

My prediction, not an observed survey of the other teams:

1. Food-desert map ranking neighborhoods for grocery stores.
2. Urban heat-island map recommending trees or cooling centers.
3. Flood-risk map with property-level warning colors.
4. Air-pollution map overlaid with demographic vulnerability.
5. Wildfire-risk map with alerts and evacuation routes.
6. Hurricane shelter locator and evacuation planner.
7. Public-transit access map recommending new stops.
8. Traffic-crash hotspot map recommending safer intersections.
9. EV-charger gap map recommending charging stations.
10. Broadband-desert map prioritizing internet expansion.
11. Hospital/pharmacy access map highlighting underserved tracts.
12. Park and green-space equity map recommending new parks.
13. Illegal-dumping reporting map with cleanup priorities.
14. Sea-level-rise/coastal-erosion exposure viewer.
15. Invasive-species sightings map with spread-risk colors.


PART 2 — EIGHT IDEAS OUTSIDE THE MODE

My first choice is RailLock: a concrete operational decision, graph algorithms that suit this team, and a demo understandable without a lecture. RidgeRelay best exploits the wireless background. Stream Sleuth has the most interesting inference problem, but weaker quick validation.

Data reality check: I retrieved actual records from the NC landfill, dry-cleaner, landslide, USGS stream-network, FRA crossing, and Water Quality Portal services, plus a terrain TIFF. For OSM and aquatic barriers, I confirmed download pages, not a complete regional download. Sources below provide URLs; each data section names the publisher. Available does not mean current or complete.

The affected groups are intended beneficiaries—not a claim that their individual locations are public. None of these projects needs private utility topology or an LLM. I would not train a GNN before establishing a working baseline and credible labels.


1. RailLock — Where should an ambulance wait when a train cuts town in two?

Pitch: Identify neighborhoods whose emergency access depends on a handful of at-grade crossings, then choose temporary standby locations on the right side of the tracks.

Decision/user: A county EMS deployment supervisor chooses which existing stations or approved standby sites to use during a specified crossing-blockage scenario. Start with one NC rail town, not statewide dispatch.

Affected: Residents behind a crossing, mobile-home communities on dead-end roads, school-bus passengers, shift workers, and visitors whose daytime locations differ from Census residence counts.

Data:
  • Federal Railroad Administration: current Form 71 crossing inventory, including crossing IDs and coordinates.[11]
  • OpenStreetMap contributors, distributed by Geofabrik: roads and mapped emergency facilities.[1]
  • Approved standby sites are operator inputs, not inferred permissions.

Method: Construct a routable road graph; match crossings to edges while preserving grade separation. Remove crossings plausibly occupied by the same train as a correlated scenario. Use multi-source Dijkstra and a small p-center optimization to minimize worst-case travel time to destination nodes. Travel speeds and blockage duration are explicit assumptions.

Validation: Manually audit crossings against imagery and road topology. Safely observing a real train passage can validate which crossings close together; public-road GPS travel can check detours. Actual dispatch-time improvement requires EMS data—UNVERIFIED, not an MVP dependency.

Three-minute wow: Block a corridor. A nearby ambulance becomes effectively far away; moving one standby unit restores access. Show the changed route, not just a red polygon.

Biggest risk/fallback: Incorrect crossing matching or stale inventory; I encountered very old revision dates even in the “current” inventory. Hand-audit a small town and use a labeled blockage scenario. Do not claim live train prediction.


2. Culvert Combinations — Fund the pair, not the individually highest-ranked projects.

Pitch: Find bundles of aquatic-barrier removals that reconnect habitat only when undertaken together.

Decision/user: NC Wildlife Resources Commission habitat staff or a watershed restoration nonprofit chooses which culverts/dams to advance to engineering assessment within a budget.

Affected: Stream ecosystems, anglers, downstream communities, and small landowners whose crossing determines connectivity far beyond their parcel—none represented adequately by residential tract averages.

Data:
  • National Aquatic Connectivity Collaborative/Southeast Aquatic Resources Partnership: National Aquatic Barrier Inventory and downloadable prioritization data.[4]
  • USGS: NHDPlus HR flowlines and catchments.[3]
  • Engineering costs and landowner consent are not supplied by these datasets; use explicit scenario costs.

Method: Snap assessed barriers to a directed stream graph. Enumerate small project bundles or use a mixed-integer model to maximize habitat reachable from a declared downstream anchor under a cost cap. Represent serial barriers explicitly: habitat behind two barriers is unlocked only if both are addressed. Test uncertain passability separately.

Validation: Compare connectivity calculations against inventory network metrics and inspected barrier assessments. Before/after fish-passage surveys could validate ecological benefit, but a downloadable NC intervention-outcome dataset is UNVERIFIED. Connected stream length is not evidence of recovered fish populations.

Three-minute wow: Two individually mediocre projects jointly unlock a tributary that the usual top-two ranking misses. Let judges lock one project and recompute its best partner.

Biggest risk/fallback: SARP already has a sophisticated prioritization tool. A clone is not novel. Differentiate through bundle complementarity, budget sensitivity, and uncertainty; use one catchment and a small assessed-barrier subset if topology cleaning takes too long.


3. Cutoff Cuts — Inspect the slope whose failure would isolate a community.

Pitch: Prioritize roadside slope inspections by both mapped landslide evidence and the consequences of losing that road.

Decision/user: An NCDOT district maintenance engineer chooses road segments for field inspection and drainage checks before a forecast storm—not autonomous slope stabilization.

Affected: People on single-access mountain roads, home-health patients, seasonal cabin occupants, tourists, and delivery workers. A sparsely populated road can still be the only exit.

Data:
  • Henderson County GIS publishes NC Geological Survey landslide initiation points, outlines, deposits, and debris-flow pathways.[6]
  • USGS: 3DEP terrain.[2]
  • OSM: roads and buildings.[1]
  Start in Henderson County, where an actual feature query worked.

Method: Combine distance to mapped movements and DEM-derived slope into a transparent screening score. Compute road-graph bridges, articulation points, and detour changes when candidate segments fail. Rank inspections by consequence and evidence, displaying those separately rather than disguising a hand-built score as a failure probability.

Validation: Hold out spatial clusters of observed landslide initiation points when testing a terrain-only susceptibility baseline. Never use the same event’s mapped deposit as a predictor for that held-out event. Independently check graph isolation against road connectivity. Actual road-closure prediction still needs closure observations.

Three-minute wow: A dramatic hillside ranks below an unremarkable road cut because the latter is the sole route to a settlement. Close either edge and show the difference.

Biggest risk/fallback: The inventory is not proof of present instability and may omit newer events. Skip prediction: deliver an explainable inspection shortlist around documented hazards and access bottlenecks, with inventory dates visible.


4. The Cleaner Next Door — Find off-property buildings that deserve investigation.

Pitch: Turn legacy dry-cleaning contamination records into a building-level review shortlist rather than treating the source parcel as the entire problem.

Decision/user: NC DEQ’s Dry-Cleaning Solvent Cleanup Act program manager chooses nearby buildings for case-file review, occupant outreach, and—after professional assessment—soil-gas or indoor-air sampling.

Affected: Renters, shop employees, children in commercial-space childcare, and people living above stores. Their relevant exposure location is a building, not a tract average or the former cleaner’s address.

Data:
  • NC DEQ: DryCleaning Remediation Program point layer with site IDs and status.[7]
  • NC DEQ: individual risk-management reports; the former Family Cleaners report documents an off-source property with groundwater impacts.[8]
  • OSM: buildings and tagged uses; coverage is incomplete.[1]

Method: Spatially join nearby buildings to source sites and case-file evidence. Where a report supplies a plume footprint, digitize it and rank buildings by documented intersection and unresolved evidence. Without a plume, use a clearly labeled review buffer—not a simulated contamination plume. Exclude resolved cases from new-investigation queues unless records justify otherwise.

Validation: Use report-described off-source impacts as retrospective case checks. Groundwater impacts do not validate indoor-air exposure; that requires measured soil-gas/air results. Proximity alone cannot establish exposure.

Three-minute wow: Reveal the off-property parcel described in a report, then show why a “contamination at this address” pin misses the actual investigation decision.

Biggest risk/fallback: PDF extraction and missing building attributes. Manually curate one or two documented cases, retaining report pages and a traceable review checklist. Never automatically label a building unsafe.


5. Legacy Dump, New Creek — Which forgotten landfill needs an erosion walkover?

Pitch: Locate legacy landfill sites where nearby surface-water pathways justify inspection for exposed waste and sediment transport.

Decision/user: NC DEQ’s Pre-Regulatory Landfill program or a county environmental-health team chooses sites and nearby stream reaches to inspect and, if warranted, sample.

Affected: Downstream anglers, children using informal creek access, neighboring renters, and landowners unaware of former disposal sites. Relevant pathways cross tract boundaries.

Data:
  • NC DEQ: Pre-Regulatory Landfill Sites, including status and document links.[9]
  • USGS: 3DEP terrain and NHDPlus HR streams/catchments.[2][3]
  • OSM: roads for field access.[1]

Method: Use each landfill point as a search anchor, not a footprint. Calculate stream proximity and downslope surface-routing scenarios across several possible source extents. Rank locations that remain concerning across scenarios; select an accessible downstream inspection reach. This screens surface erosion, not groundwater plumes.

Validation: Compare flagged sites with erosion/exposed-waste observations in case documents where available. Prospective walkovers and upstream/downstream sediment samples would test recommendations. A statewide public erosion-outcome dataset is UNVERIFIED; do not promise supervised model validation.

Three-minute wow: Two equally close streams yield different priorities because one lies upslope. Expand the uncertain landfill extent and watch whether the inspection recommendation changes.

Biggest risk/fallback: The verified layer contains points, not waste boundaries. If terrain routing is brittle, deliver a stream-proximity inspection shortlist with location uncertainty and document links. Do not report precise contaminant pathways.


6. Salt Sentinel — Which coastal monitoring well should be sampled next?

Pitch: Select chloride sampling locations that reduce coastal groundwater monitoring blind spots, rather than draw an unjustified smooth saltwater-front map.

Decision/user: NC DEQ Division of Water Resources groundwater staff choose existing monitoring wells to resample and geographic gaps for future investigation.

Affected: Private-well households, small businesses, seasonal occupants, and renters whose water source is invisible in municipal service statistics. The MVP maps monitoring coverage, not an invented private-well inventory.

Data:
  • USGS/EPA/National Water Quality Monitoring Council: Water Quality Portal station metadata and chloride results.[10]
  • My NC well query from 2020 onward returned 50 results at 34 wells, dated 2020–2022, including coastal locations and aquifer/depth metadata. That is real but sparse—not a current salinity assessment.

Method: Separate aquifers and depth groups; normalize units and handle censored values explicitly. Where sample support permits, fit a Gaussian process to log chloride and select a sampling batch by expected variance reduction. Otherwise use stratified geographic coverage plus time since last sample. Never interpolate between unrelated aquifers.

Validation: Leave out entire wells, not random measurements from the same well. Report prediction error and uncertainty coverage against held-out chloride observations; compare with a nearest-neighbor baseline. New field samples are necessary to test current conditions.

Three-minute wow: A sample from a nearby but different-depth well barely reduces uncertainty; sampling the same aquifer farther away resolves a genuine gap.

Biggest risk/fallback: Sparse, old, unevenly sampled observations. The fallback is the scientifically safer product: an aquifer-aware resampling schedule, not a saltwater-intrusion forecast or drinking-water safety judgment.


7. Stream Sleuth — Which three samples would most narrow the search upstream?

Pitch: Choose sampling locations that distinguish possible tributary origins of a measured downstream water-quality anomaly.

Decision/user: An NC DEQ basin investigator or riverkeeper chooses the next accessible tributary junctions or bridge locations to sample.

Affected: Downstream private-intake users, recreational paddlers, subsistence anglers, and upstream landowners who should not be blamed merely because they are geographically close.

Data:
  • USGS: NHDPlus HR directed flowlines/catchments.[3]
  • Water Quality Portal: geolocated chemistry observations and dates.[10]
  • OSM: road–stream crossings for candidate access locations.[1]
  A bridge is only a candidate; safe/legal access requires confirmation. No comprehensive pollution-source inventory is assumed.

Method: Treat upstream subcatchments—not named businesses—as candidate origins. Compute which origins drain past each sampling location. Use a Bayesian hypothesis model with explicit false-negative/dilution assumptions, then greedy expected-information-gain selection under a sample budget. Start with tree-network source localization; defer travel-time chemistry.

Validation: Historical, sufficiently contemporaneous upstream/downstream measurements can test whether chosen sites distinguish observed gradients. Predicting held-out concentrations does not validate source attribution. If no suitable event exists, use labeled synthetic injections on the real network for algorithm tests and report attribution validation as unfinished.

Three-minute wow: Three tributaries remain plausible. One strategically chosen observation eliminates two; a nearby but redundant sample eliminates none.

Biggest risk/fallback: Sparse sampling dates and unmodeled dilution destroy identifiability. Fall back to a tributary-discrimination planner that ranks sampling locations without claiming to have found the polluter. Avoid tidally reversing reaches in the MVP.


8. RidgeRelay — Where should a temporary emergency radio relay go?

Pitch: Choose temporary relay locations and compatible channel assignments that connect specified field teams across mountainous terrain.

Decision/user: A county emergency-management communications unit chooses approved accessible sites to survey or stage portable relays at during a communication-outage exercise.

Affected: Search-and-rescue crews, road crews, people in remote hollows, and temporary shelters or informal camps absent from residential population maps.

Data:
  • USGS: 3DEP terrain; I successfully retrieved a floating-point terrain TIFF.[2]
  • OSM: roads and candidate mapped public-use locations.[1]
  • Team locations, antenna heights, permitted sites, and radio parameters are scenario inputs. Public-land tags do not grant permission; private cellular/grid topology is unnecessary.

Method: Sample terrain profiles and test line of sight/Fresnel clearance for a declared radio band and antenna height. Build a feasible-link graph; solve a small node-weighted Steiner-tree integer program to connect required terminals using candidate relays. Apply DSATUR coloring to an explicitly defined interference graph. Distinguish single-channel repeaters from multi-radio backhaul rather than assuming every edge can use an independent channel.

Validation: Compare predicted links with measured packet delivery/RSSI where legal equipment is available. A small campus test validates the measurement pipeline, not mountain propagation. Terrain alone misses foliage, buildings, equipment faults, and interference.

Three-minute wow: Drag a relay onto an impressive ridge: one valley still cannot connect. The solver chooses a less obvious saddle; remove a relay and reveal whether a backup path survives.

Biggest risk/fallback: Real RF validation and equipment integration are unlikely in 20 hours. Ship a labeled terrain-feasibility/site-survey planner with conservative margins and a field-test checklist—not guaranteed emergency coverage.


WHAT I WOULD ACTUALLY BUILD

Choose RailLock unless the team already has working radio-measurement equipment. Limit it to one town, manually verify crossings, cache inputs, and make the output an auditable standby-location recommendation with before/after routes and an exportable field sheet.

For any choice, the interface should be:

  Set a budget or scenario
  → Receive a short action list
  → Inspect why each action beats its alternative
  → Export it for field use

That addresses all four judging dimensions. A tested decision beats a larger map with speculative predictions.


Sources:

[1] https://download.geofabrik.de/north-america/us/north-carolina.html

[2] https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer

[3] https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer

[4] https://aquaticbarriers.org

[6] https://gisweb.hendersoncountync.gov/arcgis/rest/services/GISWeb/Landslide_Data/MapServer

[7] https://services2.arcgis.com/kCu40SDxsCGcuUWO/arcgis/rest/services/DryCleaning_Remediation_Program/FeatureServer

[8] https://deq.nc.gov/risk-management-plan-former-family-cleaners/download?attachment=

[9] https://services2.arcgis.com/kCu40SDxsCGcuUWO/arcgis/rest/services/Pre_Regulatory_Landfill_Sites/FeatureServer

[10] https://www.waterqualitydata.us/webservices_documentation

[11] https://data.transportation.gov/resource/m2f8-22s6.json
