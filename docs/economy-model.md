# Economy model (production)

How colonization economy percentages are calculated in `src/`. The UI shows per-port strengths; Spansh is the external reference where stations are complete.

**Entry point:** `economy-model2.ts` (public re-exports).

**System build:** `buildSystemModel2` in `system-model2.ts` assigns body primaries, strong/weak link lists, then runs `calculateColonyEconomies2` (ports/settlements) and `calculateFacilityEconomies2` (hubs/installations).

---

## Which sites are included

`calcIds` is built in `initializeSysMap`:

| UI mode | `calcIds` |
|---------|-----------|
| Completed only (default) | `status === 'complete'` |
| Include incomplete (beaker) | Non-demolished sites up to build-order `idxCalcLimit` (`plan`, `build`, `complete`) |

Economy, link graph, tier gives, and system unlocks all respect `calcIds`. Incomplete mode is for **planning**; Spansh comparisons should use completed-only.

---

## Hubs and installations

| Role | Behavior |
|------|----------|
| **Economy-bearing hub** (`type.inf` set) | Fixed intrinsic via [`economy-facility-registry.ts`](../src/economy-facility-registry.ts) + [`economy-facilities.ts`](../src/economy-facilities.ts). No strong/weak math on the hub row itself. Body BIO/GEO hightech buffs do not apply (`skipHightechBodyBuffs`). |
| **athena** | 100% hightech default; **140%** when **comms** (`aletheia` / `pistis` / `soter`) is complete on the host body or any **ancestor** body (walk `body.parents`, e.g. gas giant or star). Qualifying `marketId`: journal operational (≥ 4_200_000_001) or player-made prefix (395–397, 42, 43). **Exception:** athena on **HMC** whose parent is a **star** stays 100% even with comms. Plan/build comms in `calcIds` counts for incomplete preview. |
| **Link-only** (`type.inf === none`, e.g. `aletheia`) | No economy row; subordinate under body primary; unlocks hub intrinsics / port strong links. |
| **Weak-link sources** | Ports, settlements, subordinate hubs — not installations. |

Registry table: `FACILITY_ECONOMY_REGISTRY` in `economy-facility-registry.ts` (`linkOnly`, `fixed`, `athenaComms`).

---

## Module map

| File | Purpose |
|------|---------|
| `economy-facility-registry.ts` | Per–build-type facility intrinsics |
| `economy-facilities.ts` | `calculateFacilityEconomies2` |
| `economy-model2.ts` | Pipeline + public API |
| `economy-core.ts` | `adjust`, constants, agriculture calc flags |
| `economy-documented.ts` | Body intrinsics, buffs, strong/weak links |
| `economy-ag-modifiers.ts` | ±0.4 agriculture modifier table |
| `economy-ag-heuristics.ts` | Spansh alignment caps/floors (not in community sheet) |
| `economy-weak-links.ts` | Who counts as a weak-link source |
| `system-model2.ts` | Link graph + `buildSystemModel2` |

---

## Calculation pipeline

`calculateColonyEconomies2(site, calcIds, options)`:

1. Reset audit / agriculture flags
2. **Settlements** — fixed intrinsic + buffs
3. **Specialized ports** (`type.fixed`) — 0.5 surface / 1.0 orbital + buffs
4. **Colony ports** — `applyBodyType` → `applyBuffs` → `applyObservedPresetEconomies` (heuristic)
5. **Links** (if `site.links`): `applyStrongLinks2` → `applyWeakLinks` → agriculture floors (heuristic)
6. Finish — `primaryEconomy`, sorted `economies`

Link lists are built earlier: `calcBodyLinks`, `assignBodySubordinateLinks`, then `shareColonyLinkPoolFromPrimary` for non-primary ports on a body:

- **Colony ports** (non-fixed intrinsic) — shared weak-link pool from the body primary.
- **Fixed specialized outposts** (`bia`, `fauna`, `vulcan`, …) — same weak pool **and** strong-link sources from surface + orbital primaries (after both link graphs exist), so linked economies appear in `site.economies` instead of staying at 0%.

---

## Documented vs heuristic

