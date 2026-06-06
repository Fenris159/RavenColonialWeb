# How colonization economies work

A player-facing guide for **Elite Dangerous** CMDRs using Raven Colonial to plan colonization ports, Odyssey settlements, hubs, and installations. It explains the same model as the [technical economy model](./economy-model.md), but without code terms.

**What you see in Raven Colonial:** every **Surface port**, **Orbital port**, and **settlement** with a market gets a percentage for each economy type: Agriculture, Refinery, Military, High Tech, Tourism, and so on. A value like **225%** means the market has economy strength `2.25` in the data.

Those percentages come from three places:

- The port's **host surface or orbital location**: planet type, moon type, star, asteroid cluster, signals, volcanism, rings, and similar conditions.
- The system's **reserve level**: Pristine, Major, Low, Depleted, etc.
- **Market links** from other completed builds in the system.

**Spansh check:** for completed in-game stations, Raven Colonial can compare its estimate with Spansh market snapshots. Planned and in-progress builds are for what-if planning only.

---

## Surface and Orbital terms

Raven Colonial uses these terms throughout this guide:

| Term | Meaning |
|------|---------|
| **Surface port** | A dockable starport or outpost built on the surface of a landable planet or moon |
| **Orbital port** | A dockable starport or outpost in space, including ports around a planet, moon, star, or asteroid cluster |
| **Settlement** | An Odyssey surface settlement |
| **Hub / installation** | A supporting build such as a relay, security post, space farm, comms installation, refinery hub, or science hub |
| **Primary port** | The main link receiver for a landable surface or orbital location. When both a Surface port and an Orbital port share the same planet or moon, the Orbital port is usually the primary |
| **Subordinate port** | An extra port attached under a primary port or hub |

When this guide says **same surface**, it means builds on the same landable planet or moon. When it says **other surfaces**, it means a different planet or moon in the system.

---

## The big picture

Think of each market row as a ledger. Raven Colonial adds every line that applies, then shows the total.

<div class="economy-flow" role="img" aria-label="Three mechanisms combine into the market percentage">

<div class="economy-flow__sources">

<div class="economy-flow__box economy-flow__box--own">
<p class="economy-flow__title">What the port gets locally</p>
<ul>
<li>Planet, moon, star, or asteroid type</li>
<li>Biological, Geological, Volcanism, Rings, and similar signals</li>
<li>System reserve level for industry economies</li>
</ul>
</div>

<div class="economy-flow__box economy-flow__box--strong">
<p class="economy-flow__title">Strong links - big slices</p>
<ul>
<li>Same-surface hubs and settlements</li>
<li>Surface-to-Orbital port pairs</li>
<li>Some gas-giant cluster farms</li>
</ul>
</div>

<div class="economy-flow__box economy-flow__box--weak">
<p class="economy-flow__title">Weak links - +5% each</p>
<ul>
<li>Relays, medical support, security, farms, and subordinate ports</li>
</ul>
</div>

</div>

<div class="economy-flow__arrows" aria-hidden="true">
<span>v</span><span>v</span><span>v</span>
</div>

<p class="economy-flow__result">Market % on the System Map</p>

</div>

| Mechanism | Typical amount | Do local conditions change it? |
|-----------|----------------|--------------------------------|
| **Local row** | +100%, +50%, or +40% chunks | Yes |
| **Strong link** | +40%, +80%, or +120% per source | Yes, especially Agriculture and Pristine/Major industry |
| **Weak link** | +5% per source | No, weak links stay flat |

**Market Links** shows candidates that can link into a port. For **Agriculture**, not every candidate is always used; the port has a limit on how many distant farm-style +5% links it can absorb.

**Who counts:** by default, only builds marked **Complete** in your colonization log affect the economy model. The **Include incomplete** beaker adds planned and in-progress builds for what-if planning.

---

## What to build for each economy

This is the short CMDR version. The later sections explain the edge cases.

| Goal | Typical helpers |
|------|-----------------|
| **Agriculture** | Biological surfaces, Earth-like / Water worlds, space farms, Agriculture settlements |
| **Refinery / Industrial / Extraction** | Rocky, Rocky-Ice, Icy, HMC, Metal-rich, rings, Geological / Volcanism, refinery / industrial / extraction hubs |
| **High Tech** | Relays, medical installations, scientific settlements/hubs, Ammonia / Earth-like / Biological / Geological surfaces |
| **Military** | Security installations for weak links, military hubs for local strong links, star-based ports |
| **Tourism** | Tourist builds, Earth-like / Water / Ammonia surfaces, Biological / Geological signals, black holes, neutron stars, white dwarfs |

