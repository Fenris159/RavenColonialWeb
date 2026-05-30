# Dev-only code (`src/dev/`)

Development and regression tooling lives here. Nothing under this folder is imported by the production app entry point; it exists only for local verification.

## `src/dev/economy/`

Economy model unit tests and Spansh verification suites. Lives under `src/dev/` so Create React App's Jest runner can find them, but nothing here is imported by the app.

```bash
npm run test:economy
```

Many verify tests read cached system JSON from `os.tmpdir()` — see each file for expected paths.

Module layout and test descriptions: [docs/economy-model.md](../../docs/economy-model.md).