**Documented** (`economy-documented.ts`, `economy-ag-modifiers.ts`, `economy-weak-links.ts`, `economy-link-sources.ts`): community sheet rules — body intrinsics, buffs, strong tiers (0.4 / 0.8 / 1.2), weak +0.05 steps, subordinate-only weak links for tiered starports. **Sub-strong** passes use the parent link economy (`subLink`), not the subordinate’s `type.inf`, and never apply a site to itself. **Parent hub sub-strong:** fixed/shared-pool ports subordinate to an economy-bearing hub (e.g. `bia` under athena) receive a **parent hub tier** sub-strong (T2 → 0.8) from `parentLink` after top-level strong links — not the subordinate port’s tier. **Link graph extensions** (`economy-link-sources.ts`, `calcSiteLinks`): body primaries list **same-body** subordinate candidates in `sameBodyWeakSites` (agriculture weak links only at apply time); cross-body candidates stay in `weakSites`. **Gas-giant cluster** `demeter` / `picumnus` on sibling moons are **strong** agriculture sources for the **body primary port only** (orbital primary when both orbital and surface primaries exist). **Subordinate** colony ports (e.g. hub outposts) share the primary’s weak pool but do **not** receive cluster farm strong links — agriculture arrives via weak +5% steps only. **Atmosphere** affects build-slot prediction only; agriculture body modifiers use **`bio` (organics)**, not atmosphere (per colonization guides).

**Heuristic** (`economy-ag-heuristics.ts`): empirical Spansh fit — weak-link **budgets** (percent → max +5% steps), agriculture floors, preset colonies, foreign-star filters. Prefer documented modules unless regression requires a heuristic.

---

## Agriculture structure

| File | Role |
|------|------|
| `economy-ag-modifiers.ts` | What modifiers apply |
| `economy-documented.ts` | When (body buff vs strong link) |
| `economy-ag-heuristics.ts` | Weak-link budgets and caps |

`site.agEconomyCalc` flags (`economy-core.ts`) drive cap logic without parsing audit strings.

Per-port weak-link budgets use `AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE` and orbital cluster rules; the link graph still lists system candidates — budgets limit how many weak links **apply**.

---

## Options (UI)

```typescript
interface EconomyModelOptions {
  enableTerraformableAgricultureBonus?: boolean; // default false
}
```

From `SystemView2` → `buildSystemModel2`. Persisted as `terraformableAgriBonus` in local storage.

---

## Link graph vs economy math

| Concept | Where |
|---------|--------|
| Candidate pools | `site.links.strongSites` / `weakSites` in `calcSiteLinks` |
| Link graph bar (UI) | `MarketLinks.tsx` — display only |
| Weak-link application | `applyWeakLinks` — sorted until agriculture budget exhausted |
| Optional filter | `Site.weakLinkIds` — when set on a port, `calcSiteLinks` restricts weak candidates before calc |

Debug helpers in production code: `explainAgricultureWeakLinkBudget()`, `getImpliedAgricultureWeakLinkBudget()`.

**Spansh compare (UI only):** `spansh-economy-resolve.ts` loads `spanshEconomies` plus an EDSM station name index. Completed **ports, outposts, and settlements** compare by journal `marketId` first; if that row is missing or colony-only (construction placeholder), compare falls back to EDSM `normalizeStationName(site.name) → marketId`. Does not affect economy calculation.

**Hubs and installations:** Excluded from Spansh compare (`isSpanshCompareExcluded` in `spansh-compare-reliability.ts`). Their economy ratios come from the RC facility registry and link model, not from journal `marketId` / Spansh snapshots. The economy table still shows RC estimates and audit; whole-system compare audit lists dockable sites only.

---

## Where to change behavior

| Goal | File |
|------|------|
| Facility intrinsic / athena comms | `economy-facility-registry.ts` |
| Spansh compare reliability (undockable) | `spansh-compare-reliability.ts` |
| Facility apply path | `economy-facilities.ts` |
| Body intrinsic / buffs / links | `economy-documented.ts` |
| Agriculture modifiers | `economy-ag-modifiers.ts` |
| Weak-link source rules | `economy-weak-links.ts`, `economy-link-sources.ts`, `system-model2.ts` |
| Gas-giant cluster ag strong links (body primary only) | `economy-link-sources.ts`, `system-model2.ts` |
| Spansh agriculture caps | `economy-ag-heuristics.ts` |
| Pipeline order | `economy-model2.ts` |

---

## Types (`system-model2.ts`)

- `SiteMap2.economies` / `primaryEconomy` — output
- `SiteMap2.economyAudit` — step trail for economy table
- `SiteMap2.intrinsic` — colony economies for weak-link counting
- `SiteMap2.links` — strong/weak inputs
- `SiteMap2.agEconomyCalc` — per-run agriculture cap flags
