import { ActionButton, Callout, DefaultButton, DirectionalHint, Icon, IconButton, Link, mergeStyles, Panel, PanelType, Stack } from "@fluentui/react";
import { Component, CSSProperties, FunctionComponent } from "react";
import { appTheme, cn } from "../../theme";
import { asPosNegTxt, isMobile } from "../../util";
import { hasPreReq2, isTypeValid2, SiteMap2, SiteTypeValidity, sumTierPoints, SysMap2, TierPoints } from "../../economy/system-model2";
import { getSiteType } from "../../site-data";
import { TierPoint } from "../../components/TierPoints";
import { App } from "../../App";
import { applySpanshInversionReorder, getSpanshInversionSwapCount, type SpanshInversionHint, type SpanshInversionHints } from "../../economy/compare/spansh-inversion-detect";
import { getActivePrimaryId, groupAllSitesByBodyWithPlansLast, groupCompletedSitesByBody, groupSitesByActiveCut, groupSitesByBody, isBelowCutLineOnly } from "./build-order-sort";

const onMobile = isMobile();

const ts = mergeStyles({
  "th": {
    borderBottom: `1px solid ${appTheme.palette.purpleDark}`,
    borderRight: `1px solid ${appTheme.palette.purpleDark}`,
  },
  "td": {
    padding: '0 4px',
  },
  ".cc": {
    textAlign: 'center',
  },
  ".cr": {
    textAlign: 'right',
  },
  ".dc": {
    cursor: 'default',
  },
} as Record<string, CSSProperties>);

const icb = mergeStyles({
  width: 20,
  height: 20,
});

interface BuildOrderProps {
  sysMap: SysMap2;
  orderIDs: string[];
  useIncomplete: boolean;
  spanshInversionHints?: SpanshInversionHints;
  onUseIncompleteChange?: (useIncomplete: boolean, orderIDs?: string[], cutoffIdx?: number) => void;
  onClose: (orderIDs: string[] | undefined, cutoffIdx: number | undefined, useIncomplete?: boolean) => void
};

interface BuildOrderState {
  map: Record<string, SiteMap2>
  sortedIDs: string[];
  dragId: string | undefined;
  dragging: boolean;
  tierPoints: TierPoints;
  totalTierPoints: TierPoints;
  targetId?: string;
  targetValidity?: SiteTypeValidity,
  cutoffIdx: number;
  calcIds: string[];
  invalidOrdering: boolean;
  useIncomplete: boolean;
}

export class BuildOrder extends Component<BuildOrderProps, BuildOrderState> {

  constructor(props: BuildOrderProps) {
    super(props);

    this.state = this.createStateFromProps(props);
  }

  componentDidUpdate(prevProps: BuildOrderProps) {
    if (
      prevProps.sysMap !== this.props.sysMap ||
      prevProps.orderIDs !== this.props.orderIDs ||
      prevProps.useIncomplete !== this.props.useIncomplete
    ) {
      this.setState(this.createStateFromProps(this.props));
    }
  }

  createStateFromProps(props: BuildOrderProps): BuildOrderState {
    const map = props.sysMap.siteMaps.reduce((m, site) => {
      m[site.id] = site;
      return m;
    }, {} as Record<string, SiteMap2>);

    const initialOrder = props.useIncomplete
      ? groupSitesByActiveCut(map, props.orderIDs, props.sysMap.calcIds)
      : groupCompletedSitesByBody(map, props.orderIDs);
    const cutoffIdx = initialOrder.cutoffIdx;
    const sortedIDs = initialOrder.sortedIDs;
    const calcIds = this.getNewCalcIDs(map, sortedIDs, cutoffIdx);

    const sortedSiteMaps = sortedIDs.map(id => map[id]);
    const primaryId = props.sysMap.primaryPortId ?? getActivePrimaryId(map, sortedIDs);
    const { tierPoints } = sumTierPoints(sortedSiteMaps, calcIds, undefined, primaryId);
    const { tierPoints: totalTierPoints } = sumTierPoints(sortedSiteMaps, this.getModeTotalCalcIDs(map, sortedIDs, props.useIncomplete), undefined, primaryId);

    return {
      map: map,
      sortedIDs: sortedIDs,
      dragId: undefined,
      dragging: false,
      tierPoints: tierPoints,
      totalTierPoints: totalTierPoints,
      cutoffIdx: cutoffIdx,
      calcIds: calcIds,
      invalidOrdering: !props.useIncomplete && this.isOrderingInvalid(map, sortedIDs),
      useIncomplete: props.useIncomplete,
    };
  }

