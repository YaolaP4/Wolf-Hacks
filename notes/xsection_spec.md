Write ONE self-contained JavaScript ES module named `xsection.js` for a web app. Return ONLY the file contents in a single ```js code block. No explanation, no other files, and no tools needed.

## What it draws
An animated SVG cross-section of a road crossing a mountain stream, as seen standing in the stream looking at the road embankment. Two variants:
- `existing`: an undersized culvert (a round pipe) through a road embankment.
- `fixed`: a stream-width open-bottom box/arch crossing as wide as the stream channel plus a margin, with a natural streambed running through it.

The water animates through flood stages. In `existing`, as flow rises the water passes through the pipe at low flow. At high flow it stacks up against the embankment upstream (the water surface rises well above the pipe crown). At the highest stage it overtops the road, shown as a thin sheet of water spilling over the road surface with a few animated spray/flow streaks, while the road surface turns to a "washout" look (a jagged notch eroding into the embankment edge). In `fixed`, the same flood stages pass under the deck with freeboard, and the road stays intact.

## API
```js
export function crossSection(container, opts) // returns a controller
// container: an HTMLElement; the module creates an <svg viewBox="0 0 640 300"> that fills its width.
// opts = {
//   variant: "existing" | "fixed",
//   ratio: number,          // crossing width / stream bankfull width. existing: 0.2-1.0; fixed: about 1.3
//   bankfullFt: number,     // estimated stream bankfull width in feet (for the dimension label)
//   roadLabel: string,      // e.g. "Fs 5095 (unpaved)"
//   colors: { water, waterDeep, ink, muted, road, soil, accent, paper } // CSS color strings
// }
// controller = {
//   flood(level, ms),   // animate water to level 0..1 over ms milliseconds (0 = normal flow, 0.6 = big storm, 1 = Helene-scale)
//   setVariant(v, ratio),  // redraw as "existing" or "fixed" without recreating
//   destroy(),
// }
```

## Drawing details
- Use a `viewBox="0 0 640 300"`. Valley sides are soft trapezoid hillslopes in `colors.soil`, darker toward the bottom. The stream channel is a smaller trapezoid notch at the bottom center.
- The road embankment spans the full width, from y about 120 to 210. Draw it in a slightly lighter soil tone, with the road surface as a 10px band on top in `colors.road` and a dashed center line. Put the `roadLabel` text above the road on the right.
- **Existing pipe:** a circle centered in the channel. Its diameter in px equals `ratio × channelPx`, where `channelPx` is about 220 and stands for bankfull width. Draw a dark interior, a thin rim, and corrugation hint lines.
- **Fixed crossing:** a rectangular opening about 1.3 × `channelPx` wide and tall enough for full stage, with a thin concrete edge and a natural bed (small stones as circles) inside.
- **Water:** a polygon filling the channel up to the current water surface y, in `colors.water` with a lighter top highlight line that moves gently (a sine-wave surface, animated continuously with requestAnimationFrame). Water inside and behind the pipe is visible through the opening.
- **Stage mapping:** normal flow means the water is a thin band in the channel bottom. In `existing`, level 0.6 puts the surface above the pipe crown, against the embankment face. Level 1.0 puts it above the road (overtopping). In `fixed`, the surface stays below the deck at all levels.
- **Labels** (12px, `colors.ink`/`colors.muted`, system font):
  - A dimension line with arrows under the channel: `Stream ≈ {bankfullFt} ft wide`.
  - A second dimension line across the opening: `Opening ≈ {Math.round(ratio*bankfullFt)} ft`.
  - Bottom-left small muted note: "Illustration, not to scale".
  - A stage label top-left that updates with the level: "Normal flow" (<0.2), "Storm flow" (0.2–0.75), "Helene-scale flood" (>0.75).
  - In `existing` when overtopping: a short label "Road overtops" near the spill in `colors.accent`. In `fixed` at high stages: "Flood passes under" in `colors.water`.
- Smooth transitions: interpolate the water level with easing (easeInOutCubic) over `ms`.
- If `matchMedia('(prefers-reduced-motion: reduce)')` matches, jump straight to the target and do not animate the surface wave.
- Clean, modern, flat illustration style. No gradients heavier than two stops, and no external assets.
- Keep it under about 260 lines. No dependencies. Must run in current Chrome/Edge as `<script type="module">`.
