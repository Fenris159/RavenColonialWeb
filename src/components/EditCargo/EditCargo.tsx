import './EditCargo.css';

import { ActionButton, Dropdown, Icon, IconButton, IDropdownOption, Label, SelectableOptionMenuItemType, Stack } from '@fluentui/react';
import { Component, CSSProperties } from 'react';
import { CommodityIcon } from '..';
import { store } from '../../local-storage';
import { appTheme, cn } from '../../theme';
import { Cargo, mapCommodityNames, SortMode } from '../../types';
import { delayFocus, flattenObj, getGroupedCommodities, iconForSort, nextSort, parseIntLocale, sumCargo } from '../../util';
import { EconomyBlock } from '../EconomyBlock';
import { mapName } from '../../site-data';

interface EditCargoProps {
  /** Counts of cargo */
  cargo: Cargo;
  /** Max values of cargo */
  maxCounts?: Cargo;
  /** Names of cargo items valid to be added */
  validNames?: string[];
  /** Names of cargo that have been marked as ready */
  readyNames?: string[];

  sort?: SortMode;
  noAdd?: boolean;
  noDelete?: boolean;
  showTotalsRow?: boolean;
  fcOwner?: boolean;

  /** Show the add button below the table, vs next to the sort order button */
  addButtonBelow?: boolean;
  /** Show the add button above the table, vs next to the sort order button */
  addButtonAbove?: boolean;

  onChange?: (cargo: Cargo) => void;
}

interface EditCargoState {
  cargo: Cargo;
  canAddMore: boolean;
  sort: SortMode;
  newCargo?: string;
  textEditing?: string;
}

export class EditCargo extends Component<EditCargoProps, EditCargoState> {
  private cargoNames: string[];
  private firstKey?: string;

  constructor(props: EditCargoProps) {
    super(props);

    // limit to the given names, or all relevant commodities if not
    this.cargoNames = props.validNames ?? Object.keys(mapCommodityNames).slice(0, -4) // exclude the last 4 prior-error commodities
    this.cargoNames.sort();

    this.state = {
      cargo: props.cargo,
      canAddMore: this.getCanAddMore(props, props.cargo),
      sort: props.sort ?? store.commoditySort,
    };
  }

  getCanAddMore(props: EditCargoProps, cargo: Cargo): boolean {
    return !props.noAdd && this.cargoNames.filter(k => !(k in cargo)).length > 0;
  }

  componentDidMount(): void {
    // force focus onto the first input field, if known
    if (this.firstKey) {
      delayFocus(this.firstKey);
    }
  }

  componentDidUpdate(prevProps: Readonly<EditCargoProps>, prevState: Readonly<EditCargoState>, snapshot?: any): void {
    // broadcast change if the total count has changed
    if (this.props.onChange && sumCargo(prevState.cargo) !== sumCargo(this.state.cargo)) {
      this.props.onChange(this.state.cargo);
    }

    // if there's nothing left to be added - hide the `Add` button
    const oldCount = Object.keys(prevState.cargo);
    const newCount = Object.keys(this.state.cargo);
    if (oldCount.length !== newCount.length) {
      const canAddMore = this.getCanAddMore(this.props, this.state.cargo);
      this.setState({ canAddMore });
    }

    // if there's no rows to render - force adding
    if (newCount.length === 0 && this.state.newCargo !== '') {
      this.setState({ newCargo: '' });
    }

    // accept new cargo from Props if not a reference we know
    const cargoHasChanged = this.state.cargo !== this.props.cargo && prevProps.cargo !== this.props.cargo;
    if (cargoHasChanged) {
      this.setState({
        cargo: this.props.cargo
      });
    }
  }

  updateCargoState(func: (cargoUpdate: Cargo) => void, extra?: Partial<EditCargoState>): void {
    // pull from state, change it then push to state
    const cargoUpdate = { ...this.state.cargo };
    func(cargoUpdate);
    this.setState({
      ...extra as EditCargoState,
      cargo: cargoUpdate,
    });
  }

