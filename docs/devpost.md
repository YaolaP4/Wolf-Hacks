# DevPost submission text

Paste each section into the matching DevPost field.

---

## Project name
Pinchpoint

## Elevator pitch (short tagline, under 200 characters)
Undersized culverts wash out roads in floods and wall rivers off from fish. Pinchpoint picks which ones to replace on a budget, treating the river as a network, on real North Carolina data.

## Track
Center for Geospatial Analytics

---

## Inspiration

When Hurricane Helene hit western North Carolina, it damaged nearly 9,500 sites on state roads. By January 2025 NCDOT had counted 867 damaged culverts: the pipes that carry streams under roads. NCDOT now puts transportation recovery at about $5.8 billion.

Most people never think about culverts, but they sit wherever a road meets a stream. When one is narrower than the stream, it fails twice. In a flood it plugs and the road washes out. The rest of the time it is a wall: fish below can't reach the river above. The fix for both is the same, a crossing as wide as the stream. After Tropical Storm Irene, stream-width crossings in Vermont came through intact while undersized pipes failed (Gillespie et al. 2014).

There is money to do this: a $1B federal culvert program and billions in Helene rebuilding. There isn't enough for every culvert, though. We asked a simple question: if you can only replace some of them, which ones?

## What it does

Pinchpoint is a planning map for that decision.

1. **Pick a watershed** (33 in NC), **set a budget**, and **say what you're protecting**: rivers, roads, or a mix.
2. An **exact optimizer** returns the best set of culverts to replace. It runs live in the browser and re-solves as you drag the sliders.
3. Next to it, Pinchpoint shows what you'd get by **ranking culverts one at a time**, which is how barriers are usually prioritized: miles of river reconnected, share of washout risk removed, number of culverts, and dollars.
4. The map lights up the **river miles each plan reconnects**, drawn on stream networks we rebuilt from USGS high-resolution hydrography.
5. Click any culvert for a **field sheet**: assessment, how badly it squeezes the stream, drainage area, river above and below, planning cost range, washout score, and a plain-language reason it was or wasn't chosen.
6. **Stress-test costs** re-solves under 60 random cost scenarios and reports how often the plan still wins.

## What we found

- **Chains of culverts are where planning pays off.**
  - On Cherry Creek near Canton, two culverts in a row each open only 1.4 miles on their own, so ranking skips both. Replaced together they reconnect 8.2 miles. With $1M in the Pigeon watershed, that means 12.6 river miles instead of 7.2 (+75%).
  - On Whiteoak Creek in the Upper Little Tennessee, two culverts that each score zero alone open 9.6 miles together. One-at-a-time ranking can never find that pair.
- **Most watersheds don't have many chains, and there ranking does fine.** Statewide, network-aware plans beat ranking by about 2%. Around Asheville (Upper French Broad) at $2M, the gain is +18%. Knowing where ranking is good enough is useful too.
- **Rivers and roads trade off unevenly.** At $5M around Asheville:
  - A plan built only for washout risk reconnects 66% of the river miles a river plan would.
  - A plan built only for rivers still removes 85% of the washout risk.
  - A 70/30 roads-leaning plan keeps 91% of the river gain and 94% of the washout reduction.

## How we built it

**Data**
- National Aquatic Barrier Inventory public API: 2,804 assessed road crossings and 28,759 dams in NC.
- USGS NHDPlus High Resolution flowlines (region 0601) and the Watershed Boundary Dataset.
- OpenStreetMap basemap and AWS terrain tiles for hillshade and contours.

**Network.**
- Each culvert that cuts a stream links to the next barrier downstream, which gives a forest of 569 trees of culverts. Dams, waterfalls and river outlets act as the anchors.
- To draw real rivers, we placed 1,500+ barriers onto NHDPlus HR flowlines (median snap 0.1 m), walked downstream by hydrologic sequence, and assigned every stretch of river to the first barrier below it.

**Objective.** The inventory scores a single culvert by its gain, `min(upstream, downstream)` miles. We extended that same rule to bundles:
- A plan reconnects the miles above every culvert whose path down to its anchor is fully open, capped at the anchor's length.
- Flood risk is a screening score: constriction × drainage size × road type.

**Optimizer (exact).**
- Two-state tree dynamic program (is the river below this culvert open or closed?), joined across trees by max-plus convolution.
- Chains where the cap can bind are solved by full enumeration (at most 15 culverts).
- One pass gives the optimum for every budget up to $20M. The same algorithm runs in Python for analysis and in JavaScript in the browser.

**App.** Plain HTML, CSS and JavaScript with MapLibre GL. Styled after USGS topographic maps: hillshade, brown contours, blue hydrography and italic stream names. No build step.

## Challenges we ran into

- **Our first objective was wrong, and the demo caught it.** It credited a culvert with every mile above it, even when the river below was a 0.4-mile pocket under a dam. That inflated our headline from +18% to +64%. We switched to the inventory's own gain rule, made the optimizer handle the cap exactly, and reran everything. The smaller numbers are the true ones, and they're the ones we report.
- **The hydrography IDs didn't match.** The inventory snaps to a newer NHDPlus HR release than the published regional geodatabase, so every ID join failed. We placed barriers spatially instead, then checked the rebuilt networks against the inventory's own mileage.
- **The USGS REST service needed about an hour to page through 111,000 flowlines.** We switched to the 481 MB regional geodatabase and read it locally.

## Accomplishments that we're proud of

- **Exact, and checked:**
  - The optimizer matches brute-force enumeration on 300 of 300 random networks. The browser version matches Python on 200 of 200.
  - Rebuilt river networks reproduce the inventory's upstream miles within 5% for 88% of 405 culverts (median error 0.4%).
  - All 244 culvert-to-culvert links in the inventory are consistent.
- The network-aware plans beat ranking in 200 of 200 random cost scenarios.
- It's fast enough to plan live with a slider, in a browser, with no server.
- We report the result honestly, including where our method barely matters.

## What we learned

- Being network-aware matters a lot in some places and barely at all in others. A good tool should tell you which case you're in.
- Rivers and roads mostly want the same culverts, but planning only for roads leaves a third of the river benefit on the table.
- Optimizing barrier removal has a research history (O'Hanley & Tomberlin 2005; King et al. 2017). What's missing is putting it on a state's real inventory, jointly with flood risk, where a planner can use it.

## What's next for Pinchpoint

- Validate the washout score against NCDOT's Helene damage sites. The locations aren't public, and that's the first dataset we'd ask for.
- Real cost data from NCDOT and NC Wildlife Resources Commission projects, plus species-specific habitat instead of plain miles.
- Unassessed crossings: most NC road crossings have never been surveyed. Pinchpoint could rank which ones to survey next by how much they could change the plan.
- Every state: the inventory and NHDPlus HR are national, and the optimizer doesn't change.

## Built with
python, geopandas, shapely, pyogrio, numpy, pandas, javascript, maplibre-gl, html, css, usgs-nhdplus-hr, national-aquatic-barrier-inventory, openstreetmap, playwright, claude, gpt

## Links
- GitHub: https://github.com/YaolaP4/Wolf-Hacks
- Demo: run locally with `python -m http.server 8765 --directory app` (or the hosted link, if deployed)

## AI disclosure
We used Claude (Claude Code) and GPT (through the Hermes agent) for ideation, code and writing. The README has the full AI-usage section with prompts, what the models got wrong, and how we checked every number.
