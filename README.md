# Pinchpoint

**Where roads squeeze rivers through a pipe. Fix the right ones first.**

WolfHacks 2026 · Center for Geospatial Analytics track: *use geospatial data to understand a pressing societal or environmental issue, and build software that helps determine where to take action.*

![Pinchpoint: Upper French Broad, $2M plan](docs/screenshot.png)

## The problem

Every place a road crosses a stream, the water goes through a culvert. When the culvert is narrower than the stream, it fails twice:

- **In floods it plugs and washes the road out.** Hurricane Helene damaged nearly 9,500 sites on western North Carolina's state roads. NCDOT's January 2025 count included 867 culverts. NCDOT puts transportation recovery at about $5.8 billion.
- **The rest of the time it walls the river off.** Fish below cannot reach the habitat above. In NC, field crews have assessed 887 road crossings that cut a stream network; 800 of them are barriers to fish (National Aquatic Barrier Inventory).

The fix is the same for both: a crossing as wide as the stream. After Tropical Storm Irene, stream-width crossings in Vermont came through largely undamaged while undersized pipes failed (Gillespie et al. 2014). There is money for it: a $1B federal culvert program (Bipartisan Infrastructure Law, FY22–26) and Helene rebuilding funds. But there is not enough money for all of them, so someone has to choose.

Today that choice is usually made one culvert at a time: score each crossing on its own and fund down the list. A river is a network, though. A culvert's value depends on the culverts below it, and a road agency and a fish agency rank the same pipes by different lists.

## What Pinchpoint does

Pinchpoint answers one question: **with this much money, which culverts should we replace first?**

1. **Set the scope:** one of 33 NC watersheds, or **all of North Carolina** with a statewide budget (up to $100M).
2. **Set the budget** and **what you're protecting**: rivers, roads, or a mix.
3. **An exact optimizer returns the plan:** the best set of culverts to replace. It re-solves live in the browser as you drag the sliders; the statewide problem (800 culverts) solves in about 60 ms.
4. **The action plan** turns that into a document an agency can act on. Projects come in priority order, and culverts that only pay off together are grouped as one project. For each project it gives:
   - **What to build:** replace the pipe with a creek-wide crossing about N ft wide, with exact coordinates.
   - **Cost:** a planning estimate with a likely range.
   - **What it buys:** river miles reconnected, brook trout habitat, and washout risk removed.
   - **Why it's in the plan:** for example, "these two culverts only pay off together; ranking one at a time picks neither".
   - **Confidence:** how often the project stayed in the plan across 30 random cost scenarios.
   - **Next steps:** a site visit, an engineering estimate, the road owner to coordinate with, and wildlife biologists if trout are present.

   Statewide, it also shows **where the money goes** by watershed. Print it, save it as a PDF, or download it as a CSV.

To check and explain the plan:

- **Map:** the culverts the plan replaces (pulsing), the ones one-at-a-time ranking would replace, and the river each plan reconnects, drawn on stream networks rebuilt from USGS NHDPlus HR. Statewide, each watershed is shaded by its share of the budget.
- **Comparison with how it's done today:** the same budget spent by ranking culverts one at a time, side by side, with a budget curve.
- **Flyover for any project:** a narrated, seven-scene 3D tour over USGS satellite imagery. It covers the crossing, an animated flood cross-section of the pipe vs. the fix, the river it blocks traced upstream, the barrier below highlighted, the fix and its cost, and where it sits in the plan.
- **Stress test** under random costs, a **field sheet** per culvert, and a **guided tour**.
- **Light on bandwidth:** river networks ship in a compact encoding (Asheville area 9.2 MB to 1.5 MB, 0.5 MB gzipped, same geometry). The flyover code loads only when used, and the map caps rendering resolution on high-density phone screens. It works the same on phones.

## What we found

| | |
|---|---|
| **Chains are where planning pays.** | On Cherry Creek near Canton, two culverts in a row each open only 1.4 miles alone, so ranking skips both. Together they reconnect 8.2 miles. $1M in the Pigeon watershed goes from 7.2 to 12.6 river miles (+75%). On Whiteoak Creek (Upper Little Tennessee), two culverts that each score zero on their own open 9.6 miles together. |
| **Most watersheds have few chains.** | Across the 10 NC watersheds with at least 15 assessed culverts, network-aware plans reconnect 1,256 vs 1,234 river miles at $5M each (+2%). In the Upper French Broad (Asheville) at $2M: 46.6 vs 39.6 miles (+18%). The tool shows where ranking is good enough. |
| **Rivers and roads trade off unevenly.** | At $5M in the Upper French Broad, a plan for washout risk alone reconnects 66% of the river miles a river plan would. A plan for rivers alone still removes 85% of the washout risk a roads plan would. A 70/30 roads-leaning plan keeps 91% and 94%. |

