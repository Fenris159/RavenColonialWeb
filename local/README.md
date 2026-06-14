# Local development (not in git / not in PR)

Everything under **`local/`** is **gitignored** and lives **outside `src/`** so `npm start` does not type-check or compile these files.

| Location | In PR | Purpose |
|----------|-------|---------|
| [`src/`](../src/) | **Yes** | React app + economy model |
| [`local/`](../local/) | **No** | Tests, Spansh verification, galaxy scripts, local docs |
| [`docs/`](../docs/) | **Yes** | Production economy docs (`economy-model.md`, `economy-model-guide.md`) |

Production code and committed docs: **`src/`** and **`docs/economy-model*.md`** only.

## Layout

```
local/
├── README.md
├── docs/
│   ├── facility-economy-registry.md   # harvest / registry maintenance
│   └── spansh-verification.md         # regression tests & galaxy dumps
├── jest.config.js
├── app/                      # optional CRA smoke tests
└── economy/
    ├── fixtures/             # RC + Spansh per-system caches (manifest-driven)
    ├── lib/                  # Spansh/galaxy helpers + compare-rc-spansh
    ├── tests/                # verify-systems + unit tests
    ├── scripts/              # refresh-system-fixtures, galaxy dump tools
    └── tools/                # one-off debug TS
```

Imports from tests/lib/tools use **`../../../src/<module>`**.

## Commands

```bash
npm run test:economy    # Jest via local/jest.config.js
npm run test:local      # all tests under local/
npm start               # production src/ only

# Spansh regression (after editing fixtures/systems.manifest.json):
node local/economy/scripts/refresh-system-fixtures.js --source=api
npm run test:economy -- --testPathPattern=verify-systems

# Economy guide PDF (close the PDF in your editor first):
npm install --no-save marked playwright
npx playwright install chromium
node local/economy/scripts/generate-economy-guide-pdf.mjs
# Preview HTML (same content): docs/economy-model-guide.print.html
```

## Documentation map

| Doc | Audience |
|-----|----------|
| [`docs/economy-model.md`](../docs/economy-model.md) | Technical production model (commit with PR) |
| [`docs/economy-model-guide.md`](../docs/economy-model-guide.md) | Plain-language model (no code jargon) |
| [`local/docs/facility-economy-registry.md`](docs/facility-economy-registry.md) | Updating `FACILITY_ECONOMY_REGISTRY` from Spansh |
| [`local/docs/spansh-verification.md`](docs/spansh-verification.md) | Fixture-driven `verify-systems` workflow |
| [`local/economy/fixtures/README.md`](economy/fixtures/README.md) | Manifest + refresh commands |