---

## Ports, settlements, hubs, and installations

**Dockable ports** are the main market rows most CMDRs care about. General colony ports use the full model: local row, strong links, weak links, then primary economy selection.

**Surface ports** and **Orbital ports** can behave differently when they share the same planet or moon. If a Surface colony port and an Orbital colony port are both present, the Surface port can push its local economies into the Orbital port as a strong link.

**Specialized ports** start with their specialty:

| Specialized port location | Starting specialty |
|---------------------------|--------------------|
| **Surface** | +50% |
| **Orbital** | +100% |

Examples: Refinery outpost, Tourism starport, Extraction outpost.

**Odyssey settlements** have a shorter path. They get a fixed settlement economy, local buffs, and any settlement floors. Strong and weak links do **not** apply *to* the settlement's own market row, but settlements can still send links outward when the link graph makes them a source.

**Hubs and installations** mostly feed links into ports. If they have their own market economy, Raven Colonial gives them a fixed facility row rather than running the full port model.

---

## How a colony port gets its numbers

1. **Local body or orbital location**

   The port starts with economies from where it is built. Rocky surfaces add Refinery, Metal-rich and HMC surfaces add Extraction, Earth-like worlds add Agriculture / High Tech / Military / Tourism, stars add Military, black holes / neutron stars / white dwarfs add High Tech and Tourism, and so on.

2. **Signals and reserve level**

   Biological and Geological signals add local rows where they apply. In **Pristine** or **Major** systems, Refinery, Industrial, and Extraction can gain **+40%**. In **Low** or **Depleted** systems, those same industry rows can lose **-40%**.

3. **Strong links**

   Same-surface facilities, hub children, settlements, and Surface-to-Orbital port pairs can add large economy slices into a primary port.

4. **Weak links**

   Eligible sources add **+5%** each. Weak links are intentionally small and do not get extra Pristine, Biological, Terraformable, tidal, or icy modifiers.

5. **Primary economy**

   The highest total becomes the port's **primary economy**, which is the main economy tag the game highlights. Other non-zero economies still remain on the market row.

---

## Strong links

Strong links are the main way to specialize a port. They are large because they represent local infrastructure directly feeding the port.

### Strong link size

Strong link size follows **construction tier**, not pad size.

| Source tier | Strong link contribution |
|-------------|--------------------------|
| **T1** | +40% |
| **T2** | +80% |
| **T3** | +120% |

A T2 bio research settlement is a +80% strong-link source even if its pad is small.

### Surface + Orbital pairs

If a Surface colony port and an Orbital colony port share the same planet or moon, the Surface port's local economies can strong-link into the Orbital port.

Agriculture has a special rule here: the Orbital port does not also repeat the same Biological / Earth-like / Water world agriculture buffs on its own row. Those bonuses move onto the strong link from the Surface port.

### Hub children

A hub can bring its children along as **sub-strong** links. For example, a Refinery hub with settlements underneath can show the hub plus each child as strong-link contributors into the primary port.

In a **Pristine** or **Major** system, each Refinery / Industrial / Extraction strong-link contribution can also receive its own +40% reserve boost.

### Gas-giant cluster farms

A space farm on a sibling moon under the same gas giant can strong-link Agriculture into that moon's **primary** port only. If a second port exists on that moon, it gets Agriculture through weak +5% steps instead of the farm's strong link.

---

## Weak links

Weak links are background support from elsewhere in the system. Each applied weak link is **+5%**.

### Who sends weak links

| Sender | What it sends |
|--------|---------------|
| **Relay installation** | High Tech +5% to ports on other surfaces or orbital locations |
| **Medical installation** | High Tech +5% support, and can help relays count for starports |
| **Security installation** | Military +5% to ports on other surfaces or orbital locations |
| **Unanchored space farm** | Agriculture +5% to other surfaces |
| **Subordinate starport / outpost / hub** | Its primary economy only, outward |
| **Primary colony port** | Agriculture outward only |
| **Primary port at the central star** | Agriculture outward only; Military and other local rows stay on that port |
| **Military hub installation** | No weak link; it strong-links Military locally instead |