  render() {
    const { cargo, sort, canAddMore, newCargo, textEditing } = this.state;
    const { addButtonBelow, addButtonAbove, showTotalsRow: totalsRow } = this.props;

    const hasCargoRows = Object.values(cargo).length > 0;

    const showAddNew = newCargo !== undefined;

    return <div className='edit-cargo'>
      {!showAddNew && canAddMore && addButtonAbove && !textEditing && <>
        <ActionButton
          text='Add commodity?'
          iconProps={{ iconName: 'Add' }}
          onClick={() => {
            this.setState({ newCargo: '' });
            delayFocus('new-cargo');
          }}
        />

        <IconButton
          className={cn.bBox}
          title='Edit all as text'
          iconProps={{ iconName: 'NumberField' }}
          onClick={() => {
            const txt = Object.keys(cargo).sort().map(k => `${mapCommodityNames[k] ?? k} ${cargo[k]}`).join(`\n`);
            this.setState({ textEditing: txt })
          }}
        />
      </>}

      {!textEditing && <>
        {!hasCargoRows && <Label>No known cargo. Please add ...</Label>}

        {showAddNew && this.renderAddNew()}

        {hasCargoRows && <table cellSpacing={0}>
          <thead>
            <tr>

              <th className='name'>
                <Stack horizontal tokens={{ childrenGap: 4, padding: 0, }} >

                  <span>Commodity:</span>

                  {/* Toggle sort order button */}
                  <ActionButton
                    className='icon-btn'
                    title={sort}
                    text={sort}
                    iconProps={{ iconName: iconForSort(sort) }}
                    tabIndex={0}
                    style={{ color: appTheme.palette.themePrimary }}
                    onClick={() => {
                      const newSort = nextSort(sort);
                      this.setState({ sort: newSort });
                      store.commoditySort = newSort;
                    }}
                  />

                  {/* Add new items button */}
                  {canAddMore && !addButtonBelow && !addButtonAbove && <ActionButton
                    className='icon-btn'
                    title='Add a new cargo item'
                    text='Add'
                    iconProps={{ iconName: 'Add' }}
                    style={{ color: appTheme.palette.themePrimary }}
                    onClick={() => {
                      this.setState({ newCargo: '' });
                      delayFocus('new-cargo');
                    }}
                  />}
                </Stack>
              </th>

              <th className='amount'>Amount:</th>
            </tr>
          </thead>

          <tbody>
            {this.renderRows()}
          </tbody>

          {totalsRow && this.renderTotalsRow()}
        </table>}
      </>}

      {!showAddNew && canAddMore && (addButtonBelow || !hasCargoRows) && <ActionButton
        text='Add commodity?'
        iconProps={{ iconName: 'Add' }}
        onClick={() => {
          this.setState({ newCargo: '' });
          delayFocus('new-cargo');
        }}
      />}

      {!!textEditing && <div>

        <IconButton
          className={cn.bBox}
          title='Copy to clipboard'
          iconProps={{ iconName: 'Copy' }}
          style={{ width: 24, height: 24, margin: '8px 0' }}
          onClick={() => navigator.clipboard.writeText(textEditing)}
        />

        <IconButton
          className={cn.bBox}
          title='Paste from clipboard'
          iconProps={{ iconName: 'Paste' }}
          style={{ width: 24, height: 24, margin: '8px 0' }}
          onClick={() => navigator.clipboard.readText().then(txt => this.setState({ textEditing: txt }))}
        />

        <ActionButton
          className={cn.bBox}
          text='Edit as table'
          iconProps={{ iconName: 'BulletedList2Mirrored' }}
          style={{ height: 24, margin: '8px 0' }}
          onClick={() => this.setState({ textEditing: undefined })}
        />

        <textarea
          value={textEditing}
          onChange={(ev) => {
            this.parseEdittedText(ev.target.value);
          }}
          style={{
            width: 325,
            height: 425,
            backgroundColor: appTheme.palette.white,
            color: appTheme.palette.black,
            border: '1px solid ' + appTheme.palette.black,
          }}
        />
      </div>}

    </div>;
  }

  parseEdittedText(txt: string) {
    if (txt === this.state.textEditing) { return; }

    let newCargo: Cargo | undefined = {};
    try {
      const lines = txt.split(`\n`);
      for (const line of lines) {
        let idx = line.lastIndexOf(' ');
        if (idx <= 0) {
          newCargo = undefined;
          break;
        }
        let key = line.slice(0, idx).trim();
        if (!(key in mapCommodityNames)) {
          const match = Object.keys(mapCommodityNames).find(k => mapCommodityNames[k].toLowerCase() === key.toLowerCase());
          if (match) {
            key = match;
          } else {
            // skip it
            console.warn(`Unexpected: ${key}`);
            continue;
          }
        }
        const v = parseIntLocale(line.slice(idx + 1).trim() || '0');
        if (isNaN(v)) {
          newCargo = undefined;
          break;
        }
        newCargo[key] = v;
      }
    } catch (err) {
      console.error(err);
    }

    if (newCargo) {
      this.setState({ cargo: newCargo, textEditing: txt });
    } else {
      this.setState({ textEditing: txt });
    }
  }

  renderRows() {
    const { cargo, sort } = this.state;

    const cargoNames = this.props.fcOwner
      ? Object.keys(cargo) // FC owners should see everything
      : Object.keys(cargo).filter(c => c in mapCommodityNames); // everyone else ... filter out names unrelated to Colonization
    const groupedCargo = getGroupedCommodities(cargoNames, sort);
    const groupsAndCommodityKeys = flattenObj(groupedCargo);

    let flip = true;
    return groupsAndCommodityKeys.map(key => {
      return key in groupedCargo
        ? this.renderGroupRow(key, sort)
        : this.renderItemRow(key, flip = !flip);
    });
  }

  renderGroupRow(key: string, sort: SortMode) {
    const colorBlock = sort === SortMode.econ ? <div><EconomyBlock economy={key} /></div> : null;
    const txt = sort === SortMode.econ
      ? key.split(',').map(t => mapName[t] ?? '??').join(' / ')
      : key;

    return sort === SortMode.alpha
      ? undefined
      : <tr
        key={`group-${key}`}
        className='group'
        style={{
          background: appTheme.palette.themeDark,
          color: appTheme.palette.themeLighter
        }}
      >
        <td colSpan={3}>
          <Stack horizontal verticalAlign='center'>
            {colorBlock}
            <div className='hint'>{txt}</div>
          </Stack>
        </td>
      </tr>;
  }

