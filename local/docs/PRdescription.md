## Summary

This PR reorganizes the colonization economy model into a dedicated `src/economy/` module and updates the model used by the planning UI to produce more accurate economy estimates and link graphs for build-site planning.

The main goal is to keep the existing site behavior intact while making the economy rules easier to audit, test, and tune. Economy math, link-source discovery, weak-link filtering, facility intrinsics, agriculture heuristics, and Spansh comparison helpers now live behind clearer module boundaries instead of being concentrated in the old top-level economy files.

## What changed

- Moves economy and system-model code into `src/economy/`, with `src/economy/index.ts` as the public import surface for the rest of the app.
- Splits the model into focused modules:
  - `system-model2.ts` for system build orchestration, body primaries, site links, tier points, unlocks, and construction validation.
  - `economy-model2.ts`, `economy-documented.ts`, and `economy-core.ts` for per-site economy calculation and audit output.
  - `economy-ag-modifiers.ts` and `economy-ag-heuristics.ts` for agriculture-specific modifiers, floors, budgets, and observed preset behavior.
  - `economy-link-sources.ts` and `economy-weak-links.ts` for strong/weak link graph rules.
  - `economy-facility-registry.ts` and `economy-facilities.ts` for hub/installation economy rows.
  - `compare/` helpers for UI-only Spansh/EDSM row matching and comparison caveats.
- Updates app imports so SystemView, ProjectView, market links, build effects, body cards, build order, unlocks, and economy tables read from the new economy module layout.
- Adds economy documentation under `docs/` and `src/economy/README.md` so future changes have a map of rule ownership and UI integration points.

## Economy model improvements

- Improves agriculture scoring across body intrinsics, BIO/TIDAL/ICY/terraformable modifiers, settlement floors, fixed-port inheritance, and weak-link budgets.
- Adds a SystemView what-if toggle for terraformable agriculture bonuses. It is off by default, persists in local storage, rebuilds the current system model immediately, and lets planners preview numbers for a future Elite Dangerous fix where terraformable agriculture bonuses apply correctly.
- Wires the terraformable option through both agriculture paths it should affect: own-row agriculture body buffs and agriculture strong-link contribution formulas. BodyCard previews use the same option so the visible page stays internally consistent.
- Improves strong-link and weak-link handling for colony ports, same-body surface/orbital relationships, hub grandchildren, gas-giant cluster farms, relay/security facilities, subordinate ports, and agriculture-only weak-link cases.
- Refines hightech weak-link support: relay application no longer depends on alphabetic source order, and medical hightech installations can contribute hightech weak support.
- Adds a facility economy registry so hubs and installations have explicit link-only, fixed-intrinsic, or Athena hightech behavior instead of scattered special cases.
- Fixes tourism buff handling so neutron-star systems apply the neutron-star tourism bonus independently from black holes.
- Adds economy calculation state tracking for link-source pre-calculation. This prevents cyclic colony dependency passes from producing false `primaryEconomy` warnings while keeping the final modeled values unchanged.
- Adds bounded economy stabilization after all source primaries are established, so the `buildSystemModel2` result matches a manual site recalculation for cross-body weak-link dependency cases.
- Keeps economy audit output readable, including clearer labels for uncapped agriculture weak-link budgets.

## Spansh comparison and UI behavior

- Adds Spansh comparison reliability helpers so the UI can distinguish meaningful dockable comparisons from limited or excluded rows.
- Adds station-name and market-id resolution helpers for matching RC sites against Spansh/EDSM data.
- Adds a visible Spansh comparison caveat component for cases where external data should not be treated as authoritative.
- Updates SystemView refresh behavior so forced Spansh compare failures clear loading state instead of leaving the UI stuck.
- Keeps Spansh comparison out of the economy calculation pipeline; it is only used after model calculation for display and validation.

## Documentation and cleanup

- Adds production economy-model documentation and a plain-language guide.
- Adds a `src/economy/README.md` describing module ownership and how the rest of the site uses the economy package.
- Removes committed Visual Studio workspace files.
- Removes the stale top-level economy-model file in favor of the dedicated `src/economy/` folder.
- Adds a tracked economy regression test file and an `npm run test:economy` script that only targets tracked economy tests.

## Test plan

- [x] `npm test -- --watchAll=false`
- [x] `npm run test:economy -- --runInBand`
- [x] `npm run build`
- [x] `git diff --check`

Notes:

- Tracked regression coverage includes the neutron-star tourism buff fix, uncapped agriculture weak-link audit label, terraformable own-row agriculture buff behavior, terraformable agriculture strong-link behavior, and hightech relay/medical weak-link behavior.
- The production build still emits the existing CRA/Node `fs.F_OK` deprecation warning from the toolchain; the build completes successfully.
- `git diff --check` passes; Git may still report LF-to-CRLF notices for touched files on Windows.
