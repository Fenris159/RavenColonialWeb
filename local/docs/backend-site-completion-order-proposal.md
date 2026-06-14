# Backend: Preserve Site Completion Order for Market-Link Calculations

## Goal

Preserve a more accurate build/completion order for `sites`, because the frontend economy model uses the returned `sites` array order to break ties for same-tier market-link behavior.

This is **not** about Elite Dangerous' fixed system primary port. The system primary port is the first colonisation port and cannot be changed.

This proposal is about the body-local **market-link primary**: the Surface or Orbital port on a body that receives linked market economies.

## Problem

When multiple same-tier Surface or Orbital ports exist on the same body, the game appears to use actual completion/build order to decide which port receives the linked market economies.

Raven currently relies on the stored `sites` array order. If that order reflects site creation/import order instead of real completion order, the frontend can assign market links to the wrong port.

Example:

```text
Stored Raven order:
1. Buhle Territories
2. Zuniga Platform

Effective in-game completion order:
1. Zuniga Platform
2. Buhle Territories
```

In that case, Raven may calculate Buhle as the market-link primary while Spansh/game data shows Zuniga receiving the linked market economies.

## Suggested Backend Behavior

When backend endpoints change a site's status, update the stored `sites` array order at the same time.

Recommended order shape:

```text
completed sites first, in completion order
building sites next, in build-start order
planned sites last
demolished sites last or ignored for calculation
```

### On Complete

When a third-party endpoint marks a site `complete`:

1. Remove that site from its current position in the `sites` array.
2. Insert it after the last existing `complete` site.
3. Save the updated order.

Example:

```text
Before:
Complete A
Complete B
Build Buhle
Build Zuniga
Plan X

If Zuniga completes first:
Complete A
Complete B
Complete Zuniga
Build Buhle
Plan X

If Buhle completes later:
Complete A
Complete B
Complete Zuniga
Complete Buhle
Plan X
```

### On Build

When a third-party endpoint marks a site `build`:

1. Remove that site from its current position.
2. Insert it after existing `complete` and `build` sites.
3. Keep it before planned sites.

### On Website Save

If the website sends explicit `orderIDs` through `/sites` PUT, preserve that exact order as a manual override.

The website already has a Build Order tool. Manual order changes should remain authoritative when intentionally saved by a user.

## Why Backend

The frontend can adjust order when a user changes status in the website, but third-party clients can mark sites as `build` or `complete` through backend APIs.

If the backend does not update ordering during those status transitions, the next `/sites` response will still return the old order, and the frontend will calculate from that stale order.

Handling this in the backend ensures every client path preserves a more game-accurate order.

## Forward-Looking Fix

This should be treated primarily as a forward-looking fix.

Once the backend starts moving sites at the moment their status changes, the stored `sites` array effectively records future build/completion order. However, existing systems may already contain completed sites in the wrong order. If that historical order is already wrong, the backend cannot reliably reconstruct the true in-game completion order from the current site list alone.

For existing data, manual Build Order correction should remain the repair path.

## Completion Timestamps

Completion timestamps would be useful, but they are not required for the minimum viable fix.

Optional future fields could include:

```text
buildStartedAt
completedAt
```

These would help with auditability, debugging, future repair tools, and cases where the stored array order needs to be explained or rebuilt.

However, large amounts of existing site data will not have reliable timestamps. Backfilling timestamps from current site order, site IDs, import order, or guessed completion history would risk creating false confidence.

If timestamps are added, old records should remain unset unless the backend already has trustworthy historical event data.

The minimum viable backend change is still:

```text
update the sites array order when the status transition happens
```

## Expected Benefit

This should reduce market-link mismatches where multiple same-tier Surface or Orbital ports exist on the same body.

It allows the existing frontend calculation logic to make the correct same-tier market-link choice without requiring users to manually repair Build Order after third-party completion updates.

## Related Frontend Cleanup

As part of this work, we should consider removing the website's **Auto re-order sites** button.

That feature attempts to infer a better global order after the fact, but it is not reliable for market-link calculations. The correct order depends on real build/completion history, especially for same-tier Surface or Orbital ports on the same body. Once that history is lost, the frontend cannot safely reconstruct it from the current site list alone.

The feature would only have a chance of working if Raven had fully current, accurate Spansh data for every relevant market and used that data as a comparison target. Even then, it would be expensive and fragile because it would need to test many order permutations against external economy data.

Backend status-transition ordering is simpler and safer:

```text
record the order when the meaningful event happens
instead of trying to guess the order later
```

Since the Auto re-order button does not function reliably and can break calculations, removing it would reduce confusion and encourage users to rely on explicit Build Order edits only when a manual correction is needed.
