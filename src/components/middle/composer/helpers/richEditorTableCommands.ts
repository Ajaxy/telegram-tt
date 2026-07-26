import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Command, EditorState, Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import {
  cellAround,
  CellSelection,
  deleteTable,
  moveTableColumn,
  moveTableRow,
  type Rect,
  TableMap,
} from '@tiptap/pm/tables';

import {
  TABLE_CELL_HIGHLIGHT_ATTR,
  TABLE_WRAPPER_NODE_NAME,
} from '../../../../util/tiptap/constants';

type RichEditorTableSelectionKind = 'cell' | 'row' | 'column' | 'table';
export type RichEditorTableMoveAxis = 'row' | 'column';
type RichEditorTableCellAttrName = 'align' | 'verticalAlign';
export type RichEditorTableBooleanAttrName = 'isBordered' | 'isStriped';

type RichEditorTableRect = Pick<Rect, 'left' | 'right' | 'top' | 'bottom'>;

export type RichEditorTableSelection = {
  kind: RichEditorTableSelectionKind;
  table: ProseMirrorNode;
  map: TableMap;
  tablePos: number;
  tableStart: number;
  rect: RichEditorTableRect;
  cellPositions: number[];
  anchorCellPos: number;
  headCellPos: number;
};

type RichEditorTableCellAttr = {
  isUniform: boolean;
  value: unknown;
};

type Dispatch = (transaction: Transaction) => void;

type TableContext = {
  table: ProseMirrorNode;
  map: TableMap;
  tablePos: number;
  tableStart: number;
};

type MoveContext = {
  descriptor: RichEditorTableSelection;
  fromIndex: number;
  count: number;
  dimension: number;
};

export function getRichEditorTableSelection(
  state: EditorState,
  tablePos: number,
): RichEditorTableSelection | undefined {
  const context = getTableContext(state.doc, tablePos);
  if (!context) return undefined;

  const cellRange = getSelectedCellRange(state, context);
  if (!cellRange) return undefined;

  const { anchorCellPos, headCellPos } = cellRange;
  const rect = closeTableRect(context.map, context.map.rectBetween(
    anchorCellPos - context.tableStart,
    headCellPos - context.tableStart,
  ));

  return {
    ...context,
    kind: getSelectionKind(rect, context.map),
    rect,
    cellPositions: context.map.cellsInRect(rect).map((pos) => context.tableStart + pos),
    anchorCellPos,
    headCellPos,
  };
}

export function deleteRichEditorTable(state: EditorState, dispatch?: Dispatch): boolean {
  const { $anchor } = state.selection;
  for (let depth = $anchor.depth; depth > 0; depth--) {
    if ($anchor.node(depth).type.name !== TABLE_WRAPPER_NODE_NAME) {
      continue;
    }

    if (dispatch) {
      const parent = $anchor.node(depth - 1);
      const index = $anchor.index(depth - 1);
      const from = $anchor.before(depth);
      const to = $anchor.after(depth);
      const transaction = parent.canReplace(index, index + 1)
        ? state.tr.delete(from, to)
        : state.tr.replaceWith(from, to, state.schema.nodes.paragraph.create());

      dispatch(transaction.scrollIntoView());
    }

    return true;
  }

  return deleteTable(state, dispatch);
}

export function selectRichEditorTableRect(
  state: EditorState,
  dispatch: Dispatch | undefined,
  tablePos: number,
  rect: RichEditorTableRect,
): boolean {
  const context = getTableContext(state.doc, tablePos);
  if (!context || !isValidRect(rect, context.map)) return false;

  const selection = buildCellSelection(state.doc, context, rect);
  if (!selection) return false;

  dispatch?.(state.tr.setSelection(selection));
  return true;
}

export function selectRichEditorTableAxis(
  state: EditorState,
  dispatch: Dispatch | undefined,
  tablePos: number,
  axis: RichEditorTableMoveAxis,
  from: number,
  to: number,
): boolean {
  const context = getTableContext(state.doc, tablePos);
  if (!context) return false;

  const limit = axis === 'row' ? context.map.height : context.map.width;
  if (!isValidIndexRange(from, to, limit)) return false;

  const selection = buildAxisSelection(state.doc, context, axis, from, to);
  dispatch?.(state.tr.setSelection(selection));
  return true;
}