### Relay and medical High Tech

Relays are straightforward on outposts: if the relay is eligible and it is not on the same surface as the receiver, it adds **+5% High Tech**.

Starports are pickier. A relay adds **+5% High Tech** to a starport only when the starport has a High Tech reason to receive it. That reason can be:

- High Tech already exists on the starport's market row, or
- Another non-relay High Tech weak source is linked, such as a medical installation or eligible science / high-tech support.

If a starport has no High Tech row and no non-relay High Tech support, the relay may still appear in **Market Links**, but it does not add +5% to the economy total.

Relays on the **same surface** as a port do not add the weak +5% High Tech to that port. They can still matter as local strong-link infrastructure where the build rules allow it.

### Security posts

Security installations add **+5% Military** to ports on other surfaces or orbital locations. A security post on the same surface as your port does not add a Military weak link to that port.

### Agriculture from distant stars

A Surface colony with no local Agriculture may accept only **one** Agriculture weak link per distant star's subtree. Farms and Agriculture ports around another star count once for that receiver. Agriculture settlements are exempt from that distant-star cap.

---

## Agriculture

Agriculture is the special case because local agriculture, strong-link agriculture, and weak-link agriculture use different rules.

Observed multi-port setups often look like:

| Port role | Common result |
|-----------|---------------|
| Subordinate Surface port on a Biological tidal moon | About **145%** |
| Paired Orbital primary receiving the Surface port's strong link | About **225%** |

### Local Agriculture row

On the port's own market row:

- Biological signals can add **+100% Agriculture** if the world type does not already grant Agriculture.
- Biological, Earth-like, and Water world conditions can add **+40%** Agriculture buffs.
- The optional **Terraformable Agri Bonuses** button can add a +40% what-if buff.
- Icy and tidal penalties do **not** reduce the port's own local Agriculture row.

Exception: when an Orbital colony port shares a planet or moon with a Surface colony port, the Orbital port skips those positive local Agriculture buffs. They arrive through the Surface-to-Orbital strong link instead.

### Agriculture strong links

Strong-link Agriculture uses the receiver's conditions:

| Receiver condition | Strong-link Agriculture effect |
|--------------------|--------------------------------|
| Biological | +40% |
| Earth-like / Water world | +40% |
| Terraformable toggle enabled | +40% |
| Icy / Rocky-Ice | -40% |
| Tidal to the star | -40% |

A tidal or icy penalty cannot reduce an Agriculture strong link below **+10%**.

### Agriculture weak links

Weak Agriculture is always **+5%** per applied farm, Agriculture port, or Agriculture settlement source. These +5% steps do not receive Biological, Terraformable, icy, tidal, or reserve modifiers.

Not every Agriculture source in **Market Links** is guaranteed to count. Raven Colonial limits how many weak Agriculture links a port can absorb. This limit is shown in the audit as skipped weak links when the cap is reached.

Common reasons for a tighter Agriculture weak-link limit:

- A same-surface Agriculture strong link already exists.
- The receiver is on Metal-rich, HMC, Icy, or Rocky-Ice terrain without being an Agriculture specialist.
- The receiver is an Orbital cluster-style port with several subordinates.
- The receiver is a habitable Agriculture-primary world with a small colony strong link.

A typical default cap is **90%** from weak links alone, which is eighteen +5% links, before tighter rules apply.

### Terraformable Agri Bonuses

The System page has a **Terraformable Agri Bonuses** button. It is off by default because current Elite Dangerous market behavior does not appear to apply the expected Terraformable Agriculture modifier consistently.

Turn it on to preview what Agriculture numbers would look like if that in-game behavior is fixed later. The setting is saved in your browser.

---

## Refinery, Industrial, and Extraction in Pristine systems

In **Pristine** or **Major** systems, reserve level matters in two places:

| Where | Reserve effect |
|-------|----------------|
| Port's local Refinery / Industrial / Extraction row | +40% once |
| Each Refinery / Industrial / Extraction strong link | +40% per strong-link contribution |

In **Low** or **Depleted** systems, the same rows can receive **-40%** instead.

Example: Orbital starport over a rocky moon in a Pristine system.

| Ledger line | Amount |
|-------------|--------|
| Rocky surface gives Refinery | +100% |
| Pristine buff on local row | +40% |
| Strong link from Surface colony partner | +40% |
| Pristine buff on that strong link | +40% |
| Sub-strong link from Refinery hub child | +80% |
| Pristine buff on that sub-strong link | +40% |
| **Total Refinery** | **340%** |

