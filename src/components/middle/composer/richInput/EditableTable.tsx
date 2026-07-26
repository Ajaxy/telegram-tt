import type { Command } from '@tiptap/pm/state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  mergeCells,
  splitCell,
  TableMap,
} from '@tiptap/pm/tables';
import type { EditorView } from '@tiptap/pm/view';
import {
  memo, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../../types';
import type { IconName } from '../../../../types/icons';
import type {
  RichEditorTableBooleanAttrName,
  RichEditorTableMoveAxis,
  RichEditorTableSelection,
} from '../helpers/richEditorTableCommands';

import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { TABLE_CELL_HIGHLIGHT_ATTR } from '../../../../util/tiptap/constants';
import {
  canToggleRichEditorTableHighlight,
  deleteRichEditorTable,
  getRichEditorTableCellAttr,
  getRichEditorTableMoveTargets,
  getRichEditorTableSelection,
  moveRichEditorTableSelection,
  selectRichEditorTableAxis,
  selectRichEditorTableRect,
  setRichEditorTableCellAttr,
  toggleRichEditorTableBooleanAttr,
  toggleRichEditorTableHighlight,
} from '../helpers/richEditorTableCommands';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useResizeObserver from '../../../../hooks/useResizeObserver';
import { useStateRef } from '../../../../hooks/useStateRef';

import Icon from '../../../common/icons/Icon';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';
import MenuSeparator from '../../../ui/MenuSeparator';
import NestedMenuItem from '../../../ui/NestedMenuItem';

import styles from './EditableTable.module.scss';

export type EditableTableProps = {
  editorView: EditorView;
  rootElement: HTMLDivElement;
  tableElement: HTMLTableElement;
  colgroupElement: HTMLTableColElement;
  contentElement: HTMLTableSectionElement;
  renderVersion: number;
};

type AxisSegment = {
  index: number;
  start: number;
  size: number;
  clientStart: number;
  clientEnd: number;
};

type SelectionGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type TableLayout = {
  tablePos?: number;
  tableLeft: number;
  tableTop: number;
  tableWidth: number;
  tableHeight: number;
  isBordered: boolean;
  isStriped: boolean;
  isRtl: boolean;
  columns: AxisSegment[];
  rows: AxisSegment[];
  selection?: RichEditorTableSelection;
  selectionGeometry?: SelectionGeometry;
};

type PointerSession = {
  pointerId: number;
  removeListeners: NoneToVoidFunction;
};

type DropTarget = {
  axis: RichEditorTableMoveAxis;
  toIndex: number;
  position: number;
};

type AutoScrollPoint = {
  clientX: number;
  clientY: number;
};

type AlignmentOption = {
  attr: 'align' | 'verticalAlign';
  value?: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
  icon: IconName;
  label: Parameters<ReturnType<typeof useLang>>[0];
};

const SELECTOR_SIZE_REM = 1;
const POINTER_DRAG_THRESHOLD_PX = 4;
const AUTO_SCROLL_EDGE_PX = 32;
const AUTO_SCROLL_STEP_PX = 12;
const EMPTY_LAYOUT: TableLayout = {
  tableLeft: 0,
  tableTop: 0,
  tableWidth: 0,
  tableHeight: 0,
  isBordered: true,
  isStriped: false,
  isRtl: false,
  columns: [],
  rows: [],
};
const ALIGNMENT_OPTION_GROUPS: AlignmentOption[][] = [
  [
    { attr: 'align', value: undefined, icon: 'table-align-left', label: 'RichEditorTableAlignLeft' },
    { attr: 'align', value: 'center', icon: 'table-align-center', label: 'RichEditorTableAlignCenter' },
    { attr: 'align', value: 'right', icon: 'table-align-right', label: 'RichEditorTableAlignRight' },
  ],
  [
    { attr: 'verticalAlign', value: undefined, icon: 'table-align-top', label: 'RichEditorTableAlignTop' },
    { attr: 'verticalAlign', value: 'middle', icon: 'table-align-middle', label: 'RichEditorTableAlignMiddle' },
    { attr: 'verticalAlign', value: 'bottom', icon: 'table-align-bottom', label: 'RichEditorTableAlignBottom' },
  ],
];

const EditableTable = ({
  editorView,
  rootElement,
  tableElement,
  colgroupElement,
  contentElement,
  renderVersion,
}: EditableTableProps) => {
  const scrollerRef = useRef<HTMLDivElement>();
  const gripRef = useRef<HTMLButtonElement>();
  const menuRef = useRef<HTMLDivElement>();
  const pointerSessionRef = useRef<PointerSession>();
  const selectionAxisRef = useRef<RichEditorTableMoveAxis>();
  const autoScrollPointRef = useRef<AutoScrollPoint>();
  const autoScrollCallbackRef = useRef<(point: AutoScrollPoint) => void>();
  const autoScrollFrameRef = useRef<number>();
  const isKeyboardMenuRef = useRef(false);
  const isMountedRef = useRef(true);
  const [layout, setLayout] = useState<TableLayout>(EMPTY_LAYOUT);
  const [dropTarget, setDropTarget] = useState<DropTarget>();
  const [dragPreview, setDragPreview] = useState<SelectionGeometry>();
  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition>();
  const layoutRef = useStateRef(layout);
  const lang = useLang();

  const updateLayout = useLastCallback(() => {
    requestMeasure(() => {
      if (!isMountedRef.current || !rootElement.isConnected || !tableElement.isConnected) {
        return;
      }

      const nextLayout = measureTableLayout(
        editorView,
        rootElement,
        tableElement,
        colgroupElement,
        contentElement,
      );
      if (!nextLayout) {
        return;
      }

      const selectionKind = nextLayout.selection?.kind;
      if (selectionKind === 'row' || selectionKind === 'column') {
        selectionAxisRef.current = selectionKind;
      } else if (selectionKind !== 'table') {
        selectionAxisRef.current = undefined;
      }
      setLayout(nextLayout);
      if (!nextLayout.selection) {
        closeMenu();
      }
    });
  });

  useEffect(() => {
    updateLayout();
  }, [renderVersion, updateLayout]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return undefined;
    }

    const handleScroll = () => {
      closeMenu();
      updateLayout();
    };
    const verticalScroller = rootElement.closest<HTMLElement>('.custom-scroll');
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    verticalScroller?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      verticalScroller?.removeEventListener('scroll', handleScroll);
    };
  }, [closeMenu, rootElement, updateLayout]);

  useEffect(() => {
    if (!isMenuOpen || !isKeyboardMenuRef.current) {
      return;
    }

    requestMeasure(() => {
      menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitemradio"]:not(:disabled), .MenuItem:not(.disabled)',
      )?.focus();
    });
  }, [isMenuOpen]);

  useEffect(() => () => {
    isMountedRef.current = false;
    pointerSessionRef.current?.removeListeners();
  }, []);

  useResizeObserver(scrollerRef, updateLayout);
  const tableRef = useRef<HTMLElement>(tableElement);
  tableRef.current = tableElement;
  useResizeObserver(tableRef, updateLayout);

  function handleScrollerRef(element?: HTMLDivElement) {
    scrollerRef.current = element;
    if (element && tableElement.parentElement !== element) {
      element.appendChild(tableElement);
    }
  }

  const getCurrentSelection = useLastCallback(() => {
    const tablePos = getTablePos(editorView, contentElement);
    return tablePos === undefined ? undefined : getRichEditorTableSelection(editorView.state, tablePos);
  });

  const handleTableSelectorPointerDown = useLastCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const { tablePos, columns, rows } = layoutRef.current;
    if (tablePos === undefined) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    selectionAxisRef.current = undefined;
    selectRichEditorTableRect(editorView.state, editorView.dispatch, tablePos, {
      left: 0,
      right: columns.length,
      top: 0,
      bottom: rows.length,
    });
  });

  function startAxisSelection(
    e: React.PointerEvent<HTMLButtonElement>,
    axis: RichEditorTableMoveAxis,
    index: number,
  ) {
    const currentLayout = layoutRef.current;
    const tablePos = currentLayout.tablePos;
    if (tablePos === undefined) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    selectionAxisRef.current = axis;

    const selection = currentLayout.selection;
    const anchorRect = selection?.map.findCell(selection.anchorCellPos - selection.tableStart);
    const selectionAxis = getSelectionAxis(selection, selectionAxisRef.current);
    const anchor = e.shiftKey && selection && selectionAxis === axis && anchorRect
      ? axis === 'row' ? anchorRect.top : anchorRect.left
      : index;
    selectTableAxis(editorView, tablePos, axis, anchor, index);

    let lastIndex = index;
    startPointerSession(e.pointerId, (pointerEvent) => {
      pointerEvent.preventDefault();
      const segment = findAxisSegment(
        axis === 'row' ? layoutRef.current.rows : layoutRef.current.columns,
        axis === 'row' ? pointerEvent.clientY : pointerEvent.clientX,
      );
      if (!segment || segment.index === lastIndex) {
        return;
      }

      lastIndex = segment.index;
      selectTableAxis(editorView, tablePos, axis, anchor, lastIndex);
    });
  }

  const handleRangePointerDown = useLastCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const selection = getCurrentSelection();
    if (!selection) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    closeMenu();

    const anchorColumn = layoutRef.current.isRtl ? selection.rect.right - 1 : selection.rect.left;
    const anchorPos = selection.map.positionAt(selection.rect.top, anchorColumn, selection.table);
    const anchorRect = selection.map.findCell(anchorPos);
    const startX = e.clientX;
    const startY = e.clientY;
    let lastHeadPos = selection.headCellPos;
    startPointerSession(e.pointerId, (pointerEvent) => {
      pointerEvent.preventDefault();
      const moveX = pointerEvent.clientX - startX;
      const moveY = pointerEvent.clientY - startY;
      if (Math.max(Math.abs(moveX), Math.abs(moveY)) < POINTER_DRAG_THRESHOLD_PX) {
        return;
      }

      const currentLayout = layoutRef.current;
      const row = findAxisSegment(currentLayout.rows, pointerEvent.clientY);
      const column = findAxisSegment(currentLayout.columns, pointerEvent.clientX);
      if (!row || !column) {
        return;
      }

      const headCellPos = selection.tableStart + selection.map.positionAt(
        row.index, column.index, selection.table,
      );
      if (headCellPos === lastHeadPos) {
        return;
      }

      lastHeadPos = headCellPos;
      const headRect = selection.map.findCell(headCellPos - selection.tableStart);
      selectRichEditorTableRect(editorView.state, editorView.dispatch, selection.tablePos, {
        left: Math.min(anchorRect.left, headRect.left),
        right: Math.max(anchorRect.right, headRect.right),
        top: Math.min(anchorRect.top, headRect.top),
        bottom: Math.max(anchorRect.bottom, headRect.bottom),
      });
    });
  });

  const handleGripPointerDown = useLastCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const selection = getCurrentSelection();
    if (!selection) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    isKeyboardMenuRef.current = false;

    if (editorView.state.selection.empty) {
      selectRichEditorTableRect(editorView.state, editorView.dispatch, selection.tablePos, selection.rect);
    }

    const axis = getSelectionAxis(selection, selectionAxisRef.current);
    if (!axis) {
      startPointerSession(e.pointerId, () => undefined, openActionsMenu);
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const previewGeometry = layoutRef.current.selectionGeometry;
    const legalTargets = getRichEditorTableMoveTargets(editorView.state, selection.tablePos, axis);
    let isDragging = false;
    let nextDropTarget: DropTarget | undefined;

    function updateDropTarget(point: AutoScrollPoint) {
      nextDropTarget = buildDropTarget(
        selection!,
        axis!,
        axis === 'row' ? layoutRef.current.rows : layoutRef.current.columns,
        axis === 'row' ? point.clientY : point.clientX,
        legalTargets,
        layoutRef.current.isRtl,
      );
      setDropTarget(nextDropTarget);
    }

    startPointerSession(e.pointerId, (pointerEvent) => {
      pointerEvent.preventDefault();
      const moveX = pointerEvent.clientX - startX;
      const moveY = pointerEvent.clientY - startY;
      const distance = Math.max(Math.abs(moveX), Math.abs(moveY));
      if (!isDragging && distance < POINTER_DRAG_THRESHOLD_PX) {
        return;
      }

      isDragging = true;
      if (previewGeometry) {
        setDragPreview({
          ...previewGeometry,
          left: previewGeometry.left + (axis === 'column' ? moveX : 0),
          top: previewGeometry.top + (axis === 'row' ? moveY : 0),
        });
      }
      const point = { clientX: pointerEvent.clientX, clientY: pointerEvent.clientY };
      updateDropTarget(point);
      startAutoScroll(point, updateDropTarget);
    }, () => {
      setDropTarget(undefined);
      setDragPreview(undefined);
      if (!isDragging) {
        openActionsMenu();
        return;
      }

      if (nextDropTarget) {
        moveRichEditorTableSelection(
          editorView.state,
          editorView.dispatch,
          selection.tablePos,
          axis,
          nextDropTarget.toIndex,
        );
      }
    }, () => {
      setDropTarget(undefined);
      setDragPreview(undefined);
    });
  });

  const handleGripClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  });

  const handleGripKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    e.preventDefault();
    const selection = getCurrentSelection();
    if (selection && editorView.state.selection.empty) {
      selectRichEditorTableRect(editorView.state, editorView.dispatch, selection.tablePos, selection.rect);
    }
    isKeyboardMenuRef.current = true;
    openActionsMenu();
  });

  const openActionsMenu = useLastCallback(() => {
    requestMeasure(() => {
      const grip = gripRef.current;
      if (!grip) {
        return;
      }

      const rect = grip.getBoundingClientRect();
      setMenuAnchor({
        x: rect.left,
        y: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
      openMenu();
    });
  });

  const handleCloseMenu = useLastCallback(() => {
    closeMenu();
    if (!isKeyboardMenuRef.current) {
      return;
    }

    isKeyboardMenuRef.current = false;
    requestMeasure(() => gripRef.current?.focus());
  });

  function startPointerSession(
    pointerId: number,
    onMove: (e: PointerEvent) => void,
    onEnd?: NoneToVoidFunction,
    onCancel?: NoneToVoidFunction,
  ) {
    pointerSessionRef.current?.removeListeners();

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId === pointerId) {
        onMove(e);
      }
    };
    const handleEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) {
        return;
      }

      pointerSessionRef.current?.removeListeners();
      onEnd?.();
    };
    const handleCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) {
        return;
      }

      pointerSessionRef.current?.removeListeners();
      onCancel?.();
    };
    const handleEscape = () => {
      pointerSessionRef.current?.removeListeners();
      onCancel?.();
    };
    const releaseEscKeyListener = captureEscKeyListener(handleEscape);
    const removeListeners = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleCancel);
      releaseEscKeyListener();
      stopAutoScroll();
      pointerSessionRef.current = undefined;
    };

    pointerSessionRef.current = { pointerId, removeListeners };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleCancel);
  }

  function startAutoScroll(point: AutoScrollPoint, callback: (currentPoint: AutoScrollPoint) => void) {
    autoScrollPointRef.current = point;
    autoScrollCallbackRef.current = callback;
    scheduleAutoScroll();
  }

  function scheduleAutoScroll() {
    if (autoScrollFrameRef.current !== undefined) {
      return;
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(() => {
      autoScrollFrameRef.current = undefined;
      runAutoScroll();
    });
  }

  function runAutoScroll() {
    const scroller = scrollerRef.current;
    const point = autoScrollPointRef.current;
    if (!scroller || !point) {
      return;
    }

    autoScrollCallbackRef.current?.(point);
    requestMeasure(() => {
      const scrollerRect = scroller.getBoundingClientRect();
      const horizontalDelta = getAutoScrollDelta(point.clientX, scrollerRect.left, scrollerRect.right);
      const verticalScroller = rootElement.closest<HTMLElement>('.custom-scroll');
      const verticalRect = verticalScroller?.getBoundingClientRect();
      const verticalDelta = verticalRect
        ? getAutoScrollDelta(point.clientY, verticalRect.top, verticalRect.bottom)
        : 0;

      if (!horizontalDelta && !verticalDelta) {
        return;
      }

      requestMutation(() => {
        if (horizontalDelta) {
          scroller.scrollBy({ left: horizontalDelta });
        }
        if (verticalDelta) {
          verticalScroller?.scrollBy({ top: verticalDelta });
        }
        updateLayout();
        scheduleAutoScroll();
      });
    });
  }

  function stopAutoScroll() {
    autoScrollPointRef.current = undefined;
    autoScrollCallbackRef.current = undefined;
    if (autoScrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = undefined;
    }
  }

  const handleSetAlignment = useLastCallback((attr: AlignmentOption['attr'], value: AlignmentOption['value']) => {
    const selection = getCurrentSelection();
    if (!selection) {
      return;
    }

    isKeyboardMenuRef.current = false;
    setRichEditorTableCellAttr(
      editorView.state,
      editorView.dispatch,
      selection.tablePos,
      attr,
      value,
    );
    focusEditor(editorView);
  });

  const handleToggleHighlight = useLastCallback(() => {
    const selection = getCurrentSelection();
    if (!selection) {
      return;
    }

    isKeyboardMenuRef.current = false;
    toggleRichEditorTableHighlight(editorView.state, editorView.dispatch, selection.tablePos);
    focusEditor(editorView);
  });

  const handleToggleTableAttr = useLastCallback((attr: RichEditorTableBooleanAttrName) => {
    const selection = getCurrentSelection();
    if (!selection) {
      return;
    }

    isKeyboardMenuRef.current = false;
    toggleRichEditorTableBooleanAttr(editorView.state, editorView.dispatch, selection.tablePos, attr);
    focusEditor(editorView);
  });

  const handleMove = useLastCallback((axis: RichEditorTableMoveAxis, delta: number) => {
    const selection = getCurrentSelection();
    if (!selection) {
      return;
    }

    const fromIndex = axis === 'row' ? selection.rect.top : selection.rect.left;
    isKeyboardMenuRef.current = false;
    moveRichEditorTableSelection(
      editorView.state,
      editorView.dispatch,
      selection.tablePos,
      axis,
      fromIndex + delta,
    );
    focusEditor(editorView);
  });

  const runCommand = useLastCallback((command: Command) => {
    isKeyboardMenuRef.current = false;
    command(editorView.state, editorView.dispatch);
    focusEditor(editorView);
  });

  const getTriggerElement = useLastCallback(() => gripRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getMenuLayout = useLastCallback(() => ({ withPortal: true }));

  const selection = layout.selection;
  const selectionGeometry = layout.selectionGeometry;
  const selectionAxis = getSelectionAxis(selection, selectionAxisRef.current);
  const selectionCount = selection
    ? selectionAxis === 'row'
      ? selection.rect.bottom - selection.rect.top
      : selection.rect.right - selection.rect.left
    : 0;
  const isHighlighted = selection ? areSelectedCellsHighlighted(selection) : false;
  const horizontalAlignment = selection && getRichEditorTableCellAttr(
    editorView.state, selection.tablePos, 'align',
  );
  const verticalAlignment = selection && getRichEditorTableCellAttr(
    editorView.state, selection.tablePos, 'verticalAlign',
  );
  const canMerge = Boolean(selection && mergeCells(editorView.state));
  const canSplit = Boolean(selection && splitCell(editorView.state));
  const backwardDelta = selectionAxis === 'column' && layout.isRtl ? 1 : -1;
  const forwardDelta = -backwardDelta;
  const moveTargets = selection && selectionAxis
    ? getRichEditorTableMoveTargets(editorView.state, selection.tablePos, selectionAxis)
    : [];
  const moveFromIndex = selection && selectionAxis === 'row' ? selection.rect.top : selection?.rect.left;
  const canMoveBackward = Boolean(
    moveFromIndex !== undefined && moveTargets.includes(moveFromIndex + backwardDelta),
  );
  const canMoveForward = Boolean(
    moveFromIndex !== undefined && moveTargets.includes(moveFromIndex + forwardDelta),
  );
  const isSelectionDraggable = moveTargets.length > 0;
  const isRowSelection = selectionAxis === 'row';
  const isTableSelection = selection?.kind === 'table';
  const insertColumnLeftCommand = layout.isRtl ? addColumnAfter : addColumnBefore;
  const insertColumnRightCommand = layout.isRtl ? addColumnBefore : addColumnAfter;

  return (
    <>
      <div
        ref={handleScrollerRef}
        className={buildClassName(styles.scroller, !layout.isBordered && styles.borderlessScroller)}
      />
      <div className={styles.controls} contentEditable={false}>
        {layout.tablePos !== undefined && (
          <button
            type="button"
            tabIndex={-1}
            className={styles.tableSelector}
            style={buildRectStyle(
              layout.isRtl ? layout.tableLeft + layout.tableWidth : layout.tableLeft - SELECTOR_SIZE_REM * 16,
              layout.tableTop - SELECTOR_SIZE_REM * 16,
              SELECTOR_SIZE_REM * 16,
              SELECTOR_SIZE_REM * 16,
            )}
            aria-label={lang('RichEditorTableSelectTableAria')}
            onPointerDown={handleTableSelectorPointerDown}
          />
        )}
        {layout.columns.map((column) => (
          <button
            key={`column-${column.index}`}
            type="button"
            tabIndex={-1}
            className={styles.columnSelector}
            style={buildRectStyle(
              column.start,
              layout.tableTop - SELECTOR_SIZE_REM * 16,
              column.size,
              SELECTOR_SIZE_REM * 16,
            )}
            aria-label={lang('RichEditorTableSelectColumnAria')}
            onPointerDown={(e) => startAxisSelection(e, 'column', column.index)}
          />
        ))}
        {layout.rows.map((row) => (
          <button
            key={`row-${row.index}`}
            type="button"
            tabIndex={-1}
            className={styles.rowSelector}
            style={buildRectStyle(
              layout.isRtl ? layout.tableLeft + layout.tableWidth : layout.tableLeft - SELECTOR_SIZE_REM * 16,
              row.start,
              SELECTOR_SIZE_REM * 16,
              row.size,
            )}
            aria-label={lang('RichEditorTableSelectRowAria')}
            onPointerDown={(e) => startAxisSelection(e, 'row', row.index)}
          />
        ))}
        {selectionGeometry && (
          <>
            <div
              className={styles.selectionOutline}
              style={buildRectStyle(
                selectionGeometry.left,
                selectionGeometry.top,
                selectionGeometry.width,
                selectionGeometry.height,
              )}
            />
            <button
              ref={gripRef}
              type="button"
              className={buildClassName(
                styles.grip,
                isSelectionDraggable && styles.draggableGrip,
                isSelectionDraggable && selectionAxis === 'row' && styles.rowGrip,
              )}
              style={buildGripStyle(selectionGeometry, selectionAxis, layout.isRtl)}
              aria-label={lang('RichEditorTableActionsAria')}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onPointerDown={handleGripPointerDown}
              onClick={handleGripClick}
              onKeyDown={handleGripKeyDown}
            >
            </button>
            <button
              type="button"
              tabIndex={-1}
              className={styles.rangeHandle}
              style={buildRangeHandleStyle(selectionGeometry)}
              aria-label={lang('RichEditorTableResizeSelectionAria')}
              onPointerDown={handleRangePointerDown}
            />
          </>
        )}
        {dropTarget && (
          <div
            className={buildClassName(
              styles.dropIndicator,
              dropTarget.axis === 'row' ? styles.rowDropIndicator : styles.columnDropIndicator,
            )}
            style={dropTarget.axis === 'row'
              ? `left: ${layout.tableLeft}px; top: ${dropTarget.position}px; width: ${layout.tableWidth}px`
              : `left: ${dropTarget.position}px; top: ${layout.tableTop}px; height: ${layout.tableHeight}px`}
          />
        )}
        {dragPreview && (
          <div
            className={styles.dragPreview}
            style={buildRectStyle(dragPreview.left, dragPreview.top, dragPreview.width, dragPreview.height)}
          />
        )}
      </div>
      <Menu
        ref={menuRef}
        isOpen={isMenuOpen}
        anchor={menuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getMenuLayout}
        ariaLabel={lang('RichEditorTableActionsAria')}
        autoClose
        withPortal
        onClose={handleCloseMenu}
      >
        <div role="group" className={styles.alignmentItem} aria-label={lang('RichEditorTableAlign')}>
          <div className={styles.alignmentLabel}>{lang('RichEditorTableAlign')}</div>
          <div className={styles.alignmentOptions}>
            {ALIGNMENT_OPTION_GROUPS.map((options) => (
              <div key={options[0].attr} role="group" className={styles.alignmentGroup}>
                {options.map((option) => {
                  const attr = option.attr === 'align' ? horizontalAlignment : verticalAlignment;
                  const isActive = Boolean(attr?.isUniform && (
                    option.value === undefined
                      ? !attr.value || attr.value === 'left'
                      : attr.value === option.value
                  ));

                  return (
                    <button
                      key={`${option.attr}-${option.value || 'default'}`}
                      type="button"
                      role="menuitemradio"
                      className={buildClassName(styles.alignmentButton, isActive && styles.activeAlignment)}
                      aria-label={lang(option.label)}
                      aria-checked={isActive}
                      title={lang(option.label)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetAlignment(option.attr, option.value);
                      }}
                    >
                      <Icon name={option.icon} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <MenuItem
          icon="table-fill"
          disabled={!selection || !canToggleRichEditorTableHighlight(editorView.state, selection.tablePos)}
          withPreventDefaultOnMouseDown
          onClick={handleToggleHighlight}
        >
          {lang(isHighlighted ? 'RichEditorTableRemoveHighlight' : 'RichEditorTableHighlight')}
        </MenuItem>
        {isTableSelection && (
          <>
            <MenuItem
              icon={layout.isStriped ? 'check' : 'table'}
              withPreventDefaultOnMouseDown
              onClick={() => handleToggleTableAttr('isStriped')}
            >
              {lang('RichEditorTableStriped')}
            </MenuItem>
            <MenuItem
              icon={!layout.isBordered ? 'check' : 'table'}
              withPreventDefaultOnMouseDown
              onClick={() => handleToggleTableAttr('isBordered')}
            >
              {lang('RichEditorTableBorderless')}
            </MenuItem>
          </>
        )}
        {canSplit ? (
          <MenuItem
            icon={getSplitIcon(selection!)}
            withPreventDefaultOnMouseDown
            onClick={() => runCommand(splitCell)}
          >
            {lang('RichEditorTableSplitCell')}
          </MenuItem>
        ) : canMerge ? (
          <MenuItem
            icon={getMergeIcon(selection!)}
            withPreventDefaultOnMouseDown
            onClick={() => runCommand(mergeCells)}
          >
            {lang('RichEditorTableMergeCells')}
          </MenuItem>
        ) : undefined}
        {selection && (
          <>
            <MenuSeparator />
            <NestedMenuItem
              icon="add"
              submenu={(
                <>
                  <MenuItem
                    customIcon={<Icon name="table-insert-left" />}
                    withPreventDefaultOnMouseDown
                    onClick={() => runCommand(insertColumnLeftCommand)}
                  >
                    {lang('RichEditorTableInsertColumnLeft')}
                  </MenuItem>
                  <MenuItem
                    customIcon={<Icon name="table-insert-right" />}
                    withPreventDefaultOnMouseDown
                    onClick={() => runCommand(insertColumnRightCommand)}
                  >
                    {lang('RichEditorTableInsertColumnRight')}
                  </MenuItem>
                  <MenuItem
                    customIcon={<Icon name="table-insert-above" />}
                    withPreventDefaultOnMouseDown
                    onClick={() => runCommand(addRowBefore)}
                  >
                    {lang('RichEditorTableInsertRowAbove')}
                  </MenuItem>
                  <MenuItem
                    customIcon={<Icon name="table-insert-below" />}
                    withPreventDefaultOnMouseDown
                    onClick={() => runCommand(addRowAfter)}
                  >
                    {lang('RichEditorTableInsertRowBelow')}
                  </MenuItem>
                </>
              )}
            >
              {lang('RichEditorTableInsert')}
            </NestedMenuItem>
            {selectionAxis && (
              <NestedMenuItem
                icon="table-move-left"
                submenu={(
                  <>
                    <MenuItem
                      customIcon={(
                        <Icon
                          name="table-move-left"
                          className={selectionAxis === 'row' ? styles.rotateClockwise : undefined}
                        />
                      )}
                      disabled={!canMoveBackward}
                      withPreventDefaultOnMouseDown
                      onClick={() => handleMove(selectionAxis, backwardDelta)}
                    >
                      {lang(selectionAxis === 'row' ? 'RichEditorTableMoveUp' : 'RichEditorTableMoveLeft')}
                    </MenuItem>
                    <MenuItem
                      customIcon={(
                        <Icon
                          name="table-move-right"
                          className={selectionAxis === 'row' ? styles.rotateClockwise : undefined}
                        />
                      )}
                      disabled={!canMoveForward}
                      withPreventDefaultOnMouseDown
                      onClick={() => handleMove(selectionAxis, forwardDelta)}
                    >
                      {lang(selectionAxis === 'row' ? 'RichEditorTableMoveDown' : 'RichEditorTableMoveRight')}
                    </MenuItem>
                  </>
                )}
              >
                {lang('RichEditorTableMove')}
              </NestedMenuItem>
            )}
          </>
        )}
        {(selectionAxis || isTableSelection) && (
          <>
            <MenuSeparator />
            <MenuItem
              icon="table-delete"
              destructive
              withPreventDefaultOnMouseDown
              onClick={() => runCommand(
                isTableSelection ? deleteRichEditorTable : isRowSelection ? deleteRow : deleteColumn,
              )}
            >
              {isTableSelection ? lang('RichEditorTableDeleteTable') : lang(
                isRowSelection
                  ? 'RichEditorTableDeleteRow'
                  : 'RichEditorTableDeleteColumn',
                { count: selectionCount },
                { pluralValue: selectionCount },
              )}
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};

export default memo(EditableTable);

function measureTableLayout(
  editorView: EditorView,
  rootElement: HTMLDivElement,
  tableElement: HTMLTableElement,
  colgroupElement: HTMLTableColElement,
  contentElement: HTMLTableSectionElement,
): TableLayout | undefined {
  const tablePos = getTablePos(editorView, contentElement);
  if (tablePos === undefined) {
    return undefined;
  }

  const tableNode = editorView.state.doc.nodeAt(tablePos);
  if (!tableNode || tableNode.type.spec.tableRole !== 'table') {
    return undefined;
  }

  const rootRect = rootElement.getBoundingClientRect();
  const tableRect = tableElement.getBoundingClientRect();
  const map = TableMap.get(tableNode);
  const selection = getRichEditorTableSelection(editorView.state, tablePos);
  const selectionGeometry = selection
    ? measureSelectionGeometry(editorView, rootRect, selection)
    : undefined;

  return {
    tablePos,
    tableLeft: tableRect.left - rootRect.left,
    tableTop: tableRect.top - rootRect.top,
    tableWidth: tableRect.width,
    tableHeight: tableRect.height,
    isBordered: tableNode.attrs.isBordered !== false,
    isStriped: Boolean(tableNode.attrs.isStriped),
    isRtl: getComputedStyle(tableElement).direction === 'rtl',
    columns: measureColumns(colgroupElement, tableRect, rootRect, map.width),
    rows: measureRows(tableElement, rootRect),
    selection,
    selectionGeometry,
  };
}

function getTablePos(editorView: EditorView, contentElement: HTMLTableSectionElement): number | undefined {
  if (!contentElement.isConnected) {
    return undefined;
  }

  try {
    const tableStart = editorView.posAtDOM(contentElement, 0, -1);
    const tablePos = tableStart - 1;
    return editorView.state.doc.nodeAt(tablePos)?.type.spec.tableRole === 'table' ? tablePos : undefined;
  } catch (err) {
    return undefined;
  }
}

function measureColumns(
  colgroupElement: HTMLTableColElement,
  tableRect: DOMRect,
  rootRect: DOMRect,
  expectedCount: number,
): AxisSegment[] {
  const columns = Array.from(colgroupElement.children) as HTMLTableColElement[];
  if (columns.length === expectedCount) {
    const measured = columns.map((column, index) => {
      const rect = column.getBoundingClientRect();
      return {
        index,
        start: rect.left - rootRect.left,
        size: rect.width,
        clientStart: rect.left,
        clientEnd: rect.right,
      };
    });
    if (measured.every(({ size }) => size > 0)) {
      return measured;
    }
  }

  const columnWidth = expectedCount ? tableRect.width / expectedCount : 0;
  return Array.from({ length: expectedCount }, (_, index) => ({
    index,
    start: tableRect.left - rootRect.left + columnWidth * index,
    size: columnWidth,
    clientStart: tableRect.left + columnWidth * index,
    clientEnd: tableRect.left + columnWidth * (index + 1),
  }));
}

function measureRows(tableElement: HTMLTableElement, rootRect: DOMRect): AxisSegment[] {
  return Array.from(tableElement.rows).map((row, index) => {
    const rect = row.getBoundingClientRect();
    return {
      index,
      start: rect.top - rootRect.top,
      size: rect.height,
      clientStart: rect.top,
      clientEnd: rect.bottom,
    };
  });
}

function measureSelectionGeometry(
  editorView: EditorView,
  rootRect: DOMRect,
  selection: RichEditorTableSelection,
): SelectionGeometry | undefined {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  selection.cellPositions.forEach((cellPos) => {
    const cell = editorView.nodeDOM(cellPos);
    if (!(cell instanceof HTMLElement)) {
      return;
    }

    const rect = cell.getBoundingClientRect();
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
  });

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return undefined;
  }

  return {
    left: left - rootRect.left,
    top: top - rootRect.top,
    width: right - left,
    height: bottom - top,
  };
}

function selectTableAxis(
  editorView: EditorView,
  tablePos: number,
  axis: RichEditorTableMoveAxis,
  anchor: number,
  head: number,
) {
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head) + 1;
  selectRichEditorTableAxis(editorView.state, editorView.dispatch, tablePos, axis, from, to);
}

function findAxisSegment(segments: AxisSegment[], clientPosition: number): AxisSegment | undefined {
  return segments.find(({ clientStart, clientEnd }) => (
    clientPosition >= clientStart && clientPosition <= clientEnd
  ));
}

function buildDropTarget(
  selection: RichEditorTableSelection,
  axis: RichEditorTableMoveAxis,
  segments: AxisSegment[],
  clientPosition: number,
  legalTargets: number[],
  isRtl = false,
): DropTarget | undefined {
  const segment = findAxisSegment(segments, clientPosition);
  if (!segment) {
    return undefined;
  }

  const isBefore = axis === 'column' && isRtl
    ? clientPosition > (segment.clientStart + segment.clientEnd) / 2
    : clientPosition < (segment.clientStart + segment.clientEnd) / 2;
  const insertionIndex = isBefore
    ? segment.index
    : segment.index + 1;
  const fromIndex = axis === 'row' ? selection.rect.top : selection.rect.left;
  const count = axis === 'row'
    ? selection.rect.bottom - selection.rect.top
    : selection.rect.right - selection.rect.left;
  const toIndex = insertionIndex <= fromIndex ? insertionIndex : insertionIndex - count;
  if (toIndex === fromIndex) {
    return undefined;
  }

  const snappedToIndex = getClosestMoveTarget(legalTargets, toIndex, insertionIndex, fromIndex, count);
  if (snappedToIndex === undefined) {
    return undefined;
  }

  const snappedInsertionIndex = getMoveInsertionIndex(snappedToIndex, fromIndex, count);
  const position = getDropIndicatorPosition(segments, snappedInsertionIndex, axis === 'column' && isRtl);

  return { axis, toIndex: snappedToIndex, position };
}

function getClosestMoveTarget(
  legalTargets: number[],
  preferredTarget: number,
  preferredInsertionIndex: number,
  fromIndex: number,
  count: number,
): number | undefined {
  return legalTargets.reduce<number | undefined>((closestTarget, target) => {
    if (target === preferredTarget) {
      return target;
    }
    if (closestTarget === undefined) {
      return target;
    }

    const targetDistance = Math.abs(
      getMoveInsertionIndex(target, fromIndex, count) - preferredInsertionIndex,
    );
    const closestDistance = Math.abs(
      getMoveInsertionIndex(closestTarget, fromIndex, count) - preferredInsertionIndex,
    );
    return targetDistance < closestDistance ? target : closestTarget;
  }, undefined);
}

function getMoveInsertionIndex(toIndex: number, fromIndex: number, count: number) {
  return toIndex <= fromIndex ? toIndex : toIndex + count;
}

function getDropIndicatorPosition(segments: AxisSegment[], insertionIndex: number, isRtl: boolean) {
  const boundarySegment = segments[insertionIndex];
  if (boundarySegment) {
    return isRtl ? boundarySegment.start + boundarySegment.size : boundarySegment.start;
  }

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    return 0;
  }

  return isRtl ? lastSegment.start : lastSegment.start + lastSegment.size;
}

function getAutoScrollDelta(position: number, start: number, end: number): number {
  if (position < start + AUTO_SCROLL_EDGE_PX) {
    return -AUTO_SCROLL_STEP_PX;
  }
  if (position > end - AUTO_SCROLL_EDGE_PX) {
    return AUTO_SCROLL_STEP_PX;
  }
  return 0;
}

function getSelectionAxis(
  selection: RichEditorTableSelection | undefined,
  tableSelectionAxis: RichEditorTableMoveAxis | undefined,
): RichEditorTableMoveAxis | undefined {
  if (selection?.kind === 'row' || selection?.kind === 'column') {
    return selection.kind;
  }

  return selection?.kind === 'table' ? tableSelectionAxis : undefined;
}

function areSelectedCellsHighlighted(selection: RichEditorTableSelection) {
  return selection.cellPositions.every((cellPos) => (
    selection.table.nodeAt(cellPos - selection.tableStart)?.attrs[TABLE_CELL_HIGHLIGHT_ATTR]
  ));
}

function getMergeIcon(selection: RichEditorTableSelection): IconName {
  const width = selection.rect.right - selection.rect.left;
  const height = selection.rect.bottom - selection.rect.top;
  return height > width ? 'table-merge-vertical' : 'table-merge-horizontal';
}

function getSplitIcon(selection: RichEditorTableSelection): IconName {
  const width = selection.rect.right - selection.rect.left;
  const height = selection.rect.bottom - selection.rect.top;
  return height > width ? 'table-split-vertical' : 'table-split-horizontal';
}

function focusEditor(editorView: EditorView) {
  requestMeasure(() => editorView.focus());
}

function buildRectStyle(left: number, top: number, width: number, height: number) {
  return `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px`;
}

function buildRangeHandleStyle(geometry: SelectionGeometry) {
  return `left: ${geometry.left + geometry.width}px; top: ${geometry.top + geometry.height}px`;
}

function buildGripStyle(
  geometry: SelectionGeometry,
  axis: RichEditorTableMoveAxis | undefined,
  isRtl: boolean,
) {
  if (axis === 'row') {
    const left = isRtl ? geometry.left + geometry.width : geometry.left;
    return `left: ${left}px; top: ${geometry.top + geometry.height / 2}px`;
  }

  return `left: ${geometry.left + geometry.width / 2}px; top: ${geometry.top}px`;
}
