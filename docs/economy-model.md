# Economy model (production)

How colonization economy percentages are calculated in `src/`. The architect UI shows per-port strengths; external market snapshots (Spansh) are used only for optional UI comparison.

**Plain-language companion (no code):** [economy-model-guide.md](./economy-model-guide.md)

**Entry point:** `economy/index.ts` (re-exports `economy-model2.ts`).

**System build:** `buildSystemModel2` in `economy/system-model2.ts` assigns body primaries, subordinate links, strong/weak candidate pools, then runs economy calc per site in `calcIds`.

---

## Table of contents

1. [Which sites are included](#which-sites-are-included)
2. [Calculation pipeline](#calculation-pipeline)
3. [Body intrinsics](#body-intrinsics)
4. [Body buffs (own docked row)](#body-buffs-own-docked-row)
5. [Strong links](#strong-links)
6. [Strong-link boosts](#strong-link-boosts)
7. [Weak links](#weak-links)
8. [Agriculture (three paths)](#agriculture-three-paths)
9. [Agriculture weak-link budgets](#agriculture-weak-link-budgets)
10. [Settlements and specialized ports](#settlements-and-specialized-ports)
11. [Multi-port on one body](#multi-port-on-one-body)
12. [Installations and special weak-link rules](#installations-and-special-weak-link-rules)
13. [Hubs and facilities](#hubs-and-facilities)
14. [Tourism and hightech buffs](#tourism-and-hightech-buffs)
15. [Documented vs heuristic](#documented-vs-heuristic)
16. [Link graph vs economy math](#link-graph-vs-economy-math)
17. [Spansh compare](#spansh-compare)
18. [Options](#options)
19. [Module map](#module-map)
20. [References](#references)
21. [Verification](#verification)

---

## Which sites are included

`calcIds` is built in `initializeSysMap`:

| UI mode | `calcIds` |
|---------|-----------|
| Completed only (default) | `status === 'complete'` |
| Include incomplete (beaker) | Non-demolished sites up to build-order `idxCalcLimit` (`plan`, `build`, `complete`) |

Economy, link graph, tier gives, and system unlocks all respect `calcIds`. Incomplete mode is for **planning**; Spansh comparisons should use completed-only.

---

## Calculation pipeline

### System build (once per system view)

1. `initializeSysMap` — sites, bodies, `calcIds`
2. Per body: `calcBodyLinks` — body primary (orbital wins over surface when both are dockable ports)
3. `assignBodySubordinateLinks` — `parentLink` for tiered subordinates
4. `shareColonyLinkPoolFromPrimary` — non-primary colony ports and fixed specialized outposts inherit the body primary’s link pools
5. `calcSiteLinks` — per port: `strongSites`, `weakSites`, `sameBodyWeakSites`
6. `calcSiteEconomies` — precalc source economies for weak-link ordering

### Per dockable site: `calculateColonyEconomies2`

| Step | Settlements | Specialized fixed ports | Colony ports |
|------|-------------|-------------------------|--------------|
| 1 | Fixed intrinsic (`getSettlementFixedEconomyValue`) | 0.5 surface / 1.0 orbital on `type.fixed` | `applyBodyType` (body intrinsics + BIO/GEO/RINGS) |
| 2 | `applyBuffs(..., isSettlement=true)` | `applyBuffs` | `applyBuffs` |
| 3 | `applyAgricultureSettlementFloor` (heuristic) | — | `applyObservedPresetEconomies` (heuristic) |
| 4 | — | — | `applyStrongLinks2` → `applyParentHubSubStrongLink` |
| 5 | — | — | `applyWeakLinks` |
| 6 | — | — | Agriculture floors (heuristic) |
| 7 | `finishUp` — `primaryEconomy`, sorted `economies` | same | same |

**Facilities** (hubs/installations) use `calculateFacilityEconomies2` instead; see [Hubs and facilities](#hubs-and-facilities).

**Audit trail:** every `adjust()` appends to `site.economyAudit` (shown in the economy table UI).

**Precalc:** `calcSiteEconomies` runs `calculateColonyEconomies2` / `calculateFacilityEconomies2` on every weak-link **source** before receivers apply weak links, so colony sources expose `primaryEconomy` and relay ordering sees live `map.hightech`.

**Finish:** `finishUp` sets `site.economies`, `site.primaryEconomy` (highest total; tie-break by economy name sort), and sorts `economyAudit` for display. Percentages in UI are `economy × 100` (e.g. `2.25` → 225%).

---

## Body intrinsics

Colony ports (`type.inf === 'colony'`) receive economies from **body type** in `applyBodyType`:

| Body type | Economies added (+100% each) |
|-----------|------------------------------|
| ELW | agriculture, hightech, military, tourism |
| WW | agriculture, tourism |
| AW | hightech, tourism |
| GG / WG | hightech, industrial |
| HMC / MRB | extraction |
| Rocky-ice | industrial, refinery |
| Rocky | refinery |
| Icy | industrial |
| Asteroid | extraction |
| Star | military |
| BH / NS / WD | hightech, tourism |

**Feature adds** (when not redundant with body type):

| Feature | Effect |
|---------|--------|
| BIO (organics) | +100% agriculture (except ELW/WW), +100% terraforming |
| GEO | +100% extraction (except HMC/MRB), +100% industrial (except GG/WG/RI/IB) |
| RINGS | +100% extraction (except HMC/MRB) |
| Star + asteroids | +100% extraction on star-body ports |

Recorded in `site.intrinsic` for weak-link and strong-link source logic.

**Atmosphere** affects build-slot prediction only; agriculture modifiers use **BIO**, not atmosphere.

---

## Body buffs (own docked row)

Applied in `applyBuffs` after intrinsics exist (`map[economy] > 0`).

### Reserve-sensitive (extraction, industrial, refinery)

| System `reserveLevel` | Delta on own row |
|----------------------|------------------|
| MAJOR or PRISTINE | +40% each active economy |
| LOW or DEPLETED | −40% each (colony ports; not settlements) |

### Hightech (colony ports and settlements)

| Condition | +40% |
|-----------|------|
| Body has BIO | yes |
| Body has GEO | yes |
| Body is ELW or AW | yes |

Hub rows use `skipHightechBodyBuffs` (registry path).

### Extraction (settlements path)

+40% if body has volcanism.

### Agriculture

See [Agriculture (three paths)](#agriculture-three-paths) — positive BIO/ELW/WW on own row only; no icy/tidal on own row.

---

## Strong links

Implemented in `applyStrongLinks2`. Coefficients by source tier:

| Source tier | Coefficient |
|-------------|-------------|
| T1 (outpost / small hub / settlement) | 0.4 (+40%) |
| T2 (medium hub) | 0.8 (+80%) |
| T3 (large hub / starport) | 1.2 (+120%) |

**Demeter/picumnus** agriculture installations use T1 coefficient (0.4) when strong-linking, not the facility’s full intrinsic.

### Facility / hub → port

Applies `type.inf` at tier coefficient, then [strong-link boosts](#strong-link-boosts).

### Colony port → port (same body)

For each intrinsic economy on the **source** colony that passes `shouldApplyStrongLinkEconomy`:

- Agriculture: `getColonyAgricultureStrongLinkSourceValue` using **intrinsic agriculture only** (`getColonyIntrinsicAgricultureBeforeWeakLinks`) — excludes `Buff:`, `Floor:`, and `Apply ` audit rows
- Other intrinsics: flat tier coefficient (T1 0.4 / T2 0.8 / T3 1.2)

**Colony agriculture source value** (`getColonyAgricultureStrongLinkSourceValue`):

| Case | Formula |
|------|---------|
| Different body or non-colony source | Tier coefficient only |
| Source tier **below** receiver | `tierCoef + max(0, sourceAg − tierCoef) × 0.75` |
| Source tier ≥ receiver (default) | `max(tierCoef, sourceAg)` |
| ELW/WW receiver + tierCoef > 1.0 | `max(value, sourceAg + (tierCoef − 1.0) × 1.125)` |

Then `calculateAgricultureStrongLinkContribution` applies receiver-body modifiers and floor.

**Ground–orbit pair** (`isGroundOrbitColonyPair`): surface colony without agriculture intrinsic can still pass agriculture to orbital colony when source has agriculture before weak links.

**Fixed specialized receiver:** only inherits agriculture from same-body colony when `canInheritGroundOrbitColonyAgriculture`; other intrinsics require `ee === site.type.fixed`.

### Sub-strong links

When a strong source has `links.strongSites` children:

- **Hub** children recurse with `subLink: '*'` (each grandchild keeps its own economy)
- **Non-hub** children use `subLink: parent.type.inf`
- `shouldApplyStrongLinkEconomy` filters by `subLink` — `'*'` allows all; otherwise only matching economy

Prefix in audit: `sub-strong link` vs `Strong link`.

### Parent hub sub-strong (`applyParentHubSubStrongLink`)

After top-level strong links, a port **subordinate to an economy-bearing hub** (`parentLink` set, hub `type.inf !== none/colony`) receives one sub-strong at the **parent hub’s tier** (not the subordinate port’s tier).

Applies to: fixed specialized outposts and non-fixed colony ports under the hub.

### Gas-giant cluster agriculture

Sibling-moon `demeter` / `picumnus` **strong-link the body primary port only** (orbital primary when both orbital and surface primaries exist). Subordinate colony ports on the body get agriculture via **weak links only**, not cluster strong links.

`isGasGiantClusterAgStrongSourceOnly` blocks nested sub-strong from cluster farms on non-primary receivers.

---

## Strong-link boosts

`applyStrongLinkBoost` runs after each non-agriculture strong-link `adjust`, and after agriculture strong contributions use their own modifier path.

### Per-contribution vs once-per-calc

| Economy | Boost behavior |
|---------|----------------|
| **extraction**, **industrial**, **refinery** | MAJOR/PRISTINE (+40%) or LOW/DEPLETED (−40%) **per strong-link contribution** |
| **extraction** | +40% volcanism **per strong-link contribution** (in addition to reserve) |
| **hightech**, **tourism** | Body-type / BIO / GEO / stellar boosts **at most once per port calc** (`strongBoostApplied` set) |

**Example (orbital starport, pristine rocky moon, surface partner + refinery hub):** rocky refinery intrinsic +40% body buff + colony strong from surface partner +40% strong reserve boost + sub-strong from hub child +80% + **second** +40% strong reserve boost = 340%.

**Example (orbital starport, pristine, single refinery strong link):** one refinery strong link → one strong reserve boost → 260%.

---

## Weak links

- Strength: **+0.05 (+5%)** per applied link (`WEAK_LINK_AGRICULTURE_DELTA` for agriculture; same delta for other economies in `applyWeakLinksFromSources`)
- **No modifiers** on weak-link strength (Mega Guide)
- Sources processed in **name sort order**
- Skip if source already in receiver’s `strongSites` (direct or hub grandchild)
- Colony weak-link sources emit **`primaryEconomy` only** (not every intrinsic)

### Agriculture weak-link budget

The link graph lists all candidates; `getMaxAgricultureWeakLinkBudget` / `getMaxAgricultureWeakLinks` cap how many +5% steps **apply**. Rules in `economy-ag-heuristics.ts` — **tightest matching rule wins** (`Math.min` across all matching rules).

`maxSources = floor(budget / 0.05)` (`weakLinkBudgetToMaxSources`).

**Apply order:** `sameBodyWeakSites` first (**agriculture-only** pass), then `weakSites` (all economies). Non-agriculture weak links from same-body sources never run in pass 1; cross-body security/relay/military use pass 2 only.

See [Agriculture weak-link budgets](#agriculture-weak-link-budgets) for the full rule table.

### Foreign-star agriculture cap

Surface colony ports without agriculture intrinsic (`shouldLimitForeignStarAgricultureWeakLinks`) accept **at most one** agriculture weak link per **foreign host star** (star root via `getBodyStarRoot`). Odyssey agriculture **settlements** are exempt. Diagnostics: `getForeignStarAgricultureWeakLinkRoot`.

### Agriculture weak-link exclusions

`shouldApplyAgricultureWeakLink` skips foreign **ag+tourism** colony sources weak-linking into **orbital T1** non-fixed colony receivers.

### Who contributes weak links (`siteContributesWeakLinks`)

| Site | Contributes? |
|------|----------------|
| **Relay** (`enodia` / `ichnaea`) | Yes — system-wide, no subordination |
| **Security install** (`dicaeosyne`, `eunomia`, `nomos`, `poena`) | Yes — system-wide |
| **Demeter space farm** (unanchored) | Yes — cross-body agriculture only |
| **Anchored demeter** (same-body colony `parentLink`) | No outward weak |
| **Military hub install** (`alastor`, `vacuna`) | No |
| **Tiered port / hub** (starport/outpost) | Only when **subordinate** (`parentLink` set), **or** body primary (orbital/surface) |
| **Standalone tiered port** (not body primary, no parent) | No |
| **Body-primary hub** (no parent) | No |

### Body-primary outward weak links

| Primary type | Agriculture | Other economies |
|--------------|-------------|-----------------|
| Colony body primary (subordinate → orbital on another body) | Yes | No |
| **Star-body** primary tiered port | Yes | **No** |

### Relay weak link — economy apply (`relayWeakLinkAppliesEconomyTo`)

| Receiver | +5% hightech from relay |
|----------|-------------------------|
| Outpost | Always |
| Starport with `hightech > 0` when relay is processed | Yes (earlier weak/strong source in name sort) |
| Starport with hightech 0 | No — link visible in Market Links only |

### Security weak link — economy apply

`securityWeakLinkAppliesEconomyTo` always returns true at apply time. **Effective scope:** security installs appear in the **cross-body** `weakSites` pool only (`calcSiteLinks` excludes same-body siblings from `weakSites`). Same-body pass 1 is agriculture-only, so military from a co-located security install does not apply — matching Mega Guide “outside local body” via pool split, not a per-receiver filter.

---

## Agriculture (three paths)

Documented rules align with Colonization Mega Guide: modifiers affect **strong-link strength**; weak links are flat +5%.

### Path 1 — Own docked row (`applyAgricultureBodyBuffs`)

After body intrinsics:

| Modifier | On own row? |
|----------|-------------|
| BIO +40% | Yes, except orbital colony + same-body surface colony port pair (modifiers arrive via port-to-port strong link) |
| ELW/WW +40% | Same skip rule |
| Terraformable +40% | Only if `enableTerraformableAgricultureBonus` option |
| ICY/rocky-ice −40% | **No** |
| Tidal −40% | **No** |
| ELW/WW floor at 100% | Yes, if body type ELW/WW and agriculture < 1.0 after buffs |

### Path 2 — Strong-link output (`calculateAgricultureStrongLinkContribution`)

Full modifier table on **receiver body**:

| Modifier | Delta |
|----------|-------|
| BIO | +0.4 |
| ELW/WW | +0.4 (skipped for same-body ELW/WW colony source when flagged) |
| Terraformable | +0.4 (optional flag) |
| ICY/rocky-ice | −0.4 |
| Tidal (moon/planet chain to star) | −0.4 |

**Floor:** contribution cannot go below **0.1 (+10%)** (`STRONG_LINK_CONTRIBUTION_FLOOR`).

Port-to-port sources use **intrinsic** agriculture value only (body `Body has: BIO` rows, not `Buff:` rows).

### Path 3 — Weak links

+5% per applied source; no modifiers; budget-limited.

### Worked examples

| Port role | Agriculture breakdown |
|-----------|----------------------|
| **Subordinate surface colony** (organics, tidal moon) | +100 BIO intrinsic, +40 BIO own buff, +5 farm weak → **145%** |
| **Orbital primary** (same body as surface colony, cluster farm) | +100 BIO intrinsic, +85 colony strong (surface partner, modifiers on link), +40 farm strong → **225%**; no BIO/tidal own-row buffs (surface colony pair skip) |
| **Orbital primary** (no surface colony port on body) | +100 BIO intrinsic, +40 BIO own buff, +5 subordinate weak → **145%** |

---

## Agriculture weak-link budgets

Heuristic layer (`economy-ag-heuristics.ts`). Budget is max **economy strength** from weak agriculture (+5% per applied source). Multiple rules may match; **lowest budget** applies.

| Rule label | Budget (strength) | When |
|------------|-------------------|------|
| ELW/WW ag-primary hab + T1 colony ag strong | 0.55 (55%) | `isAgPrimaryHabWorldColony` |
| Icy fixed non-ag port (BIO or tidal) | 0.25 | Fixed non-ag on icy/rocky-ice |
| HMC/MRB surface outpost, no ag intrinsic | 0.30 | Outpost colony on HMC/MRB |
| HMC/MRB starport, no same-body ag strong | 1.60 | Starport colony on HMC/MRB |
| Same-body large ag settlement strong | 1.10 | `sameBodyAgSettlementStrongLink` |
| Same-body ag facility strong (no settlement) | 0.15 | `sameBodyAgFacilityStrongLink` |
| plutus / vulcan / prometheus orbital cluster | 1.40 / 1.15 / 1.15 | By strong subordinate count (≥1 / ≥3) |
| Observed buildType table | 1.25–1.60 | `hestia`, `poseidon`, `apollo`, `clotho`, `chronos`, `atropos`, … |
| Colony port, no same-body ag strong (default) | 0.90 | Fallback non-HMC |
| Same-body colony ag strong, non-hab | 0.05 | `sameBodyColonyAgStrongLink` on non-ELW/WW |
| Tidal hab-world ag colony | 0.50 | ELW/WW + ag intrinsic + tidal to star |

**Flags** (`site.agEconomyCalc`, set during strong-link apply): `sameBodyColonyAgStrongLink`, `sameBodyAgFacilityStrongLink`, `sameBodyAgSettlementStrongLink`, `tier1ColonyAgStrongLink` — drive budget rules without parsing audit text.

**Floors** (after weak links): `applyFixedSurfaceAgricultureFloor`, `applyOrbitalFixedNonAgAgricultureFloor`, `applyAgricultureSettlementFloor`.

Debug: `explainAgricultureWeakLinkBudget(site, agPrimaryHabWorld)`.

---

## Settlements and specialized ports

### Odyssey settlements (`buildClass === 'settlement'`)

| Step | Behavior |
|------|----------|
| Fixed intrinsic | `getSettlementFixedEconomyValue`: **60%** for `picumnus` / `annona` / `consus`; else **100%** |
| Buffs | `applyBuffs(..., isSettlement=true)` — reserve penalties skipped for industry on settlements |
| Floor | `applyAgricultureSettlementFloor` |
| Links | **No** strong/weak link apply in `calculateColonyEconomies2` |

Settlements still appear as weak-link **sources** when subordinate and in `calcIds`.

### Fixed specialized ports (`type.fixed` set, not `colony`)

| Location | Intrinsic |
|----------|-----------|
| Orbital | +100% on `type.fixed` |
| Surface | +50% on `type.fixed` |

Then `applyBuffs`. Strong/weak links apply normally. Ground–orbit inheritance: specialized orbital receives agriculture from same-body surface **colony** when `canInheritGroundOrbitColonyAgriculture`; other intrinsics require matching `type.fixed`.

### General colony ports

`applyBodyType` + `applyBuffs` + `applyObservedPresetEconomies` (icy **atropos** subordinate preset only). Orbital primary may skip `applyBodyType` when paired with surface colony and legacy flag — see `USE_NEW_MODEL` branch in `economy/economy-model2.ts`.

---

## Multi-port on one body

Mega Guide: multiple ports on one body are a special case; RC models:

1. **Body primary** — orbital port wins when both orbital and surface dockable ports exist
2. **Subordinate ports** — `parentLink` to primary; share primary’s weak-link candidate pools
3. **Converted port behavior** — subordinate surface colony strong-links orbital primary; agriculture body buffs on orbital primary skipped when surface primary is a colony port
4. **Cluster farm strong** — body primary only; subordinates use weak agriculture steps
5. **Weak-link emission** — subordinate tiered ports weak-link outward; primaries weak-link agriculture outward (non-ag restricted for star-body primary)

---

## Installations and special weak-link rules

| Build types | Role |
|-------------|------|
| `enodia`, `ichnaea` | Relay — weak hightech system-wide |
| `dicaeosyne`, `eunomia`, `nomos`, `poena` | Security — weak military system-wide |
| `demeter`, `picumnus` | Space farm — strong local/cluster; weak cross-body if unanchored |
| `alastor`, `vacuna` | Military hub — strong local only; no outward weak |
| `aletheia`, `pistis`, `soter` | Comms — link-only; unlock athena 140% |

---

## Hubs and facilities

| Role | Behavior |
|------|----------|
| **Economy-bearing hub** (`type.inf` set) | Fixed intrinsic via `economy-facility-registry.ts` + `economy-facilities.ts`. No strong/weak math on the hub row itself. |
| **athena** | 100% hightech default; **140%** when comms complete on host body or any **ancestor** body. **Exception:** athena on HMC with star parent stays 100%. Operational `marketId` ≥ 4_200_000_001 or player prefix 395–397, 42, 43. |
| **Link-only** (`type.inf === none`, e.g. `aletheia`) | No economy row; subordinate under body primary; unlocks hub intrinsics / port strong links. |

Registry: `FACILITY_ECONOMY_REGISTRY` (`linkOnly`, `fixed`, `athenaComms`).

---

## Tourism and hightech buffs

### Own docked row (`applyBuffs`)

| Economy | Conditions (+40% each when economy > 0) |
|---------|------------------------------------------|
| **Hightech** | BIO, GEO, or ELW/AW body (settlements: separate BIO/GEO/ELW checks; hubs: `skipHightechBodyBuffs`) |
| **Tourism** | BH / NS / WD in system; BIO+GEO or ELW/WW/AW on body (stellar tourism uses `site.bodyBuffed` guard) |
| **Extraction** | Volcanism on body |

### Strong-link boosts (`applyStrongLinkBoost`)

| Economy | Stacking |
|---------|----------|
| **Hightech** | AW/ELW/WW, BIO, GEO — **once per port calc** |
| **Tourism** | AW/ELW/WW, BIO, GEO, NS, BH, WD — **once per port calc** |

Strong-link tourism/hightech boosts use the same body/system conditions but fire on each strong-link `adjust` only until `strongBoostApplied` records the economy.

---

## Documented vs heuristic

| Layer | Modules | Contents |
|-------|---------|----------|
| **Documented** | `economy-documented.ts`, `economy-ag-modifiers.ts`, `economy-weak-links.ts`, `economy-link-sources.ts` | Body intrinsics, buffs, strong tiers, weak +5%, subordinate rules, agriculture three-path model, relay/security/farm rules |
| **Heuristic** | `economy-ag-heuristics.ts` | Agriculture weak-link **budgets**, floors, preset colonies (Atropos), foreign-star caps — empirical fit |

Prefer extending documented modules; add heuristics only when empirical fit requires it.

### Known documented gap

Industrial/extraction/refinery **LOW/DEPLETED** penalties still apply on the **own docked row** via `applyBuffs`. Mega Guide lists those decreases under strong-link modifiers; agriculture icy/tidal were split to strong-link-only — reserve decreases may follow the same pattern in a future change.

`site.agEconomyCalc` flags (`economy-core.ts`) drive cap logic without parsing audit strings.

---

## Link graph vs economy math

| Concept | Where |
|---------|--------|
| Candidate pools | `site.links.strongSites`, `weakSites`, `sameBodyWeakSites` in `calcSiteLinks` |
| Link graph bar (UI) | `MarketLinks.tsx` — display; may show candidates not all applied (agriculture budget) |
| Weak-link application | `applyWeakLinks` — sorted; agriculture budget; skips strong-linked sources |
| Hub grandchild strong | `flattenHubGrandchildStrongSites` — settlements keep own economy in strong pool |
| Optional filter | `Site.weakLinkIds` restricts weak candidates in `calcSiteLinks` |

Debug: `explainAgricultureWeakLinkBudget()`, `getImpliedAgricultureWeakLinkBudget()`.

---

## Spansh compare

**UI only** — does not affect calculation.

`economy/compare/spansh-economy-resolve.ts`: journal `marketId` first; fallback EDSM name index. Completed **ports, outposts, settlements** only.

Hubs/installations excluded (`isSpanshCompareExcluded`). Does not affect economy calculation.

---

## Options

```typescript
interface EconomyModelOptions {
  enableTerraformableAgricultureBonus?: boolean; // default false
}
```

From `SystemView2` → `buildSystemModel2`. Persisted as `terraformableAgriBonus` in local storage.

---

## Module map

| File | Purpose |
|------|---------|
| `economy/index.ts` | Public re-exports |
| `economy/economy-model2.ts` | Pipeline + public API |
| `economy/system-model2.ts` | Link graph + `buildSystemModel2` |
| `economy/economy-documented.ts` | Body intrinsics, buffs, strong/weak apply |
| `economy/economy-ag-modifiers.ts` | Agriculture modifier tables + own-row vs strong-link split |
| `economy/economy-ag-heuristics.ts` | Weak-link budgets, floors, presets |
| `economy/economy-weak-links.ts` | Weak-link contributor rules, relay/security apply filters |
| `economy/economy-link-sources.ts` | Cluster farms, hub flattening, anchored farm detection |
| `economy/economy-facility-registry.ts` | Per–build-type facility intrinsics |
| `economy/economy-facilities.ts` | `calculateFacilityEconomies2` |
| `economy/economy-core.ts` | `adjust`, constants, `bodyIsTidalToStar`, ag flags |
| `economy/compare/spansh-economy-resolve.ts` | Spansh compare resolution (UI) |
| `economy/compare/spansh-compare-reliability.ts` | Compare confidence helpers (UI) |

### Where to change behavior

| Goal | File |
|------|------|
| Facility intrinsic / athena comms | `economy-facility-registry.ts` |
| Body intrinsic / buffs / links | `economy-documented.ts` |
| Agriculture modifiers | `economy-ag-modifiers.ts` |
| Weak-link source rules | `economy/economy-weak-links.ts`, `economy/economy-link-sources.ts`, `economy/system-model2.ts` |
| Gas-giant cluster ag strong | `economy/economy-link-sources.ts`, `economy/system-model2.ts` |
| Agriculture weak-link budgets | `economy/economy-ag-heuristics.ts` |
| Pipeline order | `economy/economy-model2.ts` |
| Spansh compare | `economy/compare/spansh-economy-resolve.ts`, `economy/compare/spansh-compare-reliability.ts` |

### Types (`economy/system-model2.ts`)

| Field | Meaning |
|-------|---------|
| `SiteMap2.economies` / `primaryEconomy` | Output percentages (0–3+ as decimals) |
| `SiteMap2.economyAudit` | Step trail for economy table |
| `SiteMap2.intrinsic` | Colony economies from body/features |
| `SiteMap2.links` | strong/weak inputs |
| `SiteMap2.agEconomyCalc` | Per-run agriculture cap flags |
| `SiteMap2.parentLink` | Subordinate → primary on same body |

---

## References

| Source | Used for |
|--------|----------|
| Colonization Mega Guide (community sheet) | Body intrinsics, ±0.4 agriculture modifiers, strong/weak sizes, subordinate behavior |
| Update 3 supporting facilities | Relay, security, space farm roles |
| Observed in-game markets | Star-body primary weak export, relay on ornamental starports, agriculture budgets |

When Mega Guide and observed markets disagree, documented rules define intent; heuristics (`economy-ag-heuristics.ts`) close empirical gaps.

---

## Verification

Tracked PR smoke regressions live under `src/economy/`; run `npm run test:economy` from the repo root. The broader fixture/Spansh verification suite lives under `local/economy/tests/` (not in PR). Scenarios exercised across those suites include:

| Scenario | What it validates |
|----------|-------------------|
| Holistic system compare | Completed dockable ports vs external snapshots |
| Agriculture three-path | Tidal/icy penalties on strong links only; own-row buffs on subordinate surface |
| Relay on starport | +5% hightech only when hightech already > 0 at apply time |
| Pristine refinery stacking | Reserve boost per refinery strong-link contribution |
| Security install | Cross-body military weak links; star-body primary non-ag export |
| Ornamental starport | Relay visible in link graph without hightech economy row |
