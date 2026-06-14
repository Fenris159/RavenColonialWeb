/**
 * Spansh verification helpers shared by dev economy tests.
 *
 * Player-built stations in Spansh use journal marketId prefixes 395*, 396*,
 * 397*, 42*, or 43*. Construction placeholders use other prefixes (e.g. 370*)
 * and must not be compared to RC operational sites.
 *
 * RC complete sites use operational journal IDs (typically >= 4_200_000_001).
 */
export const OPERATIONAL_MARKET_ID_MIN = 4_200_000_001;

/** Player-made marketId in Spansh galaxy dumps (includes pre-operational 395–397 ranges). */
export const isPlayerMadeMarketId = (marketId: number): boolean => {
  const s = String(marketId);
  return (
    s.startsWith("395") ||
    s.startsWith("396") ||
    s.startsWith("397") ||
    s.startsWith("42") ||
    s.startsWith("43")
  );
};

/** True when marketId is a live journal station ID suitable for Spansh comparison. */
export const isOperationalMarketId = (marketId: number | undefined): boolean =>
  typeof marketId === "number" && marketId >= OPERATIONAL_MARKET_ID_MIN;