  getNewCalcIDs(map: Record<string, SiteMap2>, sortedIDs: string[], cutoffIdx: number) {
    const newCalcIds = sortedIDs.filter((id, i) => {
      const site = map[id];
      if (isBelowCutLineOnly(site)) { return false; }
      return cutoffIdx < 0 ? site.status === 'complete' : i < cutoffIdx;
    });
    return newCalcIds;
  }

  getModeTotalCalcIDs(map: Record<string, SiteMap2>, sortedIDs: string[], useIncomplete: boolean) {
    return sortedIDs.filter(id => {
      const site = map[id];
      if (!site || site.status === 'demolish' || isBelowCutLineOnly(site)) { return false; }
      return useIncomplete || site.status === 'complete';
    });
  }

  isOrderingInvalid(map: Record<string, SiteMap2>, sortedIDs: string[]) {
    let foundPlanning = false;
    for (const id of sortedIDs) {
      const site = map[id];
      if (site.status === 'plan') {
        foundPlanning = true;
      } else if (foundPlanning) {
        return true;
      }
    }

    return false;
  }

  shiftRow(dragId: string, rowId: string) {
    const { sortedIDs, cutoffIdx } = this.state;

    if (dragId === 'cut') {
      let newCutOffIdx = sortedIDs.indexOf(rowId);
      if (newCutOffIdx === cutoffIdx) {
        newCutOffIdx++;
      }
      this.setNewCalcIDs(sortedIDs, newCutOffIdx || 1);
    } else {
      // filter dragging item out of the list, then insert it ahead of the current row (getting idx before filtering, so we can drag it to the very bottom)
      const idx = sortedIDs.indexOf(rowId);
      const newSorted = sortedIDs.filter(id => id !== dragId);
      newSorted.splice(idx, 0, dragId);

      this.setNewCalcIDs(newSorted, cutoffIdx);
    }
  }

  setNewCalcIDs(newSorted: string[], newCutOffIdx: number, useIncomplete = this.state.useIncomplete) {
    const { map } = this.state;
    const sortedSiteMaps = newSorted.map(id => map[id]);

    const newCalcIds = this.getNewCalcIDs(map, newSorted, newCutOffIdx);

    const primaryId = this.props.sysMap.primaryPortId ?? getActivePrimaryId(map, newSorted);
    const { tierPoints } = sumTierPoints(sortedSiteMaps, newCalcIds, undefined, primaryId);
    const { tierPoints: totalTierPoints } = sumTierPoints(sortedSiteMaps, this.getModeTotalCalcIDs(map, newSorted, useIncomplete), undefined, primaryId);
    this.setState({
      sortedIDs: newSorted,
      tierPoints, totalTierPoints,
      calcIds: newCalcIds,
      cutoffIdx: newCutOffIdx,
      invalidOrdering: !useIncomplete && this.isOrderingInvalid(map, newSorted),
    });
  }

