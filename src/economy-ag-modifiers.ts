import { EconomyMap } from "./site-data";
import {
  EconomyModelOptions,
  STRONG_LINK_CONTRIBUTION_FLOOR,
  adjust,
  bodyIsTidalToStar,
  matches,
} from "./economy-core";
import type { SiteMap2 } from "./system-model2";
import { BodyFeature } from "./types";
import { BT } from "./types2";

export interface AgricultureModifierOptions {
  enableTerraformableBonus?: boolean;
  skipElWwForSameBodyColonySource?: boolean;
}

interface AgricultureModifierContext {
  site: SiteMap2;
  options?: AgricultureModifierOptions;
  sourceSite?: SiteMap2;
}

interface AgricultureBodyModifierRule {
  delta: number;
  formulaPart: string;
  auditReason?: string;
  applies: (ctx: AgricultureModifierContext) => boolean;
}

export const isSameBodyElwWwColonySource = (source: SiteMap2 | undefined, site: SiteMap2): boolean => {
  return !!source &&
    source.body === site.body &&
    source.type.inf === 'colony' &&
    matches([BT.elw, BT.ww], site.body?.type);
};

/** Documented ±0.4 agriculture body modifiers (community sheet / ED colonization spec). */
export const AGRICULTURE_BODY_MODIFIER_RULES: AgricultureBodyModifierRule[] = [
  {
    delta: 0.4,
    formulaPart: 'BIO 0.4',
    auditReason: 'Buff: body has BIO',
    applies: ({ site }) => matches([BodyFeature.bio], site.body?.features),
  },
  {
    delta: 0.4,
    formulaPart: 'TERRAFORMABLE 0.4',
    applies: ({ site, options }) =>
      !!options?.enableTerraformableBonus &&
      matches([BodyFeature.terraformable], site.body?.features),
  },
  {
    delta: 0.4,
    formulaPart: 'ELW/WW 0.4',
    auditReason: 'Buff: body is ELW or WW',
    applies: ({ site, options, sourceSite }) => {
      if (options?.skipElWwForSameBodyColonySource && isSameBodyElwWwColonySource(sourceSite, site)) {
        return false;
      }
      return matches([BT.elw, BT.ww], site.body?.type);
    },
  },
  {
    delta: -0.4,
    formulaPart: 'ICY/ROCKY-ICE 0.4',
    auditReason: 'Buff: body is ICY/ROCKY-ICE',
    applies: ({ site }) => matches([BT.ib, BT.ri], site.body?.type),
  },
  {
    delta: -0.4,
    formulaPart: 'TIDAL 0.4',
    auditReason: 'Buff: body has TIDAL',
    applies: ({ site }) => bodyIsTidalToStar(site.sys, site.body),
  },
];

export function getAgricultureBodyModifierDeltas(
  site: SiteMap2,
  options?: AgricultureModifierOptions,
  sourceSite?: SiteMap2,
) {
  const ctx: AgricultureModifierContext = { site, options, sourceSite };
  return AGRICULTURE_BODY_MODIFIER_RULES
    .filter(rule => rule.applies(ctx))
    .map(({ delta, formulaPart, auditReason }) => ({ delta, formulaPart, auditReason }));
}

export function applyAgricultureBodyBuffs(
  map: EconomyMap,
  site: SiteMap2,
  adjustFn: typeof adjust,
) {
  if (map.agriculture <= 0) { return; }

  for (const { delta, auditReason } of getAgricultureBodyModifierDeltas(site)) {
    if (auditReason) {
      adjustFn('agriculture', delta, auditReason, map, site, 'body');
    }
  }

  if (matches([BT.elw, BT.ww], site.body?.type) && map.agriculture < 1) {
    adjustFn(
      'agriculture',
      1 - map.agriculture,
      'Floor: body type agriculture cannot drop below 1.0',
      map,
      site,
      'body',
    );
  }
}

export function calculateAgricultureStrongLinkContribution(
  sourceValue: number,
  site: SiteMap2,
  options?: EconomyModelOptions,
  sourceSite?: SiteMap2,
) {
  if (sourceValue <= 0) {
    return { score: 0, formula: '0.0' };
  }

  const parts = [`${sourceValue.toFixed(1)}`];
  let score = sourceValue;

  for (const { delta, formulaPart } of getAgricultureBodyModifierDeltas(site, {
    enableTerraformableBonus: options?.enableTerraformableAgricultureBonus ?? false,
    skipElWwForSameBodyColonySource: true,
  }, sourceSite)) {
    score += delta;
    parts.push(`${delta >= 0 ? '+' : '-'} ${formulaPart}`);
  }

  if (score <= 0) {
    parts.push(`=> floor ${STRONG_LINK_CONTRIBUTION_FLOOR.toFixed(1)}`);
    score = STRONG_LINK_CONTRIBUTION_FLOOR;
  }

  return {
    score: Math.round(score * 100) / 100,
    formula: `${parts.join(' ')} = ${score.toFixed(1)}`,
  };
}
