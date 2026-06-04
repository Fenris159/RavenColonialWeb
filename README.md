# RavenColonialWeb

## Repo layout

| Path | In PR | Purpose |
|------|-------|---------|
| `src/` | Yes | Production app + economy model |
| `docs/` | Yes | Production architecture ([economy model](docs/economy-model.md)) |
| `local/` | No | Local tests, Spansh tools, and dev-only docs (gitignored) |

```bash
npm start              # site (src/ only)
npm run build
```

Local verification (not in git): clone keeps a `local/` folder on disk — see `local/README.md` if present, then `npm run test:economy`.

Economy architecture for reviewers: **[docs/economy-model.md](docs/economy-model.md)**.
