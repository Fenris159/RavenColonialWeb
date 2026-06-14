# Code Review Guide

This guide is for reviewing the current RavenColonialWeb economy/SystemView branch against `main`. It is organized by risk area so reviewers can separate model behavior, UI behavior, and review-only diagnostics.

## Branch Highlights

- Economy code was moved into `src/economy/` with clearer module boundaries for system assembly, per-site calculation, agriculture, weak links, facilities, and Spansh compare helpers.
- System primary port remains backend-compatible: it is inferred from `system.sites[0]`; no persisted `primaryPortId` schema field is introduced.
- Order for Calculations is now informational and grouped by body. Drag/drop ordering was removed; changing the system primary port is an explicit picker action that moves the selected site to row 0 on save.
- Tier-point math is decoupled from visual row order by using a canonical tax order.
- Bad imported rows are forced below a `BROKEN BELOW` line and excluded from calculations.
- Spansh compare remains UI-only, with same-body market inversion hints and an Auto re-order markets action for those hints only.
- System development buff/nerf experimental UI was removed from the main System Stats panel; the commander setting remains as a developer/testing override.
- The About page now includes an in-app Economy Guide that mirrors the user-facing economy guide content and uses site-native styling.
- Site detail and Order/Audit-adjacent panels received layout fixes for internal scrolling, bottom-banner clearance, and avoiding unnecessary horizontal scrollbars.
- Feedback/report flows were fixed so economy/audit report links open an interactive feedback modal over existing panels, and pasted/dropped/selected images are included in submissions.

## 1. Model Boundaries

Recommended files:

- `src/economy/system-model2.ts`
- `src/economy/economy-model2.ts`
- `src/economy/economy-core.ts`
- `src/economy/economy-documented.ts`
- `src/economy/site-calc-exclusions.ts`
- `src/economy/README.md`
- `docs/economy-model.md`

Review focus:

- `buildSystemModel2` remains the source of truth for calculated system output.
- React views render model output and UI state; they should not duplicate economy or tier-point rules.
- `calcIds` is the inclusion boundary for economies, links, tier gives, effects, and unlocks.
- No backend schema change is required for primary port, inversion state, or buff/nerf behavior.

## 2. Primary Port And Body Primaries

Recommended files:

- `src/economy/system-model2.ts`
- `src/views/SystemView2/BuildOrder.tsx`
- `src/views/SystemView2/build-order-sort.ts`
- `src/views/SystemView2/SystemView2.tsx`
- `src/views/SystemView2/SystemCard.tsx`

Important behavior:

- System primary port is inferred from `system.sites[0]`.
- `buildSystemModel2` copies that inferred id into runtime-only `sysMap.primaryPortId`.
- If `sites[0]` is invalid, the runtime model falls back to the first valid complete starport/outpost, then to `sites[0]`.
- Saving a changed primary port moves the selected eligible port to `system.sites[0]`.
- `SystemCard` strips runtime-only `primaryPortId` before save.
- Body market-link primaries are computed from eligible calculated sites on each body, not from a new persisted field.
- User-facing docs and Order panel copy describe primary-port changes as correction of the first port the game had the user build, not as normal customization.

Review focus:

- Confirm no `primaryPortId` is sent to the backend.
- Confirm saved primary port survives reload because it occupies `system.sites[0]`.
- Confirm Order panel preview math uses the current displayed row order after a primary-port change.
- Confirm body primary icons and market-link icons track model-derived body primaries.

## 3. Calculation Inclusion And Forced Exclusions

Recommended files:

- `src/economy/site-calc-exclusions.ts`
- `src/economy/system-model2.ts`
- `src/views/SystemView2/build-order-sort.ts`
- `src/views/SystemView2/BuildOrder.tsx`

Important behavior:

- Completed-only mode includes complete sites only.
- Use all Sites includes non-demolished sites up to `idxCalcLimit`.
- Unknown body, unknown/null build type, and positive single-digit `marketId` values (`1` through `9`) are excluded regardless of status.
- Placeholder `marketId: 0` is not a forced exclusion by itself.
- Excluded rows are displayed below `BROKEN BELOW` so users can identify bad import data.
- Valid planned/building rows must remain below `CUT LINE` but above `BROKEN BELOW` in completed-only mode.

