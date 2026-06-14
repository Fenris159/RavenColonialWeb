# Facility economy registry (local maintenance)

Source of truth in production: [`src/economy-facility-registry.ts`](../../src/economy-facility-registry.ts) (`FACILITY_ECONOMY_REGISTRY`).

Applied at runtime by [`src/economy-facilities.ts`](../../src/economy-facilities.ts) → `resolveFacilityIntrinsicFromRegistry()`.

## Refresh from Spansh

1. Cache RC systems and galaxy station slices (or use `%TEMP%/ic1805-galaxy-stations.json`, etc.).
2. Run:

```bash
npm run test:economy -- --testPathPattern=build-facility-economy-registry
```

3. Inspect `%TEMP%/facility-economy-registry-report.json`.
4. Optional patch hints:

```bash
set UPDATE_FACILITY_REGISTRY=1
npm run test:economy -- --testPathPattern=build-facility-economy-registry
```

5. Merge suggested intrinsics into `FACILITY_ECONOMY_REGISTRY` and commit **only** the `src/` registry change.

Default harvest systems: IC 1805, HIP 52675, HR 4464.

## Rule kinds

| Rule | Meaning |
|------|---------|
| `linkOnly` | `type.inf === none` — no economy row; link/unlock only |
| `fixed` | Constant intrinsic on `type.inf` (1.0 = 100%) |
| `athenaComms` | 100% or 140% hightech from `aletheia` on same body (operational when complete; plan/build counts when site is in `calcIds`) |

## Coverage status

| Status | Notes |
|--------|--------|
| Registry rows | All hub/installation subtypes — `assertFacilityRegistryComplete()` |
| Spansh-calibrated | Few (e.g. IC 1805 athena/caelus; HR 4464 eunostus) |
| Default 100% | Most economy-bearing types until harvest shows otherwise |
| Link-only | Comms, satellites, civilian hubs, government, etc. |

Unobserved types default to 100% of `type.inf` until harvest finds a different Spansh dominant value.