  render() {
    const { map, sortedIDs, dragId, dragging, tierPoints, totalTierPoints, targetId, targetValidity, cutoffIdx, calcIds, invalidOrdering, useIncomplete } = this.state;
    const inversionFixCount = getSpanshInversionSwapCount(this.props.spanshInversionHints);
    const selectedModeButtonStyle: CSSProperties = {
      backgroundColor: appTheme.palette.themeLighterAlt,
      borderColor: appTheme.palette.themePrimary,
    };

    const priorSiteMaps: SiteMap2[] = [];
    const tp: TierPoints = { tier2: 0, tier3: 0 };

    let foundPlanning = false;
    const rows = sortedIDs.map((id, i) => {
      const s = map[id];
      let backgroundColor = i % 2 ? appTheme.palette.neutralLighter : undefined;
      if (dragId === id) {
        backgroundColor = appTheme.palette.blackTranslucent40;
      }
      const validity = isTypeValid2(undefined, s.type, undefined);
      validity.isValid = !s.type.preReq || hasPreReq2(priorSiteMaps, s.type);
      const showValidityHint = !!validity.msg || !!validity?.unlocks;
      priorSiteMaps.push(s);

      const key = `bol${id.substring(1)}${i}`;
      const demolished = s.status === 'demolish';
      const isCutOff = !calcIds.includes(id) || demolished || isBelowCutLineOnly(s);
      const isMarketLinkPrimary = s.body?.surfacePrimary?.id === s.id || s.body?.orbitalPrimary?.id === s.id;
      const inversionHint = this.props.spanshInversionHints?.[s.id];
      const inversionDirection = inversionHint && getSpanshInversionDirection(inversionHint, sortedIDs);
      if (s.status === 'plan') { foundPlanning = true; }

      return <tr
        key={key}
        style={{
          backgroundColor: backgroundColor,
          cursor: onMobile ? 'pointer' : 'row-resize',
          color: isCutOff ? 'grey' : undefined,
        }}
        onMouseOver={ev => {
          if (!onMobile) {
            ev.preventDefault();
            if (!dragging) { this.setState({ dragId: id }); }
          }
        }}
        onMouseDown={ev => {
          if (ev.defaultPrevented) { return; }
          ev.preventDefault();
          if (onMobile) {
            this.setState({ dragId: dragId === id ? undefined : id, targetId: undefined });
          } else {
            this.setState({ dragging: true, dragId: id, targetId: undefined });
          }
        }}
        onMouseUp={ev => {
          if (!onMobile) {
            ev.preventDefault();
            this.setState({ dragging: false, dragId: undefined });
          }
        }}
        onMouseEnter={ev => {
          if (ev.defaultPrevented || onMobile) { return; }
          ev.preventDefault();
          if (ev.buttons > 0 && dragId && id !== dragId) {
            this.shiftRow(dragId, id);
          }
        }}
      >
        <td className={`cr ${cn.br}`} style={{}}>
          {!useIncomplete && foundPlanning && s.status !== 'plan' && <Icon className='icon-inline' style={{ color: appTheme.palette.yellowDark, float: 'left' }} iconName='WarningSolid' title='Planning sites should be ordered last' />}
          <div>{i + 1}</div>
        </td>

        <td style={{ position: 'relative' }}>
          <span style={{ color: isCutOff ? 'grey' : s.status === 'plan' ? appTheme.palette.yellowDark : appTheme.palette.accent, marginRight: 8 }}>
            <Icon iconName={s.type.orbital ? 'ProgressRingDots' : 'GlobeFavorite'} style={{ color: isCutOff ? 'grey' : undefined }} />
            &nbsp;
            {s.name}
          </span>

          <span style={{ fontSize: 12 }}>{getSiteType(s.buildType, true)?.displayName2} ({s.buildType})</span>
          {id === getActivePrimaryId(map, sortedIDs) && <Icon iconName='CrownSolid' style={{ marginLeft: 8 }} title='Primary port' />}
          {isMarketLinkPrimary && <Icon iconName='Link12' style={{ marginLeft: 4, color: isCutOff ? 'grey' : appTheme.palette.themeTertiary, fontSize: 12, position: 'relative', top: 1 }} title='Primary market link' />}
          {s.status === 'plan' && <Icon iconName='WebAppBuilderFragment' style={{ marginLeft: 4, color: appTheme.palette.yellowDark }} className='icon-inline' title='Planned site' />}
          {s.status === 'build' && <Icon iconName='ConstructionCone' style={{ marginLeft: 4, color: appTheme.palette.yellowDark }} className='icon-inline' title='Under construction' />}
          {demolished && <Icon iconName='Broom' style={{ marginLeft: 4, textDecorationLine: 'unset' }} className='icon-inline' title='Demolished' />}
          {inversionHint && inversionDirection && <Icon
            iconName={inversionDirection === 'up' ? 'ChevronUpSmall' : 'ChevronDownSmall'}
            style={{ marginLeft: 4, color: isCutOff ? 'grey' : appTheme.palette.yellow, fontSize: 12, position: 'relative', top: 1 }}
            title={formatSpanshInversionTitle(inversionHint, inversionDirection)}
          />}
          {showValidityHint && !demolished && <IconButton
            id={key}
            className={cn.bBox}
            iconProps={{ iconName: validity.isValid ? 'Info' : 'Warning', style: { fontSize: 14 } }}
            style={{ position: 'absolute', right: 10, width: 20, height: 20, color: validity.isValid ? undefined : appTheme.palette.yellow }}
            onClick={() => {
              this.setState({
                targetId: targetId === key ? undefined : key,
                targetValidity: validity,
              });
            }}
          />}
        </td>

        <td className={`${cn.br}`}>
          <Stack horizontal>
            {(dragId === id || !dragId) && <Icon
              iconName={dragId === id ? 'GripperBarHorizontal' : 'GripperDotsVertical'}
              style={{ cursor: 'row-resize', }}
            />}
          </Stack>
        </td>

        <td className={`cc dc ${cn.br}`}>
          {(!onMobile || dragId !== id) && !demolished && getTierPointsDelta(s, 2, tp, i === 0, isCutOff)}
          {onMobile && dragId === id && i > 0 && <IconButton
            className={`${icb} ${cn.bBox2}`}
            iconProps={{ iconName: 'ChevronUpSmall' }}
            style={{ backgroundColor: appTheme.palette.white, height: 24 }}
            onMouseDown={ev => {
              ev.preventDefault();
              const priorIdx = sortedIDs.indexOf(id);
              if (priorIdx === cutoffIdx) {
                this.shiftRow('cut', dragId);
              } else {
                this.shiftRow(dragId, sortedIDs[priorIdx - 1]);
              }
            }}
          />}
        </td>
        <td className={`cc dc ${cn.br}`}>
          {(!onMobile || dragId !== id) && !demolished && getTierPointsDelta(s, 3, tp, i === 0, isCutOff)}
          {onMobile && dragId === id && i < sortedIDs.length - 1 && <IconButton
            className={`${icb} ${cn.bBox2}`}
            iconProps={{ iconName: 'ChevronDownSmall' }}
            style={{ backgroundColor: appTheme.palette.white, height: 24 }}
            onMouseDown={ev => {
              ev.preventDefault();
              const nextIdx = sortedIDs.indexOf(id);
              if (nextIdx + 1 === cutoffIdx) {
                this.shiftRow('cut', dragId);
              } else {
                this.shiftRow(dragId, sortedIDs[nextIdx + 1]);
              }
            }}
          />}
        </td>

        <td className='cr'>{s.body?.name?.replace(this.props.sysMap.name, '')}</td>
      </tr>;
    });

    // and add a totals row
    rows.push(<tr key='bol-totals' style={{ fontSize: 16 }}>
      <td className={cn.bt} />
      <td className={`${cn.bt} ${cn.br}`} style={{ textAlign: 'right', color: appTheme.palette.themeDark }} colSpan={2}>
        {useIncomplete ? 'All-site points:' : 'Completed-site points:'}
      </td>
      <td className={`cc ${cn.bt} ${cn.br}`} style={{ fontWeight: 'bold', color: totalTierPoints.tier2 < 0 ? appTheme.palette.redDark : appTheme.palette.green }}>
        {asPosNegTxt(totalTierPoints.tier2)}
      </td>
      <td className={`cc ${cn.bt} ${cn.br}`} style={{ fontWeight: 'bold', color: totalTierPoints.tier3 < 0 ? appTheme.palette.redDark : appTheme.palette.green }}>
        {asPosNegTxt(totalTierPoints.tier3)}
      </td>
      <td className={cn.bt} />
    </tr>);

    const brokenBelowIdx = sortedIDs.findIndex(id => isBelowCutLineOnly(map[id]));
    if (brokenBelowIdx >= 0) {
      const stripeBackground = appTheme.palette.neutralLight;
      rows.splice(brokenBelowIdx, 0, <tr
        key='bol-broken-below'
        style={{
          height: 28,
          background: `repeating-linear-gradient(45deg, ${stripeBackground}, ${stripeBackground} 10px, ${appTheme.palette.white} 10px, ${appTheme.palette.white} 20px)`,
          color: appTheme.palette.redDark,
        }}
        title='Rows below this line are excluded from calculations because they have missing or invalid modeling data.'
      >
        <td className={cn.br} />
        <td className={`cc`} colSpan={1}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>BROKEN BELOW</div>
        </td>
        <td className={cn.br}>
          <Icon iconName='WarningSolid' style={{ color: appTheme.palette.redDark }} />
        </td>
        <td className={`cc ${cn.br}`} />
        <td className={`cc ${cn.br}`} />
        <td />
      </tr>);
    }

    // insert CUT LINE row
    if (cutoffIdx >= 0) {
      const stripeBackground = dragId === 'cut' ? appTheme.palette.blackTranslucent40 : appTheme.palette.themeLight;
      const tierPointsBackground = appTheme.palette.white;
      rows.splice(cutoffIdx, 0, <tr
        key='bol-cutoff'
        className="cutRow"
        style={{
          height: 28,
          cursor: onMobile ? 'pointer' : 'row-resize',
          background: `repeating-linear-gradient(45deg, ${stripeBackground}, ${stripeBackground} 10px, ${appTheme.palette.white} 10px, ${appTheme.palette.white} 20px)`,
          color: cutoffIdx === sortedIDs.length ? 'grey' : undefined,
        }}
        onMouseOver={ev => {
          if (!onMobile) {
            ev.preventDefault();
            if (!dragging) { this.setState({ dragId: 'cut' }); }
          }
        }}
        onMouseDown={ev => {
          if (ev.defaultPrevented) { return; }
          ev.preventDefault();
          if (onMobile) {
            this.setState({ dragId: dragId === 'cut' ? undefined : 'cut' });
          } else {
            this.setState({ dragging: true, dragId: 'cut', targetId: undefined });
          }
        }}
        onMouseUp={ev => {
          if (!onMobile) {
            ev.preventDefault();
            this.setState({ dragging: false, dragId: undefined });
          }
        }}
        onMouseEnter={ev => {
          if (ev.defaultPrevented || onMobile || !dragging) { return; }
          ev.preventDefault();
          if (ev.buttons > 0 && dragId && 'cut' !== dragId) {
            this.shiftRow('cut', dragId);
          }
        }}
      >
        <td className={cn.br} />
        <td className={`cc`} colSpan={1}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>CUT LINE</div>
        </td>

        <td className={cn.br} >
          {dragId === 'cut' && <Icon
            iconName='GripperBarHorizontal'
            style={{ cursor: onMobile ? undefined : 'row-resize', }}
          />}
        </td>

        <td className={`cc ${cn.br}`} style={{}}>
          {(!onMobile || dragId !== 'cut') && <div style={{ fontWeight: 'bold', color: tierPoints.tier2 < 0 ? appTheme.palette.red : appTheme.palette.greenLight, backgroundColor: tierPointsBackground }}
          >
            {asPosNegTxt(tierPoints.tier2)}
          </div>}
          {onMobile && dragId === 'cut' && cutoffIdx > 1 && <IconButton
            className={`${icb} ${cn.bBox2}`}
            iconProps={{ iconName: 'ChevronUpSmall' }}
            style={{ backgroundColor: appTheme.palette.white, height: 24 }}
            onMouseDown={ev => {
              ev.preventDefault();
              this.setNewCalcIDs(sortedIDs, cutoffIdx - 1);
            }}
          />}
        </td>
        <td className={`cc ${cn.br}`}>
          {(!onMobile || dragId !== 'cut') && <div style={{ fontWeight: 'bold', color: tierPoints.tier3 < 0 ? appTheme.palette.red : appTheme.palette.greenLight, backgroundColor: tierPointsBackground }}
          >
            {asPosNegTxt(tierPoints.tier3)}
          </div>}
          {onMobile && dragId === 'cut' && cutoffIdx < sortedIDs.length && <IconButton
            className={`${icb} ${cn.bBox2}`}
            iconProps={{ iconName: 'ChevronDownSmall' }}
            style={{ backgroundColor: appTheme.palette.white, height: 24 }}
            onMouseDown={ev => {
              ev.preventDefault();
              this.setNewCalcIDs(sortedIDs, cutoffIdx + 1);
            }}
          />}
        </td>
        <td />

      </tr >)
    }

    return <>
      <Panel
        isOpen
        headerText='Order for calculations:'
        allowTouchBodyScroll={onMobile}
        type={PanelType.custom}
        customWidth='800px'
        styles={{
          overlay: { backgroundColor: appTheme.palette.blackTranslucent40 },
        }}
        onDismiss={(ev) => this.props.onClose(undefined, undefined)}
        onRenderFooterContent={() => <div style={{ marginBottom: 10 }}>
          <Stack horizontal horizontalAlign='end' verticalAlign='center' tokens={{ childrenGap: 10 }}>

            {invalidOrdering && <div style={{ fontSize: 14, color: appTheme.semanticColors.disabledBodyText }}>
              <Icon className='icon-inline' style={{ color: appTheme.palette.yellowDark, marginRight: 4 }} iconName='WarningSolid' />
              Planning sites should be ordered last
            </div>}

            <DefaultButton
              iconProps={{ iconName: 'Accept' }}
              text='Okay'
              style={{ marginLeft: 40 }}
              onClick={() => this.props.onClose(this.state.sortedIDs, this.state.cutoffIdx, this.state.useIncomplete)}
            />
            <DefaultButton
              iconProps={{ iconName: 'Cancel' }}
              text='Cancel'
              onClick={() => this.props.onClose(undefined, undefined)}
            />
          </Stack>
        </div>}
      >
        <div style={{ marginBottom: 8, color: appTheme.palette.themeDark }}>
          Calculations are performed using the following order until the cut line. The primary port should be the first row.
          <br />
          {onMobile && <>Tap any row to adjust it up and down.</>}
          {!onMobile && <>Drag rows up and down to adjust the order.</>}
        </div>

        <Stack horizontal tokens={{ childrenGap: 8 }} style={{ marginBottom: 8 }}>
          {<ActionButton
            className={cn.bBox2}
            style={{ height: 30 }}
            iconProps={{ iconName: 'AutoEnhanceOn' }}
            text='Auto re-order markets'
            disabled={!inversionFixCount}
            title={inversionFixCount
              ? `Apply ${inversionFixCount} recommended market inversion ${inversionFixCount === 1 ? 'swap' : 'swaps'}.\n\nMoves each site marked with a Spansh up/down arrow directly to its recommended partner position. This only changes the highlighted market-link inversion pairs; it does not regroup bodies or recalculate a general site order.`
              : 'No recommended Spansh market inversion movements are currently available. Run Compare audit of the whole system, then check for up/down arrow hints in this panel.'}
            onClick={() => {
              const newSortedIDs = applySpanshInversionReorder(sortedIDs, this.props.spanshInversionHints);
              this.setNewCalcIDs(newSortedIDs, cutoffIdx);
            }}
          />}

          <ActionButton
            className={cn.bBox2}
            style={{ height: 30, ...(!useIncomplete ? selectedModeButtonStyle : {}) }}
            iconProps={{ iconName: 'TestBeaker' }}
            text="Completed sites only"
            title='Set cut line before the first non-complete site'
            onClick={() => {
              const completeOnly = groupCompletedSitesByBody(map, sortedIDs);
              this.setNewCalcIDs(completeOnly.sortedIDs, completeOnly.cutoffIdx, false);
              this.setState({ useIncomplete: false });
              this.props.onUseIncompleteChange?.(false, completeOnly.sortedIDs, completeOnly.cutoffIdx);
            }}
          />

          <ActionButton
            className={cn.bBox2}
            style={{ height: 30 }}
            iconProps={{ iconName: 'Sort' }}
            text='Group by body'
            title='Group sites by body while keeping the primary port first and preserving the cut line'
            onClick={() => {
              const groupedIDs = groupSitesByBody(map, sortedIDs, cutoffIdx);
              this.setNewCalcIDs(groupedIDs, cutoffIdx);
            }}
          />

          <ActionButton
            className={cn.bBox2}
            style={{ height: 30, ...(useIncomplete ? selectedModeButtonStyle : {}) }}
            iconProps={{ iconName: 'TestBeakerSolid' }}
            text='Use all Sites'
            title='Set cut line to the bottom'
            onClick={() => {
              const allSites = groupAllSitesByBodyWithPlansLast(map, sortedIDs);
              this.setNewCalcIDs(allSites, allSites.length, true);
              this.setState({ useIncomplete: true });
              this.props.onUseIncompleteChange?.(true, allSites, allSites.length);
            }}
          />
        </Stack>

        <table className={ts} cellPadding={0} cellSpacing={0} style={{ userSelect: 'none', fontSize: 14, width: '100%' }}>
          <colgroup>
            <col width='40px' />
            <col width='auto' />
            <col width='30px' />
            <col width='36px' />
            <col width='36px' />
            <col width='max-content' />
          </colgroup>

          <thead>
            <tr style={{ fontSize: 16 }}>
              <th >#</th>
              <th colSpan={2} style={{ textAlign: 'left', paddingLeft: 24 }}>Site</th>
              <th title='Tier 2 points'><Icon className="icon-inline" iconName='Product' style={{ color: appTheme.palette.yellow, fontSize: 24 }} /></th>
              <th title='Tier 3 points'><Icon className="icon-inline" iconName='ProductVariant' style={{ color: appTheme.palette.green, fontSize: 24 }} /></th>
              <th style={{ borderRight: 'unset' }}>Body</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>

        <div className='small' style={{ marginBottom: 8 }}>
          Auto re-order markets applies the current Spansh inversion arrow hints only. If a recommended swap looks wrong, please <Link onClick={() => App.showFeedback(`Auto re-order market issue in: ${this.props.sysMap.name}`)}>report errors or issues</Link>
        </div>

        {!!targetId && targetValidity && <Callout
          target={`#${targetId}`}
          directionalHint={DirectionalHint.topRightEdge}
          gapSpace={4}
          styles={{
            beak: { backgroundColor: appTheme.palette.neutralTertiaryAlt, },
            calloutMain: {
              backgroundColor: appTheme.palette.neutralTertiaryAlt,
              color: appTheme.palette.neutralDark,
            }
          }}
          onDismiss={() => this.setState({ targetId: '' })}
        >
          {targetValidity.msg && <Stack horizontal verticalAlign='center'>
            <Icon iconName={targetValidity.isValid ? 'Accept' : 'ChromeClose'} style={{ marginRight: 4, fontWeight: 'bolder', color: targetValidity.isValid ? appTheme.palette.greenLight : appTheme.palette.red }} />
            <span>{targetValidity.msg}</span>
          </Stack>}
          {targetValidity.unlocks && <>
            {targetValidity.unlocks.map(t => {
              return <div>
                <Icon iconName={t.startsWith('System') ? 'UnlockSolid' : 'Unlock'} style={{ marginRight: 4 }} />
                <span>{t}</span>
              </div>;
            })}
          </>}
        </Callout>}
      </Panel>
    </>;
  }
}

