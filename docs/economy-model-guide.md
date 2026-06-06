# How colonization economies work

A plain-language guide for **Elite Dangerous** colonizers using Raven Colonial to plan Odyssey settlements, installations, and dockable ports. It describes the same rules as the [technical economy model](./economy-model.md), without code or file names.

**What you see in the architect:** each **starport**, **outpost**, or **settlement** that shows a market gets a percentage per economy type (Agriculture, Refinery, Military, High Tech, and so on). Those numbers come from the port’s **landable body**, the **system’s resource level** (Pristine, Depleted, etc.), and **market links** to other builds in the same system. The economy table’s audit trail is a **ledger**: every line is a +5%, +40%, +80%, or +100% step. **225%** in the UI means 2.25 in the game data.

**Spansh check:** for **completed** stations you can dock in-game, the UI can compare Raven Colonial’s estimate against **Spansh** market snapshots.

**Two docs:** this guide is for planners and CMDRs. [economy-model.md](./economy-model.md) is the full technical spec for developers.

---

## The big picture

Think of each port’s market row as a **ledger** of stacking bonuses. Three kinds of entry fill it:

<div class="economy-flow" role="img" aria-label="Three mechanisms combine into the docked market percentage">

<div class="economy-flow__sources">

<div class="economy-flow__box economy-flow__box--own">
<p class="economy-flow__title">What the body gives the port</p>
<ul>
<li>Planet type (Rocky → Refinery, Earth-like → Agriculture, …)</li>
<li>Signals (Biological → Agriculture, Geological → Industry, …)</li>
<li>System resources (Pristine / Depleted on industry rows)</li>
</ul>
</div>

<div class="economy-flow__box economy-flow__box--strong">
<p class="economy-flow__title">Strong links — big slices</p>
<ul>
<li>Hubs and settlements on the same body</li>
<li>A second port on the same moon (surface ↔ orbital)</li>
</ul>
</div>

<div class="economy-flow__box economy-flow__box--weak">
<p class="economy-flow__title">Weak links — +5% each</p>
<ul>
<li>Relays, security posts, farms, subordinate ports — often on other bodies</li>
</ul>
</div>

</div>

<div class="economy-flow__arrows" aria-hidden="true">
<span>↓</span><span>↓</span><span>↓</span>
</div>

<p class="economy-flow__result">Market % on the System Map</p>

</div>

| Mechanism | Typical step | Body conditions change it? |
|-----------|--------------|----------------------------|
| **Own row** (planet + system buffs) | +100% or +40% chunks | Yes — agriculture buffs; Pristine/Depleted on Refinery, Industrial, Extraction |
| **Strong link** | +40%, +80%, or +120% per source | Yes — especially agriculture and Pristine on **each** industry strong link |
| **Weak link** | +5% per source | **No** — always flat five percent |

**Market Links** in the app shows who *could* link. For **Agriculture**, a **budget** may stop extra +5% steps even when many farms appear in the graph.

**Who counts:** by default only **finished** builds (`Complete` in your colonization log). **Include incomplete** (beaker icon) adds planned and in-progress sites for **what-if** planning — not for Spansh comparison.

---

## Installations vs dockable ports

**Hubs and installations** (relay, security post, space farm, refinery hub, comms, etc.) mostly **feed links** into your starports and outposts. Their own market row (if they have one) comes from fixed facility rules, not the full port pipeline below.

**Odyssey settlements** on the surface use a shorter path: fixed agriculture %, local body buffs, no strong/weak links applied *to* the settlement itself — but they can still **send** weak links outward when tied into the link graph as a subordinate.

**Specialized ports** (Refinery outpost, Tourism starport, Extraction outpost, etc.) start at **+50%** on the surface or **+100%** orbital on their specialty, then use the same link rules as a general colony port.

---

## Step by step: how a colony port gets its numbers

1. **Planet type** — The landable body adds whole economies (Rocky → Refinery, Metal-rich → Extraction, Earth-like → Agriculture + High Tech + …).