export function getRichEditorTableCellAttr(
  state: EditorState,
  tablePos: number,
  name: RichEditorTableCellAttrName,
): RichEditorTableCellAttr | undefined {
  const descriptor = getRichEditorTableSelection(state, tablePos);
  if (!descriptor) return undefined;

  const cells = getSelectedCells(descriptor);
  if (!cells.length) return undefined;

  const value = cells[0].attrs[name] ?? undefined;
  return {
    isUniform: cells.every((cell) => (cell.attrs[name] ?? undefined) === value),
    value,
  };
}

export function setRichEditorTableCellAttr(
  state: EditorState,
  dispatch: Dispatch | undefined,
  tablePos: number,
  name: RichEditorTableCellAttrName,
  value: unknown,
): boolean {
  const descriptor = getRichEditorTableSelection(state, tablePos);
  if (!descriptor) return false;

  const cells = getSelectedCells(descriptor);
  if (!cells.length || cells.every((cell) => (cell.attrs[name] ?? undefined) === value)) return false;

  if (dispatch) {
    const transaction = state.tr;
    descriptor.cellPositions.forEach((pos, index) => {
      const cell = cells[index];
      if ((cell.attrs[name] ?? undefined) === value) return;

      transaction.setNodeMarkup(pos, undefined, {
        ...cell.attrs,
        [name]: value,
      });
    });
    dispatch(transaction);
  }

  return true;
}

export function toggleRichEditorTableBooleanAttr(
  state: EditorState,
  dispatch: Dispatch | undefined,
  tablePos: number,
  name: RichEditorTableBooleanAttrName,
): boolean {
  const descriptor = getRichEditorTableSelection(state, tablePos);
  if (descriptor?.kind !== 'table') return false;

  dispatch?.(state.tr.setNodeMarkup(tablePos, undefined, {
    ...descriptor.table.attrs,
    [name]: !descriptor.table.attrs[name],
  }));
  return true;
}

export function canToggleRichEditorTableHighlight(state: EditorState, tablePos: number): boolean {
  return toggleRichEditorTableHighlight(state, undefined, tablePos);
}

export function toggleRichEditorTableHighlight(
  state: EditorState,
  dispatch: Dispatch | undefined,
  tablePos: number,
): boolean {
  const descriptor = getRichEditorTableSelection(state, tablePos);
  if (!descriptor) return false;

  const cells = getSelectedCells(descriptor);
  if (!cells.length) return false;

  const shouldRemoveHighlight = cells.every((cell) => cell.attrs[TABLE_CELL_HIGHLIGHT_ATTR]);
  const isHighlighted = !shouldRemoveHighlight;

  if (dispatch) {
    const transaction = state.tr;
    descriptor.cellPositions.forEach((pos, index) => {
      const cell = cells[index];
      if (Boolean(cell.attrs[TABLE_CELL_HIGHLIGHT_ATTR]) === isHighlighted) return;

      transaction.setNodeMarkup(pos, undefined, {
        ...cell.attrs,
        [TABLE_CELL_HIGHLIGHT_ATTR]: isHighlighted,
      });
    });
    dispatch(transaction);
  }

  return true;
}

export function getRichEditorTableMoveTargets(
  state: EditorState,
  tablePos: number,
  axis: RichEditorTableMoveAxis,
): number[] {
  const descriptor = getRichEditorTableSelection(state, tablePos);
  const moveContext = descriptor && getMoveContext(descriptor, axis);
  if (!moveContext) return [];

  const targets: number[] = [];
  const maxTarget = moveContext.dimension - moveContext.count;
  for (let target = 0; target <= maxTarget; target++) {
    if (isLegalMoveTarget(moveContext, axis, target)) {
      targets.push(target);
    }
  }

  return targets;
}

export function moveRichEditorTableSelection(
  state: EditorState,
  dispatch: Dispatch | undefined,
  tablePos: number,
  axis: RichEditorTableMoveAxis,
  toIndex: number,
): boolean {
  const result = buildMovedTable(state, tablePos, axis, toIndex);
  if (!result) return false;

  if (dispatch) {
    const { count, table } = result;
    const oldTable = state.doc.nodeAt(tablePos)!;
    const transaction = state.tr.replaceWith(tablePos, tablePos + oldTable.nodeSize, table);
    const context = getTableContext(transaction.doc, tablePos)!;
    const selection = buildAxisSelection(transaction.doc, context, axis, toIndex, toIndex + count);

    dispatch(transaction.setSelection(selection));
  }

  return true;
}

function getTableContext(doc: ProseMirrorNode, tablePos: number): TableContext | undefined {
  if (!Number.isInteger(tablePos) || tablePos < 0) return undefined;

  const table = doc.nodeAt(tablePos);
  if (!table || table.type.spec.tableRole !== 'table') return undefined;

  return {
    table,
    map: TableMap.get(table),
    tablePos,
    tableStart: tablePos + 1,
  };
}