## How it works

```
NABI public API (assessed culverts + dams, NC)       USGS NHDPlus HR (region 0601 geodatabase)
          │                                                        │
pipeline/build_forest.py                               pipeline/build_streams.py
  tree of culverts via downstream barrier IDs            snap 872 barriers to flowlines (median 0.1 m)
  planning cost + washout screening score                walk downstream by HydroSeq, assign every
  topology check                                         stretch to the first barrier below it
          │                                                        │
pipeline/optimizer.py  ◄── exact optimizer ──►  app/solver.js (same algorithm, in the browser)
          │
pipeline/analyze.py: statewide comparison, cost Monte Carlo, rivers-vs-roads frontier
pipeline/compact_streams.py: river networks in a compact integer-offset encoding
          │
app/: MapLibre GL, live optimization, action plan (app/plan.js), flyover (app/flyover.js)
```

**Objective.** The inventory scores one culvert by its gain, `min(upstream miles, downstream miles)`. We use the same rule for bundles. A chain of culverts hangs from an *anchor*: the river below the lowest culvert, bounded by a dam, a waterfall or the outlet. A plan reconnects the miles above every culvert whose path down to the anchor is fully open, capped at the anchor's length. For one culvert this is exactly the inventory's gain. The flood term is a screening index (constriction × drainage size × road type), additive per culvert. A slider weights the two.

**Optimizer (exact).**
- Chains where the cap cannot bind use a two-state tree dynamic program, where each culvert knows whether the river below it is open or closed.
- Chains where the cap can bind (44 in NC, at most 15 culverts) are enumerated.
- Chains are joined by max-plus convolution over budget.

One pass gives the optimum for every budget up to $20M. The Upper French Broad (215 culverts) solves in well under a second in the browser.

## Validation

| Check | Result |
|---|---|
| Tree topology: a culvert's downstream network length equals its parent's upstream length | **244 / 244** culvert-to-culvert links exact |
| Optimizer = brute-force enumeration (random forests, all budgets and weights) | **300 / 300** (Python), **200 / 200** (browser solver vs Python) |
| River networks rebuilt from raw NHDPlus HR reproduce inventory upstream miles | **88%** of 405 culverts within 5%, median error 0.4%, across 7 watersheds |
| Advantage survives cost uncertainty (lognormal σ = 0.5 per culvert) | network-aware ≥ ranking in **200 / 200** statewide draws, median +4% |
| Second metric: the inventory's gain rule applied to every merge (not optimized) | roughly tied with ranking (1,256 vs 1,248 mi at $5M), reported as is |

Run them yourself:

```bash
python -m pytest tests/
node tests/test_solver_js.mjs
```

## Run it

```bash
python -m venv .venv && .venv/Scripts/pip install pandas numpy geopandas shapely pyproj pyogrio requests pytest
python pipeline/build_forest.py     # data/processed/culverts_nc.csv
python pipeline/analyze.py          # results/summary.json, statewide.csv
python pipeline/export_app.py       # app/data/*.json
python pipeline/build_streams.py 06010105   # needs the NHDPlus HR 0601 geodatabase in data/raw/
python -m http.server 8765 --directory app  # open http://localhost:8765
```

Raw data is fetched from public endpoints (see `notes/plan.md`). The NABI CSVs come from `https://tool.aquaticbarriers.org/api/v1/public/{barriers,dams}/state?id=NC`.

## Limits

- **Costs are planning-level estimates:** stream-width span from NC regional bankfull curves, times a per-foot price by road type, plus mobilization. The stress test shows how much the plan depends on them.
- **The washout score is a screening index**, not a failure probability. Helene's damaged-culvert locations are not public, so we could not check it against real failures. That is the first thing we would validate with NCDOT data.
- **Only field-assessed culverts are candidates** (the 800 assessed barriers that cut a network). Most NC road crossings have never been surveyed.
- **Dams and waterfalls are permanent.** Waterfalls are not in the public download, which is most of why 12% of rebuilt networks miss by more than 5%.
- **Habitat is counted in miles**, not by species or habitat quality.

## Data and references