export const BothTierPoints: FunctionComponent<{ tier2: number; tier3: number; disable: boolean; fontSize: number; }> = (props) => {
  return <div
    style={{
      marginLeft: 10,
      color: props.disable ? 'grey' : undefined,
      fontSize: props.fontSize
    }}>
    <span style={{ width: 20 }} />
    <span
      className='bubble'
      style={props.tier2 < 0 ? { color: appTheme.palette.red, border: `2px dashed ${appTheme.palette.redDark}` } : { border: '2px dashed transparent' }}
    >
      <TierPoint tier={2} count={props.tier2} disabled={props.disable} />
    </span>
    <span style={{ width: 4 }} />
    <span
      className='bubble'
      style={props.tier3 < 0 ? { color: appTheme.palette.red, border: `2px dashed ${appTheme.palette.redDark}` } : { border: '2px dashed transparent' }}
    >
      <TierPoint tier={3} count={props.tier3} disabled={props.disable} />
    </span>
  </div>;
}

const getTierPointsDelta = (s: SiteMap2, tier: number, tp: TierPoints, first: boolean, isCutOff: boolean) => {
  let p = 0;

  let taxed = false;
  if (s.type.needs.tier === tier && !first) {
    taxed = s.calcNeeds?.count !== s.type.needs.count;
    p = -(s.calcNeeds?.count ?? s.type.needs.count);
  } else if (s.type.gives.tier === tier) {
    p = s.type.gives.count;
  }

  let title = '';
  let deficit = false;
  if (tier === 2) {
    tp.tier2 += p;
    title = `Current total: ${tp.tier2}\n`;
    deficit = s.status === 'plan' && p < 0 && tp.tier2 < 0;
  } else {
    tp.tier3 += p;
    title = `Current total: ${tp.tier3}\n`;
    deficit = s.status === 'plan' && p < 0 && tp.tier3 < 0;
  }

  // exit early if nothing to render
  if (!p) { return null; }

  const style = {} as CSSProperties;
  if (taxed) {
    title = 'Points tax applied.'
    style.color = isCutOff ? appTheme.palette.yellowDark : appTheme.palette.yellow;
    style.fontWeight = 'bold';
  }
  if (deficit) {
    if (taxed) { title += '\n'; }
    const d = tier === 2 ? tp.tier2 : tp.tier3;
    title += `Insufficient points.\nNeed ${asPosNegTxt(-d)} Tier ${tier} points`;
    style.color = isCutOff ? appTheme.palette.redDark : appTheme.palette.red;
    style.fontWeight = 'bold';
  }

  return <span style={style} title={title}>{asPosNegTxt(p)}</span>;
}

const getSpanshInversionDirection = (hint: SpanshInversionHint, sortedIDs: string[]) => {
  const siteIdx = sortedIDs.indexOf(hint.siteId);
  const partnerIdx = sortedIDs.indexOf(hint.swapWithSiteId);
  if (siteIdx < 0 || partnerIdx < 0 || siteIdx === partnerIdx) {
    return undefined;
  }
  const direction = partnerIdx < siteIdx ? 'up' : 'down';
  return direction === hint.direction ? direction : undefined;
};

const formatSpanshInversionTitle = (hint: SpanshInversionHint, direction: 'up' | 'down') => {
  const suggestedAction = direction === 'up'
    ? 'move this site up'
    : 'move this site down';
  return [
    `Possible Spansh inversion with ${hint.swapWithSiteName}.`,
    `Confidence: ${hint.confidence}.`,
    ...hint.reasons.map(reason => `Reason: ${reason}`),
    `Suggested action: ${suggestedAction}, or press Auto re-order markets to apply all current inversion swaps.`,
  ].join('\n');
};