High Tech and Tourism body bonuses on strong links can apply at most once per port calculation. Pristine industry boosts are different: they stack per Refinery / Industrial / Extraction strong-link contribution.

---

## Multiple ports on one surface

Frontier's colonization rules make multiple dockable ports around one planet or moon awkward. Raven Colonial models the behavior this way:

1. There is one **primary** port for that surface. If both a Surface port and an Orbital port are present, the Orbital port usually wins.
2. Extra ports become **subordinates** and share the primary's weak-link candidates.
3. A Surface colony port can strong-link its local economies into the paired Orbital colony port.
4. Space farms strong-link the primary only. Other ports on the same surface use weak Agriculture +5% steps.

---

## Facilities you will build often

| Facility | Effect on ports |
|----------|-----------------|
| **Relay** | High Tech +5% weak link to eligible ports away from the relay's own surface |
| **Medical installation** | High Tech +5% weak support; helps starports qualify for relay High Tech |
| **Security post** | Military +5% weak link to ports away from the security post's own surface |
| **Space farm** | Strong Agriculture into the local or gas-giant-cluster primary; weak Agriculture to other surfaces when unanchored |
| **Refinery / Industrial / Extraction hub** | Strong link of that economy into the primary port |
| **Comms** | Unlocks **140% High Tech** on an Athena science hub when operational at the same location or on a parent planet, gas giant, or star |
| **Military hub** | Strong Military locally; does not weak-link outward |

---

## Documented rules and observed tuning

Most of the model follows community colonization references: body economy tables, +40% / +80% / +120% strong links by tier, +5% weak links, Surface-to-Orbital behavior, Agriculture's split rules, relay scope, and security scope.

Some parts are tuned against observed markets where public guidance is incomplete. The main tuned areas are Agriculture weak-link caps, a few settlement floors, and a small number of observed colony presets.

Known nuance: Low / Depleted industry penalties still apply on a port's local industry row today. Those may eventually move closer to Agriculture's behavior if in-game evidence changes.

---

## Reading the economy table

Each audit line is one ledger entry:

- `+40 Buff: body has BIO`
- `+80 Apply sub-strong link from: ...`
- `+5 Apply weak link from: ...`
- `Skipped weak link from: ... cap reached`

Add the lines for one economy type to get the displayed percentage. For example, **145%** means `1.45` in the market data.

**Primary economy** is whichever economy type has the highest final total.

---

## Scenarios worth knowing

| Situation | What to expect |
|-----------|----------------|
| **Gas-giant moons + ornamental starport** | Relay may show in Market Links but not add High Tech unless the starport has a High Tech row or non-relay High Tech support; sibling-moon farms strong-link the primary only |
| **Surface + Orbital colony pair** | Surface port can strong-link local economies into the Orbital port; Orbital Agriculture buffs may move to the strong-link layer |
| **Pristine rocky moon** | Refinery can stack hard because Pristine applies to the local row and each Refinery strong link |
| **Security on the same surface** | Security does not add Military weak link locally; it supports ports on other surfaces or orbital locations |
| **Port at the central star** | Military can exist on the local row, but weak links sent outward are Agriculture only |

---

## Quick reference

| Question | Answer |
|----------|--------|
| How big is a weak link? | Always **+5%** |
| How big is a strong link? | **+40% / +80% / +120%** by source construction tier |
| Does tide hurt my Surface port's own Agriculture row? | **No** on the local row; **yes** on Agriculture strong links into other ports |
| Does Pristine help Refinery more than once? | **Yes**: once on the local row and once on each Refinery strong link |
| Does a relay always add High Tech? | **Outposts:** usually yes if eligible and not same-surface. **Starports:** only when the starport has High Tech already or another non-relay High Tech support link |
| Do same-surface relays or security posts add weak links? | **No**. Same-surface weak-link processing only applies Agriculture |
| What does a primary colony port send outward? | **Agriculture only** |
| What does a subordinate port send outward? | Its **primary economy** only |
| Does a farm on another gas-giant moon strong-link every port? | **No**. It strong-links that moon's primary port; other ports use weak Agriculture |

For modifier tables, exact caps, and code ownership, see [economy-model.md](./economy-model.md).