2. **Signals and system resources** — Biological and geological signals add more on rows you already have. In **Pristine** or **Major** systems, Refinery, Industrial, and Extraction on the port’s **own row** gain **+40%**; **Low** or **Depleted** can subtract **−40%** on those same industry rows. The same Pristine/Depleted rules also apply to **each strong link** from a hub or settlement on that body (see below).

3. **Strong links** — Large contributions from facilities on the same body and from a paired port on the same moon. Each industry strong link can pick up its own **+40% Pristine** boost.

4. **Weak links** — Qualifying sources add **+5%** for their economy type (Agriculture is budget-capped). Same-body processing is special: only **Agriculture** weak links are applied from co-located sources; relays do **not** add High Tech +5% to ports on the **same** body as the relay.

5. **Finish** — The highest total becomes the port’s **primary economy** (what the System Map highlights). All non-zero rows stay visible in the economy table.

**Order matters:** same-body **Agriculture** weak links are applied first, then system-wide sources in **alphabetical order** by facility name. That is why a science hub’s High Tech weak link can appear **before** a relay on a starport — and why a relay only adds +5% High Tech on a **starport** if High Tech is already above 0% when the relay’s turn comes.

---

## Strong links in plain terms

**Strong links** are how you specialize a system: a Refinery hub, Extraction settlement, or second port on a moon pushes a big slice into a dockable **primary** port.

### Strong link size = construction tier (T1 / T2 / T3)

In-game, link strength follows the source’s **construction tier**, not pad size or “small/medium/large” labels. A **T2** bio research settlement is a **medium-tier** strong link even if the pad is small.

| Construction tier | Strong link contribution |
|-------------------|--------------------------|
| **T1** (tier-1 outpost, tier-1 hub, tier-1 settlement) | +40% |
| **T2** (tier-2 hub, tier-2 settlement — e.g. bio research settlement) | +80% |
| **T3** (tier-3 hub, large starport-class source) | +120% |

### Same moon, two ports

If you have a **surface outpost** and an **orbital starport** on one landable body, the surface port’s body economies can **strong-link** into the orbital port. The orbital port does **not** repeat agriculture buffs on its **own row** when a surface **colony port** is present — those modifiers apply on the **strong link** from the surface port instead.

### Hub children

A Refinery hub with settlements underneath shows each child as a **sub-strong** link into the body’s main port (+40% or +80% from the child’s tier). In a **Pristine** system, **each** of those refinery/industrial/extraction sub-strong links can gain another **+40%** — same as the port’s own rocky refinery row.

### Gas-giant cluster farms

A **space farm** on a **sibling moon** under the same gas giant **strong-links Agriculture** into that moon’s **main port only** (usually the orbital starport). A second outpost on the moon picks up agriculture through **weak +5%** steps, not the farm’s strong link.

---

## Weak links in plain terms

**Weak links** are light background influence: **+5%** per source, with no extra body modifiers on that five percent.

### Who sends weak links

| Sender | What it does |
|--------|----------------|
| **Relay installation** | High Tech +5% to ports on **other bodies** (not the relay’s own body). See starport rule below. |
| **Security installation** | Military +5% to ports on **other bodies** only |
| **Unanchored space farm** | Agriculture +5% to **other** landable bodies |
| **Subordinate starport / outpost / hub** | Its **primary economy** only, outward (+5%) |
| **Body primary port** | Agriculture weak links outward. On a port built on the **central star** body, non-agriculture economies stay on the port’s **own row** — they are **not** exported as weak links |
| **Military hub installation** | Strong military locally; does **not** weak-link outward |

### Relay quirks (starports vs outposts)

| Receiver | Relay High Tech +5% |
|----------|---------------------|
| **Outpost** (any body) | Always applies |
| **Starport** with High Tech already > 0% when the relay is processed | Applies (+5% on top) |
| **Starport** with no High Tech row yet | **Market Links** may still show the relay; **no +5%** on the market (e.g. large ornamental starport) |

