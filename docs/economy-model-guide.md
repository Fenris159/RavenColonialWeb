# How Colonization Economies Work

This is the planner-facing explanation of Raven Colonial's current economy
model. For code ownership and implementation details, see
[economy-model.md](./economy-model.md).

The app estimates the economy percentages shown for completed or planned
colonization sites. A displayed **145%** is stored internally as `1.45`.

Spansh data is used only as a comparison tool. It does not change Raven
Colonial's calculations.

## What Counts

The System View can calculate in two modes:

| Mode | Meaning |
|------|---------|
| Completed sites only | Only finished sites count. |
| Use all Sites | Complete, building, and planned sites count up to the cut line. |

Some rows are never safe to model and are forced below `BROKEN BELOW`:

- Unknown body
- Missing or unknown build type
- Bad placeholder market id, such as a positive single-digit id
- Demolished site

Those rows stay visible so the user can see the data problem, but they do not
feed the model.

## The Primary Port

The system primary port is the first site in the saved `system.sites` array.
This is kept for compatibility with other callers of the API.

The Order for Calculations panel no longer supports drag/drop ordering. It is an
informational view with grouping controls. To change the system primary port,
use **Change Primary Port?** on the first row. Saving moves the selected port to
`system.sites[0]`.

## Where Economy Percentages Come From

Each market row is built from three sources:

| Source | Typical size | Notes |
|--------|--------------|-------|
| Body and feature intrinsics | +100% chunks | Planet type, BIO, GEO, rings, asteroid clusters, etc. |
| Buffs | +/-40% chunks | Reserve level, volcanism, BIO/GEO, stellar bodies, agriculture modifiers. |
| Links | +40/+80/+120 strong, or +5 weak | Strong links come from local facilities/partners; weak links come from supporting sites elsewhere. |

The economy audit table is a ledger. Add the audit rows for an economy to get
the displayed percentage.

## Body Intrinsics

Examples:

- Earth-like worlds give Agriculture, High Tech, Military, and Tourism.
- Water worlds give Agriculture and Tourism.
- Rocky worlds give Refinery.
- Icy worlds give Industrial.
- HMC and metal-rich bodies give Extraction.
- Biological signals can add Agriculture and Terraforming.
- Geological signals can add Extraction and Industrial.
- Rings can add Extraction.

## Buffs

Reserve level affects Extraction, Industrial, and Refinery:

- Major/Pristine: +40%
- Low/Depleted: -40% on non-settlement own rows

Other common buffs:

- Volcanism can add +40% Extraction.
- BIO/GEO or ELW/AW can add High Tech.
- Black holes, neutron stars, white dwarfs, BIO/GEO, and ELW/WW/AW can add
  Tourism.

## Strong Links

Strong links are the large local links shown by hubs, installations, settlements,
and paired ports.

| Tier | Contribution |
|------|--------------|
| T1 | +40% |
| T2 | +80% |
| T3 | +120% |

For Extraction, Industrial, and Refinery, reserve-level boosts can apply again
on each strong-link contribution. That is why a Pristine refinery setup can grow
quickly when several refinery strong links are present.

Gas-giant cluster farms (`demeter`/`picumnus` on sibling moons) strong-link
Agriculture into the moon's primary port only. Subordinate ports do not get that
cluster farm as an extra strong link.

## Weak Links

Weak links are flat +5% steps. Body conditions do not change the size of the
step.

Common weak sources:

- Relays: High Tech support.
- Medical High Tech installations: High Tech support.
- Security installations: Military support.
- Space farms: Agriculture support when eligible.
- Economy-bearing hubs and subordinate ports.

Relay High Tech has one important rule: outposts can receive it directly, but a
starport only receives relay High Tech if High Tech already exists on that
starport or another High Tech weak anchor is present.

## Agriculture

Agriculture has the most special handling.

Own-row agriculture can receive:

- BIO +40%
- Terraformable +40% only when the Terraformable Agriculture option is enabled
- ELW/WW +40%
- Icy or tidal -40% in the current live model

Agriculture strong links use the receiver body's modifiers:

- BIO +40%
- Terraformable +40% when enabled
- ELW/WW +40%
- Icy/Rocky-Ice -40%
- Tidal -40%

An agriculture strong link cannot be reduced below +10%.

Agriculture weak links are still +5% each. Most older agriculture weak-link cap
rules are disabled in the current model because they over-constrained valid
systems. Only tidal orbital cluster colony ports currently use a weak-link cap.

## Settlements, Specialized Ports, and Facilities

Odyssey settlements:

- Start with 100% of their fixed economy.
- Receive own-row buffs.
- Do not receive strong/weak links as receivers.

Specialized ports:

- Surface specialized port: 50% fixed economy.
- Orbital specialized port: 100% fixed economy.
- Can still receive buffs and links.

Hubs and installations:

- Use fixed facility rules from the facility registry.
- Most fixed facility economies are 100%.
- `athena` scientific hubs are 100% High Tech by default and 140% when qualifying
  comms exist on the same body or a parent body.
- Link-only facilities have no market percentage of their own.

## Tier Points

Tier-point math is not based on arbitrary table order. It uses a canonical order:

1. Skip the system primary port.
2. Consider valid tier-requiring starports.
3. Sort high tier before low tier.
4. Sort by body order, then orbital before surface, then market/name fallback.

This keeps the math stable while the Order panel groups rows by body for
readability.

Warnings about insufficient Tier 2/Tier 3 points are shown for planned sites.
Complete and building sites are already locked in.

## Spansh Compare

The compare panel tries to match completed dockable sites against Spansh:

1. First by journal/RC market id.
2. Then by EDSM station name if the id is stale or missing.

No-pad facilities are treated as limited reliability because their public data
can stay stuck on construction-era market ids.

If two same-body sites appear swapped in Spansh, the app can show up/down hints
in Order for Calculations. **Auto re-order markets** applies those recommended
market inversion swaps only; it does not perform a general site regroup.

## Terraformable Agriculture Option

The Terraformable Agriculture option is a what-if switch. It is off by default
because current game behavior does not consistently confirm that terraformable
bodies receive the expected agriculture bonus.

When enabled, terraformable bodies can add +40% Agriculture on own rows and
strong-link agriculture formulas.

## Quick Answers

| Question | Answer |
|----------|--------|
| How big is a weak link? | Always +5%. |
| How big is a strong link? | +40%, +80%, or +120% by source tier. |
| Does Spansh change calculations? | No, it is comparison-only. |
| Can users drag the calculation order? | No. The panel is informational; primary port changes are explicit. |
| What is the primary port? | The valid site saved at `system.sites[0]`. |
| Do invalid imported sites count? | No. They go below `BROKEN BELOW`. |
| Are old agriculture weak-link budgets active? | No, except the tidal orbital cluster cap. |
