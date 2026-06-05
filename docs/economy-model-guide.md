# How colonization economies work

A plain-language guide to how Raven Colonial estimates market economy percentages for your ports. This describes the same rules as the [technical economy model](./economy-model.md), without implementation detail.

**What you see in the app:** each dockable port gets a percentage per economy type (Agriculture, Refinery, Military, and so on). Those numbers are built from the port’s **home body**, **system resources**, and **links** to other facilities and ports across the system. The economy table’s audit trail is a **ledger**: every line is a +5%, +40%, +80%, or +100% step; the displayed percent is the sum (225% means 2.25 in the data).

**External check:** where stations are complete in-game, the architect UI can compare estimates against **Spansh** market snapshots.

**Two docs:** this guide explains *what happens* in player terms. [economy-model.md](./economy-model.md) maps the same rules to source files and formulas.

---

## The big picture

Think of each port’s economy as a **ledger** of +5%, +40%, +80%, and +100% steps. The final percentage is the sum of every line that applies to that port.

Three mechanisms feed the ledger:

<div class="economy-flow" role="img" aria-label="Three mechanisms combine into the docked market percentage">

<div class="economy-flow__sources">

<div class="economy-flow__box economy-flow__box--own">
<p class="economy-flow__title">What the port earns on its own</p>
<ul>
<li>Body type (e.g. Rocky → Refinery)</li>
<li>Body features (e.g. Organics → Agriculture)</li>
<li>System resource level (e.g. Pristine)</li>
</ul>
</div>

<div class="economy-flow__box economy-flow__box--strong">
<p class="economy-flow__title">Strong links — big contributions</p>
<ul>
<li>Nearby hubs and settlements</li>
<li>Partner port on the same moon</li>
</ul>
</div>

<div class="economy-flow__box economy-flow__box--weak">
<p class="economy-flow__title">Weak links — small +5% steps</p>
<ul>
<li>Facilities and ports elsewhere in the system</li>
</ul>
</div>

</div>

<div class="economy-flow__arrows" aria-hidden="true">
<span>↓</span><span>↓</span><span>↓</span>
</div>

<p class="economy-flow__result">Docked market %</p>

</div>

| Mechanism | Typical size | Modified by body conditions? |
|-----------|--------------|------------------------------|
| **Own row** (body + system buffs) | +40% or +100% chunks | Yes for agriculture boosts; yes for pristine/depleted on industry |
| **Strong link** | +40%, +80%, or +120% per source | Yes — especially agriculture and pristine boosts on each link |
| **Weak link** | +5% per source | **Never** — always flat five percent |

The **link graph** in Market Links shows *candidates*. For agriculture, a **budget** may cap how many weak +5% steps actually apply even when many sources are listed.

**Who gets calculated:** by default only **completed** dockable sites. Planning mode can include planned builds — useful for previews, not for Spansh comparison.

---

## What counts when you build

By default, only **completed** facilities affect the model. “Include incomplete” planning mode can add planned and under-construction sites up to a build-order limit — useful for preview, not for Spansh comparison.

**Hubs and installations** (relay, security post, space farm, refinery hub, and so on) have fixed roles: they feed **links** into ports; their own economy row comes from a facility table, not from the port pipeline below.

---

## Step by step: how a colony port gets its numbers

1. **Body gifts** — The landable body adds whole economies from its type (rocky → refinery, earth-like → agriculture + tourism + …) and from signals (organics → agriculture, geological → industry, and so on).

2. **Local buffs** — If the port already has an economy from step 1, the system may add **+40%** for pristine/major resources (industry, refinery, extraction), organics (agriculture and hightech), or similar. Low or depleted resources can subtract 40% on those same industry types.

3. **Strong links** — Large chunks from supporting facilities on the same body and from partner ports (see below). Each strong contribution can receive **extra +40%** in a pristine system for refinery, industrial, and extraction — **once per strong link**, not once total.

4. **Weak links** — Every qualifying source elsewhere in the system adds **+5%** for its economy type (agriculture uses a budget cap).

5. **Finish** — The highest total becomes the port’s **primary economy**; all non-zero lines are shown in the economy table.

**Order matters for weak links:** nearby same-body agriculture sources are counted first (agriculture only), then system-wide sources in **alphabetical order**. That is why a science hub’s hightech can unlock a relay +5% on a starport when the relay’s name sorts later.

**Settlements** (Odyssey farms and similar) use a simpler path: fixed agriculture percentage, local buffs, no strong or weak links applied *to* the settlement — but settlements can still *send* weak links to ports elsewhere when they are subordinate hubs in the link graph.