Relays on the **same body** as a port do **not** add that +5% High Tech weak link to co-located ports — only cross-body weak links count for relay economy. (The relay can still **strong-link** locally.)

### Security posts

Military +5% from a security installation hits ports on **other bodies** only. A security post on the same moon as your outpost does **not** add Military weak link to that outpost.

### Agriculture from distant stars

A surface colony with no local agriculture may only accept **one** agriculture weak link per **distant star’s** subtree (farms around another star count once). Agriculture **settlements** are exempt from that cap.

---

## Agriculture — the special case

Agriculture is the fiddliest row because body conditions apply differently on **your own market** vs **links into another port**. Observed multi-port setups often look like **145%** on a subordinate surface port and **225%** on the paired orbital primary.

### On the port’s own market row

- **+100%** if the body has a **Biological** signal and the planet type does not already grant Agriculture (Earth-like and Water worlds already get Agriculture from the planet type).
- **+40%** Biological buff on that row for most ports.
- **Optional +40% Terraformable what-if buff** when the System page's Terraformable Agri Bonuses button is enabled.
- **Exception:** an **orbital starport** with a **surface colony port** on the same body does **not** get those agriculture buffs on its **own row** — they show on the **strong link** from the surface port.
- **No** icy or tidal **penalties** on the own row (your subordinate surface outpost can show +40% Biological without −40% tidal on the docked row).

### On strong links into this port

- Full **+40% / −40%** table: Biological, Earth-like/Water world, optional Terraformable, icy body, tidal lock to the star, and so on.
- A tidal penalty on a **link** cannot pull that link’s contribution below **+10%**.

### Terraformable what-if toggle

The System page has a top-bar **Terraformable Agri Bonuses** button. It is off by default because current Elite Dangerous market behavior does not appear to apply the expected terraformable agriculture bonus consistently.

Turn it on to preview what agriculture numbers would look like if that in-game behavior is fixed later. The setting is saved in your browser and affects own-row agriculture buffs plus agriculture strong-link formulas.

### On weak links

- Flat **+5%** per farm or agriculture port, up to the port’s agriculture **budget**.

**CMDR intuition:** the number on **your** outpost is “what grows here.” Tide and ice hurt agriculture when it is **linked into another port**, not on your outpost’s own row. Weak links are always a flat +5%.

### Agriculture weak-link budgets

Not every farm in Market Links adds +5%. Each port has a **budget** — how much weak agriculture it can absorb. Tighter budgets when:

- A **strong** agriculture link already comes from the same moon,
- The port sits on **metal-rich** or **icy** rock without being an ag specialist,
- The port is an **orbital cluster** type with many subordinates (budget scales with count),
- The body is a **habitable ag-primary** world with a small colony strong link.

When the budget is full, extra farms may still appear in Market Links but the audit shows **Skipped weak link … cap reached**. A typical default cap is **90%** from weak links alone (eighteen +5% steps) before other rules tighten it.

---

## Refinery, Industrial, and Extraction in Pristine systems

In **Pristine** or **Major** systems, resource level matters in **two places**:

| Where | +40% Pristine (or −40% Depleted) |
|-------|----------------------------------|
| Port’s **own** refinery/industrial/extraction from the planet | Once, on that row |
| **Each strong link** that adds refinery/industrial/extraction (hub, settlement, paired port) | Again, **per link** |

Example — **orbital starport** on a **rocky moon** in a **Pristine** system:

| Ledger line | Amount |
|-------------|--------|
| Rocky body → Refinery | +100% |
| Pristine buff on that row | +40% |
| Strong link from same-body surface colony partner | +40% |
| Pristine buff on **that** strong link | +40% |
| Sub-strong from Refinery hub child on the moon | +80% |
| Pristine buff on **that** sub-strong link | +40% |
| **Total Refinery** | **340%** |

**High Tech** and **Tourism** body bonuses on strong links (Biological, black hole in system, etc.) still apply **at most once** per port — unlike Pristine industry, which stacks per strong contribution.

