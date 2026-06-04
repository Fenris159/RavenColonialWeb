# Local development vs production

| Location | In git / PR | Purpose |
|----------|-------------|---------|
| [`src/`](../src/) | **Yes** | React app + economy model consumed by the site |
| [`local/`](../local/) | **No** (gitignored) | Tests, Spansh verification, galaxy dump scripts (outside `src/`) |
| [`docs/`](../docs/) | **Yes** | Architecture notes (`economy-model.md`, this file) |

The dev server and production build only compile **`src/`**. Local tests import production via `../../../src/...` from `local/economy/`.

## Economy verification

See [`local/README.md`](../local/README.md) and run:

```bash
npm run test:economy
```