Review focus:

- Confirm excluded rows do not enter `calcIds`.
- Confirm excluded rows remain below the cut line on initial page load, not only after toggling modes.
- Confirm excluded complete sites do not affect tier points, economies, links, system effects, or unlocks.
- Confirm valid planned asteroid starports with placeholder `marketId: 0` do not appear below `BROKEN BELOW`.

## 4. Order For Calculations UI

Recommended files:

- `src/views/SystemView2/BuildOrder.tsx`
- `src/views/SystemView2/build-order-sort.ts`
- `src/views/SystemView2/SystemView2.tsx`

Important behavior:

- The panel groups rows by body for readability.
- Rows are not draggable.
- `Completed sites only` and `Use all Sites` mirror the main SystemView toggle.
- Use all Sites places non-planned sites first, then planned sites, while preserving body grouping inside each section.
- Group by body preserves the active cut line.
- A primary-port picker appears over the panel and is populated by eligible orbital ports with landing pads, including orbital outposts.
- The primary-port picker copy presents the action as correcting Raven Colonial's first-port record.
- Selecting a new primary port immediately regroups the preview before `Okay` is pressed.

Review focus:

- Confirm initial panel state matches the main page toggle.
- Confirm clicking mode buttons in either place updates the same `useIncomplete` state.
- Confirm `Okay` rebuilds using the panel-selected mode and order.
- Confirm the primary-port picker does not close the parent panel when interacted with.
- Confirm the table has no unnecessary horizontal scrollbar.
- Confirm the primary-port body group moves immediately after a picker selection, before final save.

## 5. Tier Point Tax Calculation

Recommended file:

- `src/economy/system-model2.ts`

Important behavior:

- Tier-point totals use canonical tax order, not visual order.
- The system primary port is skipped for tier needs.
- Taxed starports sort by site tier descending, body order, orbital before surface, `marketId`, then name/id.
- The tax amount still uses `site.type.tier`, matching deployed behavior.
- Planned-site insufficient-point warnings are UI warnings only.

Review focus:

- Confirm visual grouping does not change `tierPoints`.
- Confirm `calcNeeds` is cleared and rebuilt every pass.
- Confirm completed-only vs Use all Sites respects `calcIds` and status.
- Confirm red insufficient-point warnings appear only for planned sites, not complete/building sites.
- Confirm HIP 52675 completed-only reference remains `Tier 2 = 0`, `Tier 3 = +12`.

## 6. System Development Buff/Nerf

Recommended files:

- `src/economy/system-model2.ts`
- `src/views/SystemView2/SystemStats.tsx`
- `src/components/ModalCommander.tsx`
- `src/views/ProjectView/ProjectView.tsx`

Important behavior:

- The public System Stats experimental checkbox was removed.
- The commander settings checkbox remains as a developer/testing override.
- The UI label is `Apply system development buff/nerf model`.
- Primary-port buffing follows `sysMap.primaryPortId`, derived from `system.sites[0]`.

Review focus:

- Confirm ProjectView and SystemView interpret `noBuffNerf` consistently.
- Confirm disabling the override is only an old-model comparison path.
- Confirm no backend schema change was added.

## 7. Economy Link Graph And Per-Site Pipeline

Recommended files:

- `src/economy/system-model2.ts`
- `src/economy/economy-model2.ts`
- `src/economy/economy-documented.ts`
- `src/economy/economy-link-sources.ts`
- `src/economy/economy-weak-links.ts`

Important behavior:

- Body primaries and subordinate links are assigned before link pools are built.
- Economy-capable sources are calculated on demand so `primaryEconomy` is available.
- Economy calculation state guards against cyclic pre-calculation.
- Stabilization reruns economy/link summaries until output stops changing or the pass limit is reached.
- Parent-hub sub-strong extra contribution is intentionally disabled for current observed-data parity.

Review focus:

- Confirm `calcIds` is respected during link graph construction and calculation.
- Confirm flattened hub grandchildren do not double-count.
- Confirm gas-giant cluster farms strong-link only the body primary.
- Confirm relay/security/medical/farm weak-link rules remain isolated in economy weak-link modules.

