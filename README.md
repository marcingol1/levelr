# Levelr — terrace pedestal planner

Plan a raised (ventilated) terrace on adjustable **RENOPAD PRO** pedestals and get an exact order list:
how many legs of each height, which pedestal model each one needs, expanders, acoustic pads and tiles.

## What it does

1. **Terrace & tiles** — enter the outer size, tile size (presets or custom, rotatable) and joint
   (2 mm by default, the RENOPAD PRO spacer). Cut tiles at the edges are detected and hatched.
2. **Supports per tile** — `Auto` picks a pattern from the tile size (corners for ≤ 60 cm, + long-edge
   mid-points for 60×120-type tiles, + centre for 80–90 cm squares, full grid for ≥ 100 cm).
3. **Levels** — define any number of leg heights (substrate → underside of tile). Add several at once
   (`70, 120, 20 cm`); a new level becomes the paint brush. Each level shows the pedestal it needs and
   how many legs use it. Click anywhere on a level (or press 1–9) to paint with it.
4. **Plan** — paint levels onto legs: click a leg; click near a tile's edge (that edge's legs) or corner
   (that leg); click a tile's centre (all its legs); or drag a box. Hovering previews which legs will
   change. One tile can stand on legs of different heights (e.g. 20 cm and 7 cm across a step).
   - **Shape** tool removes/restores tiles for L-shapes and cut-outs.
   - **Slope** tool drags a linear height gradient along the fall of a sloped substrate.
5. **Order list** — pedestals per model (with spare %), expanders, acoustic pads (packs of 10),
   optional slope correctors, tiles (full/cut), and a by-height breakdown. Copy as text or download CSV.

Projects auto-save in the browser, can be shared as a link (the whole plan is encoded in the URL),
and print cleanly (plan + order list). UI in English and Polish, units in cm or mm. The plan footer
shows the deployed commit.

## RENOPAD PRO model

| Item | Range / spec |
| --- | --- |
| RENOPAD PRO pedestals | 13–18, 18–23, 23–29, 29–47, 47–65, 65–119, 119–173, 173–300 mm |
| Ekspander 50 / 100 mm | fitted to the 173–300 mm pedestal, max two per leg → up to 500 mm |
| Nakładka wygłuszająca (acoustic pad) | 2 mm, one per leg; pedestal height is reduced by 2 mm (toggle) |
| Korektor spadku 0–5% | optional, one per leg |

For each height the pedestal with the **most adjustment room in both directions** is chosen, so there is
still room to fine-tune on site; heights at the very end of a range and out-of-range heights are flagged.
The catalogue lives in `src/lib/catalog.ts`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for layout, pedestal selection, units and the order list
npm run build      # type-check + production build into dist/
```

## Deploy to Vercel

A static Vite app — no server, no environment variables, no overrides.

- **Dashboard:** import the repository at [vercel.com/new](https://vercel.com/new); the **Vite** preset is
  detected (`npm run build`, output `dist`). `vercel.json` pins the same settings. Keep the default Node.js
  version (22.x).
- **CLI:** `npx vercel` (preview) or `npx vercel --prod`.
- Set the project's production branch to `main`.

## Structure

```
src/lib/catalog.ts    RENOPAD PRO ranges, expanders, accessories, pedestal picking
src/lib/layout.ts     tile grid → support lattice (legs), pattern rules, remapping on resize
src/lib/summary.ts    bill of materials, by-height breakdown, issues
src/state/project.ts  project model, reducer with undo/redo, sanitising of loaded data
src/components/       Setup, Plan (SVG editor), Levels, Order list, Header
```