- National Aquatic Barrier Inventory & Prioritization Tool, Southeast Aquatic Resources Partnership: public API, downloaded 3 Oct 2026.
- USGS NHDPlus High Resolution (region 0601) and Watershed Boundary Dataset.
- Basemap © OpenStreetMap contributors via OpenFreeMap. Terrain: AWS Terrain Tiles.
- Gillespie, N. et al. 2014. Flood effects on road–stream crossing infrastructure: economic and ecological benefits of stream simulation designs. *Fisheries* 39(2):62–76.
- Cote, D. et al. 2009. A new measure of longitudinal connectivity for stream networks. *Landscape Ecology* 24:101–113.
- Prior work on optimizing barrier removal: O'Hanley, J. R. & Tomberlin, D. 2005. Optimizing the removal of small fish passage barriers. *Environmental Modeling & Assessment* 10(2):85–98. King, S. et al. 2017. A toolkit for optimizing fish passage barrier mitigation actions. *Journal of Applied Ecology*. Pinchpoint brings this kind of optimization to NC's public inventory, jointly with flood risk, in the browser.
- Helene damage: NCDOT figures reported by Carolina Journal (22 Jan 2025: 9,307 damage sites including 867 culverts) and 828 News NOW (26 Sep 2026: nearly 9,500 sites, about $5.8B recovery). Culvert grant program: FHWA.

## AI usage

WolfHacks asks teams to cite AI use. We used AI tools. We chose the problem and the approach, set the requirements, tested every version in the browser, and sent back changes. Claude Code wrote most of the code and text from those instructions. GPT, through Hermes, gave a second, independent set of ideas and wrote one module. Every number in the app is produced by scripts from public data and is tested.

**Tools**
- **Claude (Anthropic), through Claude Code:** ran the ideation workflow; wrote the data pipeline, optimizer, tests and web app; drafted this README and the DevPost text.
- **GPT (OpenAI), through the Hermes agent CLI:** wrote an independent second idea pool; held two advisor seats and two peer-reviewer seats in the idea council; wrote the animated flood cross-section (`app/xsection.js`) from our spec in `notes/xsection_spec.md`, which we then adjusted.

**What we decided**
- **How to pick an idea.** We didn't want to take one model's first answer. We used a cross-model "LLM council," adapted from [llm-council](https://github.com/aiwithremy/claude-skills-llm-council), to reduce single-model bias and hallucinated datasets:
  - Two model families generated ideas independently.
  - Every dataset an idea depended on was checked against a live source.
  - The ideas were judged with their source hidden.

  The record is in `ideation/`.
- **The problem.** We chose undersized culverts from three finalists (`ideation/PROPOSALS.md`). Most people never think about culverts, so we framed the project around the road damage they cause in floods like Helene.
- **What the tool should be.** After reviewing early versions, we felt the app explained the problem more than it solved it. So we asked for:
  - the **action plan**: ranked projects, each with what to build, cost, benefit, reasons and next steps;
  - **statewide budgeting**;
  - the **flyover**, to show why a specific crossing fails and what the fix changes.
- **Review and revisions.** We:
  - rewrote captions we found unclear;
  - asked for downstream barriers to be highlighted;
  - fixed diagram labels that were cut off;
  - asked for the site to work on phones and slow connections without losing features;
  - rejected a color-theme redesign and reverted it.

**Our prompts**:

> "I'm linking the LLM Council repository to reduce a specific bias and hallucinations… Propose 3 different potential ideas. It should not be generic; ideally it's scalable and has an actual real-world application… You can also use Hermes (GPT) to get different perspectives."

> "I like the culvert idea and its application… Culverts aren't something people think about much at all, so frame it accordingly. Read the requirements exactly."

> "I want almost a video of whichever culvert we choose, like Street View in Google Maps. It should be detailed: show the reasons why the issues are there and why the proposed budget will help fix them."

> "Make the captions for each flyover slide easier to understand. For some sections, like the fix, I don't understand what fix you're talking about. In the what's-below section, if it references another barrier, highlight that too so it's visible and obvious."

> "The scale numbers and some of the text in those diagrams are on the edge and partially cut off. Make sure they're evenly spaced."

> "The geospatial track is supposed to focus on software that finds a solution to these problems. The actual solutions should be somewhere in the app, since that's what we need to present. I'm concerned we haven't fully built the software to help and have instead created an interactive tutorial."

> "Make the website friendlier for devices. Keep it exactly the same in features and look, but optimize it for lower bandwidth without sacrificing quality."

> "For the river streams, make the points pulse a little so they're visible. Change the starting map color to green, so the flyover transitions straight from the map."

The prompts the ideation workflow sent to the models were written from our brief

**How we checked AI-written work**
- Model-written code was tested before any of its numbers went into the app. For example, testing against the inventory's own `min(upstream, downstream)` rule showed that a culvert above a short pocket of river (such as one below a dam) must be capped at what that pocket can hold. The final optimizer handles that cap exactly.
- The two model families favored their own ideas even with sources hidden (GPT advisors 6/6, Claude advisors 8/9). So the final choice weighted only the points both families agreed on (`ideation/PROPOSALS.md`).
- Every figure is produced by a script in `pipeline/` from public data. The optimizer is checked against brute force (304 tests), the browser solver against Python (200 cases), and the rebuilt stream networks against the inventory.

## Team

Pavan Parola, plus teammates listed on DevPost.