**Specialized ports** (refinery outpost, tourism starport, etc.) start at +50% surface or +100% orbital on their specialty, then follow the same link rules as general colonies.

---

## Strong links in plain terms

**Strong links** are the main way a system specializes. A refinery hub, extraction settlement, or second port on a moon pushes a large slice of its economy into a dockable port.

**Size by facility tier**

| Tier | Strong link size |
|------|------------------|
| Small (outpost, small hub, settlement) | +40% |
| Medium hub | +80% |
| Large hub / starport-tier source | +120% |

**Same moon, two ports** — If you have a surface outpost and an orbital starport on one body, the surface port’s body economies can **strong-link** into the orbital port. The orbital port does **not** duplicate agriculture buffs on its own row when a surface **colony port** is present; those conditions apply on the **link** instead.

**Hub children** — A refinery hub may list settlements underneath it. Those appear as **sub-strong** links into the body’s main port (+40% / +80% from the child’s tier), each able to pick up a pristine +40% boost in refinery/extraction/industrial.

**Gas-giant farms** — A space farm on a sibling moon **strong-links agriculture** into that moon’s **main port only** (usually the orbital starport). A second outpost on the moon gets agriculture through **weak +5%** steps, not the farm’s strong link.

---

## Weak links in plain terms

**Weak links** are system-wide “background influence”: +5% per source, no bonuses or penalties on that five percent.

**Who can send weak links**

| Sender | Behavior |
|--------|----------|
| **Relay installation** | Hightech +5% to ports across the system |
| **Security installation** | Military +5% to all ports not on its body |
| **Unanchored space farm** | Agriculture +5% to other bodies |
| **Subordinate port or hub** | Its primary economy type, outward |
| **Body primary port** | Agriculture outward; on the **star** body, only agriculture (not military/refinery weak export) |
| **Military hub installation** | Does not weak-link outward |
| **Relay on a starport with no hightech** | Link shows in UI only — no +5% on the market row (e.g. a large ornamental starport) |
| **Relay on a starport that already has hightech** | +5% applies on top (e.g. science hub weak link, then relay) |

Weak links are processed in **alphabetical order** by source name. That order matters when a relay only applies after another source has already unlocked hightech on a starport.

**Security posts** add military +5% to ports on **other bodies** in the system. A security install on the same moon as your outpost does not weak-link military into that outpost — cross-body pool only.

**Foreign stars:** a surface colony with no local agriculture may only accept **one** agriculture weak link from each distant star’s subtree (farms on another star count once). Agriculture settlements are exempt from that cap.

---

## Agriculture — the special case

Agriculture follows the same three-path pattern observed in multi-port and tidal-moon systems (e.g. subordinate surface **145%**, paired orbital primary **225%**).

### On the port’s own market row

- **+100%** if the body has organics (and isn’t already an earth-like/water world).
- **+40%** organics buff on that row for most ports.
- **Exception:** an **orbital starport** paired with a **surface colony port** on the same body does **not** get those agriculture buffs on its own row — they appear on the **strong link** from the surface port instead.
- **No** icy or tidal **penalties** on the own row (subordinate surface ports keep +40% organics without −40% tidal on the docked row).

### On strong links into this port

- Full **+40% / −40%** table: organics, earth-like/water world, icy body, tidal lock chain to star, and so on.
- Tidal penalty on a **link** cannot pull that link’s contribution below **+10%**.

### On weak links

- Flat **+5%** per farm or agriculture port, up to the port’s agriculture **budget**.

**Intuition:** your outpost’s **displayed** agriculture is “what grows here.” **Penalties** for tide and ice apply when agriculture is **pushed through a link** into another port, not when you’re listing the outpost’s own row. Weak links are always a simple +5%.

### Agriculture weak-link budgets (plain terms)

Not every farm in the link graph adds +5% to your port. The model caps total weak agriculture by a **budget** — think “how much distant farm influence this port can absorb.” Tighter budgets apply when:

- A **strong** agriculture link already comes from the same moon (only a sliver of weak links left),
- The port is on a **metal-rich** or **icy** body without being an ag specialist,
- The port is an **orbital cluster** type with many subordinates (budget scales with count),
- The body is a **habitable ag-primary** world with a small colony strong link.

When the budget is exhausted, extra agriculture sources still appear in Market Links but audit shows **Skipped weak link … cap reached**. Typical default cap is **90%** from weak links alone (eighteen +5% steps) before other rules tighten it.

---

## Refinery, industrial, and extraction — pristine systems

In **major** or **pristine** systems:

| Where | +40% pristine bonus |
|-------|---------------------|
| Port’s **own** refinery/industrial/extraction from the body | Once, on the intrinsic row |
| **Each** strong link that adds refinery/industrial/extraction | Again, per link |

Example — orbital starport on a rocky moon in a pristine system:

- +100% rocky refinery (body)
- +40% pristine on that intrinsic
- +40% strong link from surface partner port → +40% pristine on **that** link
- +80% sub-strong from refinery hub on the moon → +40% pristine on **that** link  
- **Total refinery 340%**

A port with **only one** refinery strong link gets one pristine boost on the link (e.g. 260% on a single-hub starport).

**Hightech and tourism** strong-link body bonuses (organics, earth-like, black hole, and so on) still apply **at most once** per port calculation, unlike pristine industry boosts.

### Worked example — orbital starport refinery (340%)

| Ledger line | Amount |
|-------------|--------|
| Rocky body → refinery | +100% |
| Pristine system buff on that row | +40% |
| Strong link from same-body surface colony partner | +40% |
| Pristine buff on **that** strong link | +40% |
| Sub-strong from refinery hub child on the moon | +80% |
| Pristine buff on **that** sub-strong link | +40% |
| **Total** | **340%** |

Each refinery **strong** contribution in a pristine system can pick up its own +40% — the body row is not the only beneficiary.

---

## Multiple ports on one body

Frontier’s docs discourage multiple ports per body; the model still covers it:

1. One **primary** port per body (orbital wins over surface when both exist).
2. **Subordinate** ports link to the primary and **share its weak-link pool**.
3. Surface colony → orbital colony **strong-links** body economies; orbital agriculture buffs may move to the link layer.
4. Space farms **strong-link** the primary only; subordinates rely on weak agriculture steps.

Building extra ports is fragile in-game; the model reflects that split between primary and converted/subordinate behavior.

---

## Facilities you’ll see often

| Facility | Effect on ports |
|----------|-----------------|
| **Relay** | Weak hightech +5% system-wide (with starport rule above) |
| **Security post** | Weak military +5% system-wide |
| **Space farm** | Strong agriculture locally; weak agriculture to other bodies if not tied to a port on the same body |
| **Refinery / industry hub** | Strong link of that type into the body primary |
| **Comms** | Unlocks higher hightech on a science hub when complete on the body or parent chain |
| **Military hub** | Strong military locally; does not weak-link outward |

---

## Documented rules vs tuning knobs

**Documented rules** come from community colonization references (Mega Guide, Update 3): body tables, strong/weak sizes, subordinate behavior, agriculture three-path model, relay and security scope.

**Tuning knobs** are extra caps fit to observed markets: agriculture weak-link **budgets** (how many +5% steps count), some settlement floors, and a few colony presets. When in doubt, the documented layer is authoritative; tuning exists where the public rules are silent.

**Open gap:** low/depleted resource **penalties** on industry may eventually move to strong-link-only (as agriculture icy/tidal already did). Today they still apply on the port’s own industry row.

---

## Reading the economy table

Each line in the audit trail is one ledger entry: “+40 Buff: body has BIO”, “+80 Apply sub-strong link from: …”, “+5 Apply weak link from: …”.

Sum the lines for an economy type to get the displayed percentage (shown as 145% meaning 1.45 in the data).

**Primary economy** is whichever type has the highest total after all steps.

---

## Representative scenarios

| Scenario | What it exercises |
|----------|-------------------|
| **Gas-giant cluster + ornamental starport** | Relay UI-only when starport has no hightech; agriculture weak links from subordinate; security military cross-body; sibling-moon farm strong link |
| **Multi-port tidal moon + star-body port** | Surface/orbital colony pair; relay hightech after another weak source; pristine refinery stacking per strong link; security on star; anchored vs cluster farms |

Use these patterns when validating link or buff rule changes.

---

## Quick reference card

| Question | Answer |
|----------|--------|
| How big is a weak link? | Always +5% |
| How big is a strong link? | +40% / +80% / +120% by source tier |
| Does tide hurt my outpost’s ag % on its own row? | No −40% on own row; yes on strong links into other ports |
| Does pristine help refinery twice? | Yes — on body intrinsic and on **each** refinery strong link |
| Does relay always add hightech? | On outposts yes; on starports only if hightech already > 0 from another link |
| Who weak-links military from a security install? | Everyone not on that install’s body |
| Can a star-body primary export refinery weak links? | No — star-body primary exports agriculture weak only |
| Do farms on another moon strong-link my outpost? | No — strong to that moon’s **primary** port only |

For modifiers tables, budget rule list, and module ownership, see [economy-model.md](./economy-model.md).