## 8. Agriculture And Facility Rules

Recommended files:

- `src/economy/economy-ag-modifiers.ts`
- `src/economy/economy-ag-heuristics.ts`
- `src/economy/economy-facility-registry.ts`
- `src/economy/economy-facilities.ts`

Important behavior:

- Terraformable agriculture is controlled by `enableTerraformableAgricultureBonus`.
- Historical agriculture weak-link budget rule matching is disabled for live calculations.
- Only the tidal orbital cluster agriculture weak-link cap remains active.
- Settlement fixed economy is currently `1.0`.
- `athena` can be 100% or 140% High Tech depending on qualifying comms.
- Facility High Tech rows skip BIO/GEO own-row High Tech buffs.

Review focus:

- Confirm old fitted AG budget constants are not accidentally wired back into live calculations.
- Confirm `explainAgricultureWeakLinkBudget` remains diagnostic-only.
- Confirm facility registry entries match intended link-only, fixed, or `athenaComms` behavior.
- Confirm link-only facilities do not create market economies.

## 9. Spansh Compare And Inversion Hints

Recommended files:

- `src/economy/compare/spansh-economy-resolve.ts`
- `src/economy/compare/spansh-compare-reliability.ts`
- `src/economy/compare/spansh-inversion-detect.ts`
- `src/views/SystemView2/AuditTestWholeSystem.tsx`
- `src/views/SystemView2/BuildOrder.tsx`
- `src/views/SystemView2/EconomyTable2.tsx`

Important behavior:

- Spansh compare is UI-only and must not feed `buildSystemModel2`.
- Compare resolution tries RC/journal `marketId` first, then EDSM name matching.
- No-pad facilities are excluded from hard compare and treated as limited reliability.
- Same-body inversion hints are derived state and are not persisted.
- Auto re-order markets applies current inversion swaps only; it does not run a general regroup.

Review focus:

- Confirm hints disappear when current model/data no longer indicates inversion.
- Confirm hover text names the swap partner and confidence.
- Confirm excluded or informational Spansh rows do not create hard warnings.
- Confirm feedback/report links still open the feedback modal over audit panels.

## 10. UI Icons, Panels, And Feedback

Recommended files:

- `src/views/SystemView2/BuildOrder.tsx`
- `src/views/SystemView2/AuditTestWholeSystem.tsx`
- `src/views/About.tsx`
- `src/views/AboutEconomyGuide.tsx`
- `src/views/SystemView2/ViewSite.tsx`
- `src/views/SystemView2/SystemView2.tsx`
- `src/components/ShareFeedback.tsx`
- `src/views/SystemView2/EconomyTable2.tsx`

Important behavior:

- Primary port, primary market-link, planned/building/demolished, and inversion icons appear inline after site text.
- Site details panels scroll internally below the top detail section and should not run behind the bottom site banner.
- Large site detail/economy panels should keep their header/details visible while long economy/link/effect sections scroll within the available viewport.
- Feedback supports pasted/dropped/selected image attachments as base64 data URLs.
- Feedback submission sends those image data URLs with the rest of the feedback payload.
- Feedback/report links from economy tables and audit disclaimers should open the shared feedback modal without requiring the audit panel to close first.
- The Audit button near economy ratios is styled as a small clickable button.
- About navigation includes an `Economy Guide` topic.
- The in-app Economy Guide uses the same content flow as `docs/economy-model-guide.md`: big-picture flow, term tables, economy helpers, calculation inclusion, Agriculture, tier points, Spansh compare, and quick answers.
- The Economy Guide avoids backend schema wording in user-facing text. The system primary port is described as the first port the game has the user build.

Review focus:

- Confirm icons fit row height and do not overlap text.
- Confirm scrollbars appear only where useful, with no horizontal scrollbar in normal panel layouts.
- Confirm feedback modal interaction does not freeze the page or close parent panels unexpectedly.
- Confirm feedback can be opened from the audit compare disclaimer and from economy-table report links, typed into, cancelled, and submitted.
- Confirm pasted/dropped/selected image attachments render in the feedback modal and remain part of the submission payload.
- Confirm site detail panels with long Economy Ratios, Market Links, and System Effects content scroll inside the panel rather than behind the bottom site banner.
- Confirm the Economy Guide is readable in light and dark themes; the flow diagram accent colors should not be eye-searing in blue/green light themes.
- Confirm JSX inline text around bold/code/link elements renders with spaces, especially phrases like `2.25 in the data`, `Auto re-order markets applies`, and `Terraformable Agri Bonuses button`.

