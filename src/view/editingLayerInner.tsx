import { h, Component } from 'preact';
import { cls } from '../helper/dom';
import { connect } from './hoc';
import { CellValue, RowKey, ColumnInfo, SortState, Filter } from '../store/types';
import { DispatchProps } from '../dispatch/create';
import { CellEditor, CellEditorClass, CellEditorProps } from '../editor/types';
import { keyNameMap } from '../helper/keyboard';
import { getInstance } from '../instance';
import Grid from '../grid';
import { isFunction, findPropIndex, isNull, findProp } from '../helper/common';
import { findIndexByRowKey } from '../query/data';
import { KeyNameMap } from '../types';

interface StoreProps {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  contentHeight?: number;
  columnInfo?: ColumnInfo;
  value?: CellValue;
  grid: Grid;
  sortState: SortState;
  filter?: Filter;
  focusedColumnName: string | null;
  focusedRowKey: RowKey | null;
}

interface OwnProps {
  rowKey: RowKey;
  columnName: string;
}

type Props = StoreProps & OwnProps & DispatchProps;

export class EditingLayerInnerComp extends Component<Props> {
  private editor?: CellEditor;

  private contentEl?: HTMLElement;

  private handleKeyDown = (ev: KeyboardEvent) => {
    const keyName = (keyNameMap as KeyNameMap)[ev.keyCode];

    switch (keyName) {
      case 'enter':
        this.finishEditing(true);
        break;
      case 'esc':
        this.finishEditing(false);
        break;
      default:
      // do nothing;
    }
  };

  private finishEditing(save: boolean) {
    if (this.editor) {
      const { dispatch, rowKey, columnName, sortState, filter } = this.props;
      const value = this.editor.getValue();
      if (save) {
        dispatch('setValue', rowKey, columnName, value);
        const sortIndex = findPropIndex('columnName', columnName, sortState.columns);
        if (sortIndex !== -1) {
          dispatch('sort', columnName, sortState.columns[sortIndex].ascending, true, false);
        }
        if (filter) {
          const { conditionFn, state } = filter;
          dispatch('filter', columnName, conditionFn!, state);
        }
      }
      dispatch('finishEditing', rowKey, columnName, value);
    }
  }

  public componentDidMount() {
    const { grid, rowKey, columnInfo, value, width } = this.props;
    const EditorClass: CellEditorClass = columnInfo!.editor!.type;
    const editorProps: CellEditorProps = { grid, rowKey, columnInfo: columnInfo!, value };
    const cellEditor: CellEditor = new EditorClass(editorProps);
    const editorEl = cellEditor.getElement();

    if (editorEl && this.contentEl) {
      this.contentEl.appendChild(editorEl);
      this.editor = cellEditor;

      const editorWidth = editorEl.getBoundingClientRect().width;

      if (editorWidth > width!) {
        const CELL_PADDING_WIDTH = 10;
        (this.contentEl as HTMLElement).style.width = `${editorWidth + CELL_PADDING_WIDTH}px`;
      }

      if (isFunction(cellEditor.mounted)) {
        cellEditor.mounted();
      }
    }
  }

  public componentWillUnmount() {
    this.finishEditing(false);
    if (this.editor && this.editor.beforeDestroy) {
      this.editor.beforeDestroy();
    }
  }

  public componentWillReceiveProps(nextProps: Props) {
    const {
      focusedColumnName: prevFocusedColumnName,
      focusedRowKey: prevFocusedRowKey
    } = this.props;
    const { focusedColumnName, focusedRowKey } = nextProps;

    if (focusedColumnName !== prevFocusedColumnName || focusedRowKey !== prevFocusedRowKey) {
      this.finishEditing(true);
    }
  }

  public render() {
    const { top, left, width, height, contentHeight } = this.props;
    const lineHeight = `${contentHeight}px`;
    const styles = { top, left, width, height, lineHeight };

    return (
      <div
        style={styles}
        class={cls('layer-editing', 'cell-content', 'cell-content-editor')}
        onKeyDown={this.handleKeyDown}
        ref={el => {
          this.contentEl = el;
        }}
      />
    );
  }
}

export const EditingLayerInner = connect<StoreProps, OwnProps>((store, { rowKey, columnName }) => {
  const { data, column, id, focus, viewport, dimension, columnCoords } = store;
  const { cellPosRect, side, columnName: focusedColumnName, rowKey: focusedRowKey } = focus;
  const { filteredViewData, sortState } = data;
  const state = {
    grid: getInstance(id),
    sortState,
    focusedColumnName,
    focusedRowKey
  };

  if (isNull(cellPosRect)) {
    return state;
  }

  const { cellBorderWidth, tableBorderWidth, headerHeight, width, frozenBorderWidth } = dimension;
  const { scrollLeft, scrollTop } = viewport;
  const { areaWidth } = columnCoords;
  const { allColumnMap } = column;
  const { top, left, right, bottom } = cellPosRect;
  const cellWidth = right - left + cellBorderWidth;
  const cellHeight = bottom - top + cellBorderWidth;
  const offsetTop = headerHeight - scrollTop + tableBorderWidth;
  const offsetLeft = Math.min(areaWidth.L - scrollLeft, width - right);
  const targetRow = filteredViewData[findIndexByRowKey(data, column, id, rowKey)];
  let value, filter;
  if (targetRow) {
    value = targetRow.valueMap[columnName].value;
  }
  if (data.filters) {
    filter = findProp('columnName', columnName, data.filters);
  }

  return {
    ...state,
    left: left + (side === 'L' ? 0 : offsetLeft + frozenBorderWidth),
    top: top + offsetTop,
    width: cellWidth,
    height: cellHeight,
    contentHeight: cellHeight - 2 * cellBorderWidth,
    columnInfo: allColumnMap[columnName],
    value,
    filter
  };
})(EditingLayerInnerComp);