function getSelectedCellRange(
  state: EditorState,
  context: TableContext,
): { anchorCellPos: number; headCellPos: number } | undefined {
  const { selection } = state;
  if (selection instanceof CellSelection) {
    const anchorTableStart = selection.$anchorCell.start(-1);
    const headTableStart = selection.$headCell.start(-1);
    if (anchorTableStart !== context.tableStart || headTableStart !== context.tableStart) return undefined;

    return {
      anchorCellPos: selection.$anchorCell.pos,
      headCellPos: selection.$headCell.pos,
    };
  }

  if (!(selection instanceof TextSelection) || !selection.empty) return undefined;

  const $cell = cellAround(selection.$from);
  if (!$cell || $cell.start(-1) !== context.tableStart) return undefined;

  return {
    anchorCellPos: $cell.pos,
    headCellPos: $cell.pos,
  };
}

function getSelectionKind(rect: RichEditorTableRect, map: TableMap): RichEditorTableSelectionKind {
  const isWholeRow = rect.left === 0 && rect.right === map.width;
  const isWholeColumn = rect.top === 0 && rect.bottom === map.height;
  if (isWholeRow && isWholeColumn) return 'table';
  if (isWholeRow) return 'row';
  if (isWholeColumn) return 'column';
  return 'cell';
}

function buildCellSelection(
  doc: ProseMirrorNode,
  context: TableContext,
  rect: RichEditorTableRect,
): CellSelection | undefined {
  const closedRect = closeTableRect(context.map, rect);
  const anchorPos = context.map.positionAt(closedRect.top, closedRect.left, context.table);
  const headPos = context.map.positionAt(closedRect.bottom - 1, closedRect.right - 1, context.table);
  if (anchorPos < 0 || headPos < 0) return undefined;

  return CellSelection.create(doc, context.tableStart + anchorPos, context.tableStart + headPos);
}

function buildAxisSelection(
  doc: ProseMirrorNode,
  context: TableContext,
  axis: RichEditorTableMoveAxis,
  from: number,
  to: number,
): CellSelection {
  const isRow = axis === 'row';
  const rect = closeTableRect(context.map, {
    left: isRow ? 0 : from,
    right: isRow ? context.map.width : to,
    top: isRow ? from : 0,
    bottom: isRow ? to : context.map.height,
  });
  const $anchor = doc.resolve(context.tableStart + context.map.positionAt(rect.top, rect.left, context.table));
  const $head = doc.resolve(context.tableStart + context.map.positionAt(
    rect.bottom - 1, rect.right - 1, context.table,
  ));
  return isRow ? CellSelection.rowSelection($anchor, $head) : CellSelection.colSelection($anchor, $head);
}

function closeTableRect(map: TableMap, rect: RichEditorTableRect): RichEditorTableRect {
  const closedRect = { ...rect };
  let hasChanged = true;

  while (hasChanged) {
    hasChanged = false;
    for (let rowIndex = closedRect.top; rowIndex < closedRect.bottom; rowIndex++) {
      for (let columnIndex = closedRect.left; columnIndex < closedRect.right; columnIndex++) {
        const cellPos = map.map[rowIndex * map.width + columnIndex];
        const cellRect = map.findCell(cellPos);
        const nextLeft = Math.min(closedRect.left, cellRect.left);
        const nextRight = Math.max(closedRect.right, cellRect.right);
        const nextTop = Math.min(closedRect.top, cellRect.top);
        const nextBottom = Math.max(closedRect.bottom, cellRect.bottom);
        hasChanged = hasChanged
          || nextLeft !== closedRect.left
          || nextRight !== closedRect.right
          || nextTop !== closedRect.top
          || nextBottom !== closedRect.bottom;
        closedRect.left = nextLeft;
        closedRect.right = nextRight;
        closedRect.top = nextTop;
        closedRect.bottom = nextBottom;
      }
    }
  }

  return closedRect;
}

function isValidRect(rect: RichEditorTableRect, map: TableMap): boolean {
  return isValidIndexRange(rect.left, rect.right, map.width)
    && isValidIndexRange(rect.top, rect.bottom, map.height);
}

function isValidIndexRange(from: number, to: number, limit: number): boolean {
  return Number.isInteger(from)
    && Number.isInteger(to)
    && from >= 0
    && from < to
    && to <= limit;
}

