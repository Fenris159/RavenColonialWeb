# RavenColonialWeb

## Repo layout

| Path | In PR | Purpose |
|------|-------|---------|
| `src/` | Yes | Production app + economy model |
| `local/` | No | Local tests, Spansh verification, galaxy scripts ([readme](local/README.md)) |
| `docs/` | Yes | Architecture notes |

```bash
npm start              # site
npm run test:economy   # local Spansh/regression tests only
```

See [docs/local-development.md](docs/local-development.md).