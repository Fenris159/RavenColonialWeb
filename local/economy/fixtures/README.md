# Economy verification fixtures (local only)

Per-system data for `verify-systems.test.ts`. Not committed (`/local/` is gitignored).

## Quick start

1. Add systems to `systems.manifest.json`:

```json
{
  "systems": [
    {
      "slug": "synuefai-cxv-c18-6",
      "name": "Synuefai CX-V c18-6",
      "id64": 1732784263842
    },
    {
      "slug": "col285-bwu-c3-1",
      "name": "Col 285 Sector BW-U c3-1",
      "id64": 358462100138
    }
  ]
}
```

2. Refresh from current RC saves + Spansh:

```bash
# RC API spanshEconomies (default when galaxyDumpPath is null)
node local/economy/scripts/refresh-system-fixtures.js --source=api

# Or slice from a Spansh galaxy_stations.json download
# Set galaxyDumpPath in the manifest, then:
node local/economy/scripts/refresh-system-fixtures.js --source=galaxy
```

3. Run compare:

```bash
npm run test:economy -- --testPathPattern=verify-systems
```

4. Optional: clear old `%TEMP%` caches from prior per-system tests:

```bash
node local/economy/scripts/refresh-system-fixtures.js --clear-temp
```

## Layout

```
fixtures/
  systems.manifest.json
  systems/
    {slug}/
      rc-sys.json           # RC architect save from API
      spansh-stations.json  # Spansh rows (API or galaxy dump)
      compare-report.json   # written by verify-systems.test.ts
```

## Spansh source

| Source | When to use |
|--------|-------------|
| `rc-api` | Fast; uses `/spanshEconomies` on the RC backend (EDDN cache). Good default. |
| `galaxy-dump` | Official Spansh `galaxy_stations.json`; set `galaxyDumpPath` in manifest. |

Set `"preferNameMatch": true` in the manifest (default in tests) so sites **without** an operational journal `marketId` still match Spansh rows by normalized station name.

## Thresholds (optional)

Add `minDockableMatchPct` on a manifest entry to fail the test when dockable full-match rate drops (e.g. after model changes).