function getSelectedCells(descriptor: RichEditorTableSelection): ProseMirrorNode[] {
  return descriptor.cellPositions.map((pos) => descriptor.table.nodeAt(pos - descriptor.tableStart)!);
}

function getMoveContext(
  descriptor: RichEditorTableSelection,
  axis: RichEditorTableMoveAxis,
): MoveContext | undefined {
  const isWholeAxis = axis === 'row'
    ? descriptor.rect.left === 0 && descriptor.rect.right === descriptor.map.width
    : descriptor.rect.top === 0 && descriptor.rect.bottom === descriptor.map.height;
  if (!isWholeAxis) return undefined;

  const fromIndex = axis === 'row' ? descriptor.rect.top : descriptor.rect.left;
  const endIndex = axis === 'row' ? descriptor.rect.bottom : descriptor.rect.right;
  const dimension = axis === 'row' ? descriptor.map.height : descriptor.map.width;

  return {
    descriptor,
    fromIndex,
    count: endIndex - fromIndex,
    dimension,
  };
}

function isLegalMoveTarget(
  context: MoveContext,
  axis: RichEditorTableMoveAxis,
  toIndex: number,
): boolean {
  const { count, descriptor, dimension, fromIndex } = context;
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > dimension - count) return false;
  if (toIndex === fromIndex) return false;

  const sourceEnd = fromIndex + count;
  if (!isOpenBoundary(descriptor.map, axis, fromIndex)
    || !isOpenBoundary(descriptor.map, axis, sourceEnd)) {
    return false;
  }

  const targetBoundary = toIndex < fromIndex ? toIndex : toIndex + count;
  return isOpenBoundary(descriptor.map, axis, targetBoundary);
}

function isOpenBoundary(map: TableMap, axis: RichEditorTableMoveAxis, boundary: number): boolean {
  const dimension = axis === 'row' ? map.height : map.width;
  if (boundary <= 0 || boundary >= dimension) return true;

  if (axis === 'row') {
    for (let column = 0; column < map.width; column++) {
      const above = map.map[(boundary - 1) * map.width + column];
      const below = map.map[boundary * map.width + column];
      if (above === below) return false;
    }
    return true;
  }

  for (let row = 0; row < map.height; row++) {
    const before = map.map[row * map.width + boundary - 1];
    const after = map.map[row * map.width + boundary];
    if (before === after) return false;
  }
  return true;
}

function buildMovedTable(
  state: EditorState,
  tablePos: number,
  axis: RichEditorTableMoveAxis,
  toIndex: number,
): { table: ProseMirrorNode; count: number } | undefined {
  const descriptor = getRichEditorTableSelection(state, tablePos);
  if (!descriptor) return undefined;

  const context = getMoveContext(descriptor, axis);
  if (!context || !isLegalMoveTarget(context, axis, toIndex)) return undefined;

  const { count, fromIndex } = context;
  const isMovingBackward = toIndex < fromIndex;
  let movedCount = 0;
  let temporaryState = state;

  while (movedCount < count) {
    const originIndex = isMovingBackward
      ? fromIndex + movedCount
      : fromIndex + count - movedCount - 1;
    const targetIndex = isMovingBackward
      ? toIndex + movedCount
      : toIndex + count - movedCount - 1;
    const command = getMoveCommand(axis, originIndex, targetIndex, tablePos);
    const transaction = runCommand(temporaryState, command);
    if (!transaction) return undefined;

    temporaryState = temporaryState.apply(transaction);
    const movedSelection = getRichEditorTableSelection(temporaryState, tablePos);
    if (!movedSelection) return undefined;

    const currentCount = axis === 'row'
      ? movedSelection.rect.bottom - movedSelection.rect.top
      : movedSelection.rect.right - movedSelection.rect.left;
    if (currentCount <= 0 || movedCount + currentCount > count) return undefined;

    movedCount += currentCount;
  }

  const table = temporaryState.doc.nodeAt(tablePos);
  if (!table || table.type.spec.tableRole !== 'table') return undefined;

  return { table, count };
}

function getMoveCommand(
  axis: RichEditorTableMoveAxis,
  from: number,
  to: number,
  tablePos: number,
): Command {
  const options = {
    from,
    to,
    pos: tablePos + 1,
    select: true,
  };
  return axis === 'row' ? moveTableRow(options) : moveTableColumn(options);
}

function runCommand(state: EditorState, command: Command): Transaction | undefined {
  let transaction: Transaction | undefined;
  const isHandled = command(state, (nextTransaction) => {
    transaction = nextTransaction;
  });

  return isHandled ? transaction : undefined;
}
