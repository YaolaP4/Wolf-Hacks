# Judging demo (about 3 minutes) and Q&A prep

**Setup at the table:**
- Laptop on power. Browser open at `http://localhost:8765`, started with `python -m http.server 8765 --directory app` from the repo root.
- Clear the URL hash first so the intro card shows.
- The app needs internet for map tiles. If the Wi-Fi drops, the panel numbers, chart and plan list still work. Only the basemap goes blank.
- Click **Take the 60-second tour** and talk over it. Use **Back** if a judge wants to look longer.

## Script

**0:00 Hook (intro card is on screen)**
> "Every road that crosses a stream squeezes it through a pipe, a culvert. When Helene hit western North Carolina, NCDOT counted 867 damaged culverts among more than 9,000 damaged road sites. Undersized culverts fail twice. In a flood they plug and the road washes out. The rest of the time they're a wall: fish below can't reach the river above. The fix is the same for both, a crossing as wide as the stream. The question is which ones to fix first when you can't afford all of them."

**0:30 Tour step 1, Upper French Broad**
> "This is the watershed around Asheville. Every dot is a culvert that field crews assessed as a barrier. The data comes from the national barrier inventory's public API. The blue lines are river networks we rebuilt from USGS high-resolution hydrography."

**0:50 Step 2, the comparison**
> "The usual way to prioritize is to score each culvert on its own and fund down the list. With $2M that reconnects 39.6 river miles, the brown rings. Our optimizer treats the river as a network and gets 46.6 for the same money."

**1:15 Step 3, Cherry Creek (the moment that matters)**
> "Here's why. Near Canton there are two culverts in a row on Cherry Creek. Alone, each opens only 1.4 miles, so ranking never picks them. Replace both, and 8.2 miles light up. With $1M in this watershed, that's 7.2 versus 12.6 river miles, 75% more."
>
> Click the lower culvert too if time allows. Mention Whiteoak Creek: two culverts that each score zero alone but open 9.6 miles together.

**1:40 Flyover (the wow moment).** End the tour on Cherry Creek, click the culvert, then **Fly to this culvert**. Let two or three scenes play: the 3D crossing, the flood cross-section where the road overtops, and the glowing river traced upstream. Then press Esc.

**1:50 Step 4, rivers vs. roads**
> "Now plan for roads too. A plan built only for washout risk gives up a third of the river benefit. A plan leaning 70/30 toward roads keeps 91% of the river gain and 94% of the washout reduction. Road and fish agencies mostly want the same culverts. If they plan separately, they leave value on the table."

**2:05 The action plan (the deliverable).** Click **Action plan**. Scroll the summary and the first project card: what to build, cost, miles, why it's in the plan, confidence and next steps. Mention **Print or save as PDF**. Then switch the watershed to **All of North Carolina** at $10M and open the plan again to show **Where the money goes**.
> "This is what an agency takes away: a ranked list of projects, each with what to build, what it costs, what it buys, why it's on the list and how sure we are, for one watershed or the whole state."

**2:20 Step 5, rigor**
> "Everything is checked. The optimizer is exact and matches brute force on 300 random networks. The browser version matches Python. Our rebuilt river networks reproduce the inventory's mileage within 5% for 88% of 405 culverts. Statewide, network planning beats ranking by about 2%. The big wins are in the chained mountain watersheds, the ones Helene hit. The tool shows you which case you're in."

**2:45 Close**
> "It runs entirely in the browser on public data. The inventory and the hydrography are national, so it works in any state."

## Likely questions

**Isn't this what the national barrier inventory's tool already does?**
That tool inventories barriers and ranks them one at a time. We use its data and its own gain definition, `min(upstream, downstream)`. We optimize sets of culverts under a budget, add road washout risk, and show where one-at-a-time ranking falls short. We also check against them: our networks, rebuilt from raw hydrography, reproduce their mileage.

**Hasn't barrier optimization been done before?**
Yes. O'Hanley & Tomberlin (2005) and King et al. (2017) optimize barrier removal. Our contribution:
- an exact optimizer on North Carolina's real inventory,
- running live in a browser,
- jointly with flood washout risk,
- with validation against the source data.

**Where do the costs come from?**
A planning-level model: stream-width span from NC regional bankfull curves, a per-foot price by road type, and mobilization. Real costs come from engineering. That's why there's a stress test: 60 random cost scenarios, and the card shows a cost range. Statewide, our plans won in 200 of 200 cost draws.

**Is the washout score validated?**
Not yet. It's a screening index (constriction × drainage size × road type), not a failure probability. Helene's damaged-culvert locations aren't public. Validating against them is the first thing we'd do with NCDOT data.

**Why is the statewide gain so small?**
Most assessed culverts aren't in chains. 483 of 569 trees are a single culvert, and there ranking by gain does nearly as well; the only gain left is packing the budget better. The big gains show up where culverts stack, mostly in the mountains.

**How exact is "exact"?**
- Chains where the cap can't bind use a tree dynamic program with two states per culvert. Chains where it can bind (44, at most 15 culverts) are enumerated.
- Trees are combined with max-plus convolution.
- Tests compare against brute force: 300/300 in Python and 200/200 in JavaScript.

**Why do 12% of rebuilt networks miss by more than 5%?**
Mostly waterfalls. The public download doesn't include them, so our networks run past them where the inventory's networks stop.

**What about unassessed crossings?**
Most NC crossings have never been surveyed. The natural next step is to rank which ones to survey next by how much they could change the plan.

**How did you use AI?**
Claude and GPT, for ideation, code and writing. The README has the full disclosure: the prompts, how we tested model-written code, and how every number is produced by a script from public data.