## 11. Repo Hygiene And Docs

Recommended files:

- `.gitignore`
- `package.json`
- `yarn.lock`
- `docs/economy-model.md`
- `docs/economy-model-guide.md`
- `src/economy/README.md`
- `src/views/AboutEconomyGuide.tsx`

Important behavior:

- The repo remains Yarn-only; `package-lock.json` should not be tracked.
- `.vscode/` should not be tracked.
- Generated docs artifacts (`.pdf`, `.print.html`) belong outside tracked live folders.
- Runtime docs in `docs/` should describe current behavior, not old hypotheses or branch-development history.
- The user-facing economy guide should avoid backend storage terms unless they are necessary for reviewers/developers.
- Local-only tests and diagnostics belong under `local/` and are not part of deployment.

Review focus:

- Confirm `package.json` and `yarn.lock` match intentional dependency changes only.
- Confirm no local-only files or generated artifacts are staged in tracked folders.
- Confirm docs do not claim disabled AG budget rules, draggable ordering, or `npm run test:economy` as live behavior.
- Confirm `docs/economy-model-guide.md` and the in-app About Economy Guide remain aligned at the behavior level.

## 12. Suggested Review Order

1. Review `system-model2.ts` primary-port, forced-exclusion, tier-point, system-effect, and link-graph behavior.
2. Review `BuildOrder.tsx` and `build-order-sort.ts` grouping, cut lines, mode mirroring, icons, and primary-port picker.
3. Review Spansh compare/inversion code as UI-only derived state.
4. Review panel/modal UI fixes: site detail scrolling, feedback modal interaction, image attachments, audit disclaimer report links, and horizontal scrollbar regressions.
5. Review SystemView and commander setting changes for buff/nerf behavior.
6. Review agriculture and facility modules after the model invariants are clear.
7. Review docs and repo hygiene last.
8. Review the in-app About Economy Guide after docs to confirm the user-facing wording and visual treatment match.

## 13. Suggested Test Plan

Tracked repo checks:

```powershell
npm run build
git diff --check
```

Expected notes:

- `npm run build` may print the existing CRA/Node `fs.F_OK` deprecation warning.
- On Windows, `git diff --check` may print LF-to-CRLF notices for touched files while still exiting successfully.
- Local-only regression/fixture tests live under `local/economy/tests/` and are not part of the tracked package scripts.

## 14. High-Value Manual Smoke Checks

- Open `HIP 52675` and confirm completed-only tier points match the live reference: `Tier 2 = 0`, `Tier 3 = +12`.
- Open Order for Calculations in completed-only mode and confirm only completed valid sites are above the cut line.
- Switch to Use all Sites and confirm building sites appear before planned sites, with planned sites grouped last.
- Confirm invalid imported rows appear below `BROKEN BELOW` and do not affect totals.
- Change the primary port through the picker, save, reload, and confirm the selected site remains `system.sites[0]`.
- Run whole-system Spansh compare and confirm possible inversion arrows show only as derived hints.
- Press Auto re-order markets and confirm it applies only the hinted inversion swaps.
- Hover an inversion arrow and confirm the reason names the partner and confidence.
- Confirm System Stats no longer shows the old experimental buff/nerf checkbox.
- In commander settings, confirm the buff/nerf checkbox reads as a developer/testing override.
- Open a site detail panel with many economy rows and confirm the body of the panel scrolls without overlapping the bottom banner.
- Open the audit compare panel, click the report-errors link, and confirm the feedback modal opens over the audit panel and remains interactive.
- Paste or drop an image into feedback and confirm it previews before submission/cancel.
- Open `/#about=economy` and confirm the Economy Guide button/page renders, the flow diagram is readable in the active theme, and user-facing primary-port wording does not expose `system.sites[0]`.