  renderItemRow(key: string, flip: boolean) {
    const { cargo } = this.state;
    const { noDelete, maxCounts, readyNames } = this.props;

    const displayName = mapCommodityNames[key] ?? key;
    const isReady = readyNames && readyNames.includes(key)
      ? <Icon iconName='SkypeCircleCheck' title={`${displayName} is ready`} />
      : undefined;

    // if we have max values
    let maxValue = maxCounts && maxCounts[key];
    if (maxValue) { Math.min(maxValue, store.cmdr?.largeMax ?? 800) }

    // different colour per row
    const rowStyle: CSSProperties | undefined = flip ? undefined : { background: appTheme.palette.themeLighter };

    if (!this.firstKey) {
      this.firstKey = `edit-${key}`;
    }

    return <tr key={`c-${key}`} style={rowStyle}>
      <td>
        <span style={{ position: 'relative', top: 2 }}><CommodityIcon name={key} /></span> {displayName} {isReady}
      </td>

      <td>
        <input
          id={`edit-${key}`}
          type='number'
          min={0}
          max={maxValue}
          value={cargo[key] === -1 ? '' : cargo[key]}
          style={{
            backgroundColor: appTheme.palette.themeLighterAlt,
            color: appTheme.palette.black,
            border: '1px solid ' + appTheme.palette.accent
          }}
          onChange={(ev) => {
            this.updateCargoState(uc => uc[key] = ev.target.valueAsNumber || 0);
          }}
          onFocus={(ev) => {
            ev.target.type = 'text';
            ev.target.setSelectionRange(0, 10);
            ev.target.type = 'number';
          }}
        />
      </td>

      <td>
        {/* Delete row button */}
        {!noDelete && <Icon
          className='icon-btn'
          title={`Remove ${displayName}`}
          iconName='Delete'
          tabIndex={0}
          style={{ color: appTheme.palette.themePrimary }}
          onClick={() => {
            this.updateCargoState(uc => delete uc[key]);
          }}
        />}

        {/* Add max button - if we have maxCounts */}
        {maxCounts && maxCounts[key] && <ActionButton
          className='icon-btn'
          title='Set amount needed, or ship max'
          iconProps={{ iconName: 'CirclePlus' }}
          onClick={() => {
            this.updateCargoState(uc => uc[key] = Math.min(this.props.maxCounts![key], store.cmdr?.largeMax ?? 800));
            delayFocus(`edit-${key}`);
          }} >
          {maxCounts[key]}
        </ActionButton>}
      </td>
    </tr>;
  }

  renderTotalsRow() {
    const { cargo } = this.state;

    const sumTotal = sumCargo(cargo);
    if (sumTotal < 0) return;

    return <tfoot>
      <tr className='hint'>
        <td className='total-txt'>Total:</td>
        <td className='total-num'>
          <input
            readOnly
            value={sumTotal.toLocaleString()}
            tabIndex={-1}
            style={{ backgroundColor: appTheme.palette.white, color: appTheme.palette.black, border: 0 }}
          />
        </td>
        <td></td>
      </tr>
    </tfoot>;
  }

  renderAddNew() {
    const { cargo, newCargo, sort } = this.state;

    // filter out cargo already in use
    const validNewNames = this.cargoNames.filter(k => !(k in cargo));

    // arrange possible options by the sort order
    const groupedCargo = getGroupedCommodities(validNewNames, sort);
    const groupsAndCommodityKeys = flattenObj(groupedCargo);

    // remove any empty groups
    for (const k in groupedCargo) {
      if (groupedCargo[k].length === 0) {
        delete groupedCargo[k];
      }
    }

    // prepare drop-down options
    const cargoOptions: IDropdownOption[] = [];
    groupsAndCommodityKeys.forEach((k, i) => {
      if (k in groupedCargo) {
        if (sort !== SortMode.alpha) {
          // add divider if not the first group
          if (i > 0) { cargoOptions.push({ key: `d${i}`, text: '', itemType: SelectableOptionMenuItemType.Divider }); }

          cargoOptions.push({ key: k, text: k, itemType: SelectableOptionMenuItemType.Header });
        }
      } else {
        cargoOptions.push({ key: k, text: mapCommodityNames[k] });
      }
    });

    return <Dropdown
      id='new-cargo'
      openOnKeyboardFocus
      placeholder='Choose a commodity...'
      options={cargoOptions}
      selectedKey={newCargo}
      onDismiss={() => this.setState({ newCargo: undefined })}
      onChange={(_, o) => {
        const k = `${o?.key}`;
        this.updateCargoState(uc => uc[k] = 0);
        delayFocus(`edit-${k}`);
      }}
      style={{ margin: '4px 0' }}
      styles={{
        callout: { border: '1px solid ' + appTheme.palette.themePrimary }
      }}
    />;
  }

}
