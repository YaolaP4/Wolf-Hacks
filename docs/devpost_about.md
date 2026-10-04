## Inspiration

When Hurricane Helene hit western North Carolina in September 2024, it damaged nearly 9,500 sites on state roads. By NCDOT's January 2025 count, 867 of them were culverts: the pipes that carry creeks under roads. NCDOT now estimates transportation recovery at about \$5.8 billion.

Most people never think about culverts, but there's one wherever a road crosses a stream. When a culvert is narrower than the creek, it fails in two ways:

- **In floods**, it can't carry the water. The water backs up behind the road, spills over it, and washes it out.
- **The rest of the time**, water shoots through the narrow pipe too fast for fish to swim up, walling off the creek above.

One fix solves both: replace the pipe with a crossing as wide as the creek. After Tropical Storm Irene, crossings built that way in Vermont came through intact while undersized pipes washed out (Gillespie et al., 2014). There's money for this, from a \$1B federal culvert program and Helene rebuilding funds, but not enough to replace every culvert. Someone has to decide which ones come first. Today that's usually done by scoring each culvert on its own and funding down the list.

Rivers are networks, though. A culvert high on a creek is worth nothing to fish until the one below it is fixed too. We wanted a tool that plans with that in mind.

## What it does

Pinchpoint answers one question: **with this much money, which culverts should we replace first?**

1. Pick one of 33 North Carolina watersheds or the whole state. Set a budget and choose what you're protecting: rivers, roads, or a mix.
2. An exact optimizer picks the best set of culverts to replace. It runs in the browser and re-solves as you drag the sliders; all 800 culverts statewide solve in about 60 ms.
3. The **action plan** turns that into something an agency can act on. It lists projects in priority order, each with:
   - what to build
   - cost and likely range
   - river miles reconnected and washout risk removed
   - why it was chosen and how confident we are
   - next steps

   It prints to PDF and exports to CSV.
4. The **map** shows the culverts the plan picks, the ones one-at-a-time ranking would pick, and the river each plan reconnects.
5. The **flyover** is a narrated 3D tour of any culvert over satellite imagery. It shows the crossing, an animated flood cross-section of the pipe vs. the fix, the creek it blocks, the barrier below, and where it fits in the plan.

## How we built it

**Data.**
- **National Aquatic Barrier Inventory (public API):** 2,804 assessed road crossings and 28,759 dams in North Carolina. Of the crossings, 800 culverts are field-confirmed barriers that cut a stream network.
- **USGS NHDPlus High Resolution:** stream flowlines, plus the Watershed Boundary Dataset.
- **Flyover:** USGS satellite imagery and AWS terrain tiles, with the USGS Hurricane Helene landslide inventory for context.

**The network.**
- Each blocking culvert links to the next barrier downstream, giving 569 trees of culverts.
- Each tree hangs from an *anchor*: the open river below its lowest culvert, ending at a dam, a waterfall or the outlet.
- To draw real rivers, we placed over 1,500 barriers onto NHDPlus HR flowlines (median snap distance 0.1 m). Then we walked downstream by hydrologic sequence and assigned every stretch of river to the first barrier below it.

**The objective.** The inventory scores a single culvert by its gain: the smaller of the river miles above and below it. We extend that rule to any set of culverts. Within a budget, Pinchpoint chooses the set that maximizes

$$\max_{S\,:\,\mathrm{cost}(S)\le B}\;(1-\lambda)\,\frac{H(S)}{H_{\max}} \;+\; \lambda\,\frac{F(S)}{F_{\max}}$$

where H is the river reconnected and F is the washout risk removed:

$$H(S)=\sum_{\text{trees } T}\min\!\Big(\sum_{v\in T\,:\,\mathrm{path}(v)\subseteq S} u_v,\;D_T\Big),\qquad F(S)=\sum_{v\in S} f_v$$

- **What the symbols mean:** u is the river miles directly above a culvert, path(v) is that culvert plus every culvert below it in its tree, and D is the length of the tree's anchor river.
- **What the rule does:** a culvert's miles count only once the whole path down to the anchor is open, capped by how much open river lies below. For a single culvert this is exactly the inventory's gain, min(upstream, downstream).
- **The slider:** λ is the rivers-vs-roads slider.

The washout score is a screening index:

$$f_v = \mathrm{constriction}_v \times \mathrm{flow\ load}_v \times \mathrm{road\ consequence}_v$$

Costs are planning estimates: a creek-wide span from North Carolina's regional bankfull-width curves, priced per foot by road type, plus mobilization. For mountain streams with drainage area A in square miles:

$$\mathrm{span} = 1.2\,W_{bf} + 2\ \mathrm{ft},\qquad W_{bf} = 19.9\,A^{0.36}$$

**The optimizer** is exact.
- **Trees where the cap can't bind:** a dynamic program keeps two states per culvert (whether the river below it is open or closed). It combines subtrees with a max-plus convolution over budget:

$$(a \oplus b)[k] = \max_{0\le i\le k}\big(a[k-i] + b[i]\big)$$

- **Trees where the cap can bind** (44 in North Carolina, at most 15 culverts each): solved by enumeration.
- **Speed:** one pass gives the optimum for every budget, so the budget slider responds instantly.
- **Two implementations:** the same algorithm runs in Python for the analysis and in JavaScript in the browser.

**The app** is plain HTML, CSS and JavaScript with MapLibre GL, with no build step. River networks ship in a compact integer-offset encoding: the Asheville-area file went from 9.2 MB to 1.5 MB with identical geometry. The flyover code loads only when it's used, so the site works on phones and slow connections.

**Checks:**
- The optimizer matches brute-force enumeration on 300 of 300 random networks, and the browser solver matches Python on 200 of 200.
- All 244 culvert-to-culvert links in the inventory are internally consistent.
- Our rebuilt river networks reproduce the inventory's upstream miles within 5% for 88% of 405 culverts (median error 0.4%).
- The network-aware plans beat one-at-a-time ranking in 200 of 200 random cost scenarios.

## Challenges we ran into

- **Defining "river reconnected" for a group of culverts.** A culvert above a short pocket of river, such as one just below a dam, can only reconnect as much as that pocket supports. Getting this right meant extending the inventory's min(upstream, downstream) rule to sets of culverts. The optimizer also had to handle that cap exactly, which is why capped trees are solved by enumeration.
- **Hydrography IDs that didn't match.** The inventory snaps to a newer NHDPlus HR release than the published regional geodatabase, so every ID join failed. We placed barriers by location instead and validated the rebuilt networks against the inventory's own mileage.
- **Data volume.** Paging 111,000 flowlines through the USGS web service was too slow, so we read the 481 MB regional geodatabase locally. We then compressed the river data for the browser without changing any geometry.
- **3D terrain.** In the flyover, the camera first aimed at sea level instead of the mountain surface, which pushed the creek off-screen. Separately, one animated map layer was reprocessing all the river data many times a second and starving everything else. Both took careful debugging.
- **Explaining it.** Culverts are unfamiliar to most people. We rewrote the flyover narration in plainer language, and built the action plan so the output reads as decisions rather than just a map.

## What we learned

- **Network planning matters a lot in some places and barely at all in others.**
  - On Cherry Creek near Canton, two culverts in a row each open only 1.4 miles on their own, so ranking skips both. Together they reconnect 8.2 miles. With \$1M in the Pigeon watershed, that means 12.6 river miles instead of 7.2 (+75%).
  - On Whiteoak Creek, two culverts that each score zero alone open 9.6 miles together.
  - Statewide, most culverts aren't in chains, and network planning beats ranking by only about 2%. A good tool should tell you which case you're in.
- **Rivers and roads mostly want the same culverts, but not entirely.** At \$5M around Asheville, a plan built only for washout risk reconnects 66% of the river miles a river plan would. A plan leaning 70/30 toward roads keeps 91% of the river gain and 94% of the washout reduction.
- **The method isn't new, but using it this way is.** Optimizing barrier removal has a research history (O'Hanley & Tomberlin, 2005; King et al., 2017). What was missing was running it on a state's real inventory, together with flood risk, in a form a planner can use.

## What's next

- Check the washout score against NCDOT's Helene damage sites. Those locations aren't public, and they're the first dataset we'd ask for.
- Use real project costs and species-specific habitat instead of plain river miles.
- Rank which unsurveyed road crossings to assess next. Most crossings in North Carolina have never been surveyed.
- Expand to other states. The inventory and NHDPlus HR are national, and the optimizer doesn't change.