---

## Multiple ports on one body

Frontier’s colonization guidance treats multiple ports per body as a special case. Raven Colonial models it as:

1. **One primary port** per landable body — **orbital** wins over **surface** when both are dockable colony ports.
2. **Subordinate** (converted) ports attach to the primary and **share its weak-link candidates** — they can **receive** weak links the same way the primary would.
3. **Surface colony → orbital colony** strong-links body economies; orbital agriculture buffs may move to the link layer.
4. **Space farms** strong-link the **primary** only; other ports on the moon rely on weak agriculture +5% steps.

Extra ports on one body are awkward in-game; the model reflects **primary** vs **subordinate** behavior separately.

---

## Facilities you’ll build often

| Facility | Effect on your ports |
|----------|----------------------|
| **Relay** | High Tech +5% weak link to ports on **other bodies** (starport rule above) |
| **Security post** | Military +5% weak link to ports on **other bodies** |
| **Space farm** | Strong Agriculture on the local primary; weak Agriculture to other bodies if not anchored to a port on the same body |
| **Refinery / Industrial hub** | Strong link of that type into the body primary |
| **Comms** | Unlocks **140%** High Tech on a science hub when operational on the body or a parent body in the chain |
| **Military hub** | Strong Military locally; does **not** weak-link outward |

---

## Documented rules vs fine-tuning

**Documented rules** come from community colonization references (Mega Guide, Update 3): body tables, strong/weak sizes by **tier**, subordinate behavior, agriculture’s three-path model, relay and security scope.

**Fine-tuning** in Raven Colonial fits observed markets where public docs are silent: agriculture weak-link **budgets**, some settlement floors, and a few colony presets. Spansh-verified systems are used to keep those knobs honest.

**Known nuance:** Low/Depleted **penalties** on industry still apply on the port’s **own** industry row today; they may eventually match agriculture (penalties on strong links only).

---

## Reading the economy table

Each audit line is one ledger entry: `+40 Buff: body has BIO`, `+80 Apply sub-strong link from: …`, `+5 Apply weak link from: …`.

Add the lines for an economy type to get the displayed percentage (**145%** = 1.45 in data).

**Primary economy** = whichever type totals highest after all steps (what the game treats as the station’s main tag).

---

## Scenarios worth knowing

| Situation | What to expect |
|-----------|----------------|
| **Gas-giant moons + ornamental starport** | Relay may show in links but not add High Tech on a starport with no High Tech row; agriculture weak links from subordinates; security Military from another body; sibling-moon farm strong-links the **primary** only |
| **Tidal moon with surface + orbital ports** | Surface/orbital colony pair; relay High Tech after another weak source sorts first; Pristine refinery stacking per strong link |
| **Port on the central star** | Military (or similar) on the **own row**; weak links **outward** are agriculture-only from that primary |

---

## Quick reference

| Question | Answer |
|----------|--------|
| How big is a weak link? | Always **+5%** |
| How big is a strong link? | **+40% / +80% / +120%** by source **construction tier** (T1 / T2 / T3) |
| Does tide hurt my outpost’s Ag % on its own row? | **No** −40% on own row; **yes** on strong links into other ports |
| Does Pristine help Refinery twice? | **Yes** — on the body row and on **each** Refinery strong link |
| Does a relay always add High Tech? | On **outposts**, yes. On **starports**, only if High Tech is already > 0% when the relay is processed. **Never** +5% to ports on the **same body** as the relay |
| Who gets Military weak link from security? | Ports on **other bodies** only |
| What weak links does a star-body primary send? | **Agriculture only** — Military and other rows stay on the port’s own market |
| Does a farm on another moon strong-link my outpost? | **No** — strong link goes to that moon’s **primary** port only |
| What weak links do subordinate ports send? | Their **primary economy** only (+5% each), not every row on the market |

For modifier tables, budget rules, and code ownership, see [economy-model.md](./economy-model.md).
