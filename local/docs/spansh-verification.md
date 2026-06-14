# Spansh verification (local only)

Regression-test [`docs/economy-model.md`](../../docs/economy-model.md) against **current RC saves** and **fresh Spansh data** using a single fixture-driven workflow.

## Layout

| Path | Purpose |
|------|---------|
| `local/economy/fixtures/systems.manifest.json` | Systems you want to track (`slug`, `name`, `id64`) |
| `local/economy/fixtures/systems/{slug}/` | Cached `rc-sys.json` + `spansh-stations.json` |
| `local/economy/lib/compare-rc-spansh.ts` | Holistic compare (all economies, dockable vs facility) |
| `local/economy/tests/verify-systems.test.ts` | One test file, data-driven from manifest |
| `local/economy/scripts/refresh-system-fixtures.js` | Pull RC + Spansh into fixtures |

**Kept (not system-specific):** `economy-model2.test.ts`, `gas-giant-cluster-ag-link-role.test.ts`, `galaxy-stations-matching.test.ts`, `spansh-compare-excluded.test.ts`, `spansh-economy-resolve-*.test.ts`.

## Quick start

1. Add systems to `local/economy/fixtures/systems.manifest.json` (see `local/economy/fixtures/README.md`).

2. Refresh fixtures from live RC + Spansh:

```bash
node local/economy/scripts/refresh-system-fixtures.js --source=api
```

For a Spansh `galaxy_stations.json` download, set `galaxyDumpPath` in the manifest and use `--source=galaxy`.

3. Run compare:

```bash
npm run test:economy -- --testPathPattern=verify-systems
```

4. Clear old `%TEMP%` caches from the previous per-system tests (optional):

```bash
node local/economy/scripts/refresh-system-fixtures.js --clear-temp
```

## Spansh sources

| Source | Command | Notes |
|--------|---------|-------|
| RC API | `--source=api` | `/spanshEconomies` on RC backend (EDDN cache). Default. |
| Galaxy dump | `--source=galaxy` | Slice from `galaxy_stations.json`; set `galaxyDumpPath` in manifest. |

## Reports

Each run writes `fixtures/systems/{slug}/compare-report.json` with per-station mismatches, buildType breakdown, and economy stats. Tests **report** by default; add optional `minDockableMatchPct` on a manifest entry when you want a hard regression gate.

## Galaxy helper scripts

```bash
node local/economy/scripts/scan-galaxy-player-systems.js [dumpPath] [topN]
node local/economy/scripts/extract-galaxy-system-range.js
```

Use the scanner to find systems with many fresh player-made stations when building your manifest.

## Incomplete sites vs Spansh

Spansh reflects **completed** stations. In the app, **Include incomplete sites** previews planned builds; compare may not match until sites are complete and journaled.
