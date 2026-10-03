# Claude independent pool (written before reading the Hermes/GPT pool)

Mode (banned): food-desert maps, urban heat island / tree-canopy equity, flood-risk choropleths, EV-charger siting,
generic wildfire risk, pharmacy/clinic access deserts, broadband gap maps, bike-lane / sidewalk gaps, air-quality
dashboards, crime heatmaps, park access, transit deserts, generic "AI chatbot over a map", recycling-bin siting,
solar-rooftop potential.

Dataset status: VERIFIED = existence and public download confirmed by search on 2026-10-03. UNVERIFIED = plausible, not yet confirmed.

## C1. Lifeline Crossings
Which road-stream crossings, if they wash out, cut people off from a hospital? Helene isolated whole WNC communities
because a few culverts and bridges failed.
- Decision / user: NCDOT division engineers and county emergency management. Which crossings to harden first; where to pre-stage supplies on the side that becomes an island.
- Method: DEM flow accumulation gives upstream drainage area at every OSM-road x NHD-stream crossing (a proxy for peak flow and washout risk). Isolation analysis on the OSMnx graph: remove a crossing and count people (Census blocks) who lose every route to a hospital. Rank by washout likelihood x people stranded. Greedy hardening plan: the first k crossings that save the most people.
- Data: USGS 3DEP DEM (VERIFIED, standard), NHDPlus HR (VERIFIED, standard), OSM via OSMnx, Census blocks, CMS hospital locations. Helene closures from the NCDOT dashboard / NC Helene Data hub (VERIFIED the hub exists; closure-layer schema not yet inspected).
- Validation: back-test against real Helene road closures. Did the top-ranked crossings fail?
- Wow: replay Helene. Communities go dark one by one as crossings fail, then the "harden these 10" plan keeps them connected.

## C2. Blackout Islands
Where does cellular service die first when power, fiber backhaul, and towers fail together? During Helene, FCC DIRS
reported a county-level share of cell sites out of service (Mitchell County: 9 of 20).
- Decision / user: county EM and carriers. Where to pre-stage satellite kits and cells-on-wheels, and which towers get backup generators.
- Method: build a tower-to-population coverage graph (FCC ASR tower registrations + FCC BDC mobile coverage polygons + DEM viewshed). Find articulation towers whose loss uncovers the most people. Run cascading failure from power outage and terrain/flood exposure.
- Data: FCC DIRS Helene county reports (VERIFIED PDFs at docs.fcc.gov), FCC ASR (VERIFIED, standard), FCC BDC mobile coverage (VERIFIED, standard), OpenCelliD (needs an API key).
- Validation: predicted outage share per county vs. DIRS reported share for the 21 WNC counties.
- Risk: no tower-to-carrier-to-backhaul topology is public, so the cascade model depends on assumptions.

## C3. Ten-Minute Shelter Gap
A tornado warning gives about 10 minutes. Mobile-home residents die disproportionately in tornadoes. Which mobile home
parks have no sturdy building reachable on foot inside the warning lead time?
- Decision / user: county EM applying for FEMA P-361 community safe-room grants (HMGP / BRIC). Where to build the next safe room.
- Method: HIFLD mobile home parks plus a building-footprint shape detector for parks the list misses (clusters of roughly 4-5 m x 18-25 m rectangles). OSMnx walking isochrones at night, carrying kids, to candidate hardened buildings (schools, churches). Weight by SPC historical tornado track density. Facility location (max-coverage) for k new safe rooms.
- Data: HIFLD Mobile Home Parks (VERIFIED, archived after the Aug 2025 HIFLD Open shutdown: source.coop/seerai/hifld, data.gov, NASA FeatureServer), SPC tornado GIS (VERIFIED, standard), Microsoft/Overture footprints (VERIFIED, standard).
- Validation: the detector's recall vs. HIFLD where HIFLD exists; tornado-fatality reports by housing type (NWS storm data).

## C4. Unknown Lines (lead service lines, value of information)
EPA rules required utilities to inventory service lines; many lines are listed as "unknown". Predict which unknown
lines are lead, and choose which to dig next so each dig removes the most uncertainty.
- Data: utility inventories for NC cities (UNVERIFIED for NC), parcel year-built (Wake County, VERIFIED-ish), ACS children under 6.
- Risk: the ground truth may not be public.

## C5. Ghost Addresses
Buildings that 911 cannot find: footprints with no NG911 address point nearby.
- Data: AddressNC statewide points (VERIFIED, NC OneMap), Overture/MS footprints (VERIFIED). AddressNC "New Locations" works as a natural back-test, because addresses added later were once missing.
- Wow is moderate.

## C6. Next Slope
Helene triggered more than 2,200 mapped landslides. Which occupied homes and roads sit in the runout path of the next one?
- Data: USGS Helene landslide inventory (VERIFIED, doi:10.5066/P14CHGKS, SHP/GeoJSON/CSV), 3DEP DEM, footprints.
- Method: susceptibility model (slope, curvature, flow accumulation, rainfall) trained on Helene, spatially cross-validated, then runout tracing downslope to buildings.

## C7. Invisible Field Workers
H-2A farmworker worksites (DOL OFLC disclosure data) crossed with heat forecasts. Census tracts miss these workers. Where to send heat-safety outreach.
- Validation: weak, because heat illness is not public at a geocoded level.

## C8. Checkerboard Buyouts
Flood buyouts that leave holes in neighborhoods. Choose contiguous buyout clusters.
- Data: OpenFEMA HMA mitigated properties and NFIP claims (VERIFIED, but coordinates are coarse).
