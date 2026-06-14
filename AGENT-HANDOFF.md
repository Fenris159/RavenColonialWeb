# Agent handoff — Raven Colonial economy (agriculture weak links)

**Date:** 2026-05-30  
**Branch:** use current working tree (commit pending when this file was written)

## What was completed

### 1. Hypothesis test (exclusive linking vs port budgets)

- Added `src/dev/economy/ag-hypothesis-models.ts` and `src/dev/economy/verify-hr4464-hypothesis.test.ts`.
- **Conclusion:** Spansh agriculture on HR 4464 is explained much better by **per-port weak-link budgets** than by exclusive facility assignment. Exclusive models scored 0/24 exact matches and ~117% MAE; port-budget models ~43% MAE.
- Run: `npx react-scripts test --watchAll=false --testPathPattern=verify-hr4464-hypothesis`

### 2. Production wiring (port-budget v2)

Implemented in `src/economy-ag-heuristics.ts`:

| Mechanism | Purpose |
|-----------|---------|
| `AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE` | Fixed budgets: hestia/poseidon/apollo → 160%, chronos → 140%, clotho → 125% |
| `AG_WEAK_LINK_ORBITAL_CLUSTER_BUILD_TYPES` | plutus, vulcan, prometheus on **orbital** colony ports |
| `getOrbitalClusterAgWeakLinkBudget()` | 0 strong subs → 90%; 1–2 subs → 140%; 3+ subs → 115% |

**Important:** HR 4464 “Recycles / Rusty / Marvelous” are all **plutus**; budgets differ only by `links.strongSites.length`, not buildType alone.

The DEFAULT 90% rule no longer applies when a buildType or orbital-cluster rule matches (fixes `Math.min` pulling 90% under higher caps).

### 3. Other recent work (already in tree)

- Weak-link caps as **percent budgets** (`AG_WEAK_LINK_BUDGET`, `weakLinkBudgetToMaxSources`).
- Skipped weak-link audit lines (`noteSkippedWeakLink`, grey UI in `EconomyTable2`).
- Optional `Site.weakLinkIds` filter in `calcSiteLinks` when save provides linked facility IDs.
- HR 4464 diagnostics: `src/dev/economy/verify-hr4464.test.ts`.

### 4. Tests updated

- `economy-model2.test.ts` — plutus orbital sub tiers (18 vs 23 weak links).
- `verify-hr4464.test.ts` — Recycles 115%, Marvelous 140%, Rusty 90%.
- `docs/economy-model.md` — link graph vs budget section refreshed.

## Verified locally

```bash
npx react-scripts test --watchAll=false --testPathPattern="economy-model2|verify-hr4464"
npx react-scripts test --watchAll=false --testPathPattern=verify-hr4464-hypothesis
```

Cached HR 4464 data: `%TEMP%/hr4464-sys.json`, `%TEMP%/hr4464-spansh.json` (system id `18494801076`).

## Known remaining gaps

1. **Roughly Reinforced** (hestia, surface): model ~135% vs Spansh 160% — likely **foreign-star agriculture weak-link limit** (27 eligible vs 32 implied), not budget cap. See `shouldApplyForeignStarAgricultureWeakLink` in `economy-ag-heuristics.ts`.
2. **Ninjs** and other HR 4464 ports — still off by a few %; survey output in `verify-hr4464.test.ts` “mismatch survey” test.
3. **Pre-existing verify failures** (may need cache): `verify-wredguia-agri`, `verify-synuefe-agri`, `verify-spansh-agri`.
4. **Player-linked subset** — API v6 save has no per-port weak link list; `weakLinkIds` on `Site` is optional for future saves. Spansh totals may reflect in-game linked count, not full candidate pool.
5. **Link graph bar** (`MarketLinks.tsx`, 62/8) — display only; do not use for economy tuning.
6. **Spansh verify** — only compare sites with operational journal `marketId` (> 4_200_000_000). Construction colonies use placeholder marketIds and must be omitted (`spansh-verify-utils.ts`).

## Suggested next steps for cloud agent

1. Tune foreign-star rule for surface starports (hestia) or confirm in-game behavior on HR 4464 body 99.
2. Extend `AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE` using more verify systems (`verify-lupus`, `verify-pleiades`, etc.) — fetch/cache under `os.tmpdir()` as in other verify tests.
3. If architect save gains weak link IDs, wire `weakLinkIds` through import and prefer linked subset over full pool when present.
4. Re-run full economy verify suite after changes:
   ```bash
   npx react-scripts test --watchAll=false src/dev/economy
   ```

## Key files

| File | Role |
|------|------|
| `src/economy-ag-heuristics.ts` | Production weak-link budgets |
| `src/economy-documented.ts` | `applyWeakLinks`, skipped audit |
| `src/system-model2.ts` | Link graph, `weakLinkIds` filter |
| `src/dev/economy/ag-hypothesis-models.ts` | Hypothesis simulator (dev only) |
| `src/dev/economy/verify-hr4464-hypothesis.test.ts` | A/B scoring |
| `src/dev/economy/verify-hr4464.test.ts` | HR 4464 regression |
| `docs/economy-model.md` | Architecture notes |

## Git / commit notes

- Do **not** add `Co-authored-by: Cursor` trailers (repo rule).
- Author commits as **Fenris159** / `drew.brdly78@gmail.com` per existing history.
