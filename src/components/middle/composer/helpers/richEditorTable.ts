import type { Attribute } from '@tiptap/core';
import { Extension, mergeAttributes, Node as TiptapNode } from '@tiptap/core';
import {
  Table as TableExtension,
  TableCell as TableCellExtension,
  TableRow as TableRowExtension,
  TableView,
} from '@tiptap/extension-table';
import { Fragment, type Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import type { EditorView } from '@tiptap/pm/view';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import {
  TABLE_CELL_HIGHLIGHT_ATTR,
  TABLE_TITLE_NODE_NAME,
  TABLE_WRAPPER_NODE_NAME,
} from '../../../../util/tiptap/constants';
import tiptapStyles from '../../../../util/tiptap/styling.module.scss';
import TeactRenderer from '../../../../util/tiptap/TeactRenderer';
import { deleteRichEditorTable } from './richEditorTableCommands';
import buildRichEditorTextField from './richEditorTextField';

import EditableTable, { type EditableTableProps } from '../richInput/EditableTable';

import styles from '../richInput/EditableTable.module.scss';

type RichEditorTableVerticalAlign = 'middle' | 'bottom';

const RICH_TEXT_BLOCK_CONTENT = 'paragraph+';
const RICH_EDITOR_TABLE_DATA_ATTRIBUTE = 'data-rich-editor-table';
const TABLE_CONTROLS_PLUGIN_KEY = new PluginKey('richEditorTableControls');

const tableViewsByEditorView = new WeakMap<EditorView, Set<RichEditorTableView>>();

const RichEditorTableTitleNode = buildRichEditorTextField({
  name: TABLE_TITLE_NODE_NAME,
  dataAttribute: 'data-rich-editor-table-title',
});

export const RichEditorTableTitle = RichEditorTableTitleNode.extend({
  priority: 110,

  parseHTML() {
    return [
      { tag: '[data-rich-block-type="tableTitle"]' },
      { tag: 'caption' },
      ...(this.parent?.() || []),
    ];
  },

  renderMarkdown(node, helpers) {
    return helpers.renderChildren(node);
  },
});

export function buildRichEditorTableExtensions() {
  return [
    RichEditorTableWrapper,
    RichEditorTable.configure({
      View: RichEditorTableView,
    }),
    RichEditorTableRow.configure({
      HTMLAttributes: {
        class: styles.tableRow,
      },
    }),
    RichEditorTableCell.configure({
      HTMLAttributes: {
        class: buildClassName(tiptapStyles.tableCell, styles.tableCell),
      },
    }),
  ];
}

const RichEditorTableWrapper = TiptapNode.create({
  name: TABLE_WRAPPER_NODE_NAME,
  group: 'block',
  content: `${TABLE_TITLE_NODE_NAME} table`,
  isolating: true,

  parseHTML() {
    return [
      { tag: `div[${RICH_EDITOR_TABLE_DATA_ATTRIBUTE}]` },
      { tag: '[data-rich-block-type="table"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { [RICH_EDITOR_TABLE_DATA_ATTRIBUTE]: '' }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    const wrapperType = this.type;
    const titleType = this.editor.schema.nodes[TABLE_TITLE_NODE_NAME];

    return [new Plugin({
      appendTransaction: (transactions, _oldState, newState) => {
        if (!transactions.some((transaction) => transaction.docChanged)) {
          return undefined;
        }

        const bareTables: Array<{ node: ProseMirrorNode; pos: number }> = [];
        newState.doc.descendants((node, pos, parent) => {
          if (node.type.spec.tableRole === 'table' && parent?.type !== wrapperType) {
            bareTables.push({ node, pos });
          }
        });

        if (!bareTables.length) {
          return undefined;
        }

        const transaction = newState.tr;
        bareTables.sort((left, right) => right.pos - left.pos).forEach(({ node, pos }) => {
          const wrapper = wrapperType.create(undefined, [titleType.create(), node]);
          transaction.replaceWith(pos, pos + node.nodeSize, wrapper);
        });

        return transaction;
      },
    })];
  },
});

const RichEditorTable = TableExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      isBordered: {
        default: true,
        parseHTML: (element) => element.hasAttribute('bordered'),
      },
      isStriped: {
        default: false,
        parseHTML: (element) => element.hasAttribute('striped'),
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      deleteTable: () => ({ state, dispatch }) => deleteRichEditorTable(state, dispatch),
    };
  },

  addKeyboardShortcuts() {
    const handleDelete = () => (
      isEntireTableSelected(this.editor.state.selection)
        ? this.editor.commands.deleteTable()
        : false
    );

    return {
      ...this.parent?.(),
      Backspace: handleDelete,
      'Mod-Backspace': handleDelete,
      Delete: handleDelete,
      'Mod-Delete': handleDelete,
    };
  },
});

const RichEditorTableRow = TableRowExtension.extend({
  content: 'tableCell*',
});

const RichEditorTableCell = TableCellExtension.extend({
  content: RICH_TEXT_BLOCK_CONTENT,

  addAttributes() {
    return {
      ...this.parent?.(),
      [TABLE_CELL_HIGHLIGHT_ATTR]: buildHighlightAttribute(),
      verticalAlign: buildVerticalAlignAttribute(),
    };
  },

  parseHTML() {
    const tableCellRules = this.parent!()!;
    const tableHeaderRules = tableCellRules.map((rule) => ({
      ...rule,
      tag: 'th',
    }));

    return [...tableCellRules, ...tableHeaderRules];
  },
});

export const RichEditorTableControlsExtension = Extension.create({
  name: 'richEditorTableControls',

  addProseMirrorPlugins() {
    return [new Plugin({
      key: TABLE_CONTROLS_PLUGIN_KEY,
      view: (editorView) => ({
        update: (updatedView, previousState) => {
          if (previousState.selection.eq(updatedView.state.selection)) {
            return;
          }

          const activeTablePositions = new Set([
            getSelectionTablePos(previousState.selection),
            getSelectionTablePos(updatedView.state.selection),
          ]);
          tableViewsByEditorView.get(editorView)?.forEach((tableView) => {
            if (activeTablePositions.has(tableView.getTablePos())) {
              tableView.refresh();
            }
          });
        },
      }),
    })];
  },
});

class RichEditorTableView extends TableView {
  private editorView: EditorView;

  private renderer: TeactRenderer<EditableTableProps>;

  private renderVersion = 0;

  private isRefreshScheduled = false;

  private isDestroyed = false;

  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    editorView: EditorView,
    HTMLAttributes?: AnyLiteral,
  ) {
    super(node, cellMinWidth, editorView, HTMLAttributes);

    this.editorView = editorView;
    this.dom.className = styles.root;
    this.updateTableClassName(node);

    this.renderer = new TeactRenderer(EditableTable, {
      element: this.dom,
      props: this.buildComponentProps(),
    });

    const tableViews = tableViewsByEditorView.get(editorView) || new Set<RichEditorTableView>();
    tableViews.add(this);
    tableViewsByEditorView.set(editorView, tableViews);
  }

  update(node: ProseMirrorNode) {
    if (!super.update(node)) {
      return false;
    }

    this.updateTableClassName(node);
    this.refresh();
    return true;
  }

  stopEvent(e: Event) {
    return e.target instanceof Node && !this.table.contains(e.target);
  }

  destroy() {
    this.isDestroyed = true;
    const tableViews = tableViewsByEditorView.get(this.editorView)!;
    tableViews.delete(this);
    if (!tableViews.size) {
      tableViewsByEditorView.delete(this.editorView);
    }
    this.renderer.destroy();
  }

  refresh() {
    if (this.isDestroyed || this.isRefreshScheduled) {
      return;
    }

    this.isRefreshScheduled = true;
    requestMutation(() => {
      this.isRefreshScheduled = false;
      if (this.isDestroyed) {
        return;
      }

      this.renderVersion += 1;
      this.renderer.updateProps(this.buildComponentProps());
    });
  }

  getTablePos(): number | undefined {
    const contentElement = this.contentDOM;
    if (!contentElement.isConnected) {
      return undefined;
    }

    try {
      return this.editorView.posAtDOM(contentElement, 0, -1) - 1;
    } catch (err) {
      return undefined;
    }
  }

  private buildComponentProps(): EditableTableProps {
    const contentElement = this.contentDOM;

    return {
      editorView: this.editorView,
      rootElement: this.dom,
      tableElement: this.table,
      colgroupElement: this.colgroup,
      contentElement,
      renderVersion: this.renderVersion,
    };
  }

  private updateTableClassName(node: ProseMirrorNode) {
    this.table.className = buildClassName(
      styles.table,
      node.attrs.isBordered === false && styles.borderlessTable,
      node.attrs.isStriped && styles.stripedTable,
    );
  }
}

function getSelectionTablePos(selection: Selection): number | undefined {
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    if (selection.$from.node(depth).type.spec.tableRole === 'table') {
      return selection.$from.before(depth);
    }
  }

  return undefined;
}

export function preserveCopiedRichEditorTable(slice: Slice, selection: Selection) {
  if (!isEntireTableSelected(selection)) {
    return slice;
  }

  const wrapper = selection.$anchorCell.node(-2);
  return wrapper.type.name === TABLE_WRAPPER_NODE_NAME
    ? new Slice(Fragment.from(wrapper), 0, 0)
    : slice;
}

function isEntireTableSelected(selection: Selection): selection is CellSelection {
  return selection instanceof CellSelection
    && selection.isRowSelection()
    && selection.isColSelection();
}

function buildHighlightAttribute(): Attribute {
  return {
    default: false,
    parseHTML: (element) => (
      element.tagName === 'TH' || element.classList.contains(tiptapStyles.highlightedTableCell)
    ),
    renderHTML: ({ isHighlighted }: { isHighlighted?: boolean }) => (
      isHighlighted ? { class: tiptapStyles.highlightedTableCell } : {}
    ),
  };
}

function buildVerticalAlignAttribute(): Attribute {
  return {
    default: undefined,
    parseHTML: (element) => {
      const verticalAlign = element.style.verticalAlign || element.getAttribute('valign');
      return verticalAlign === 'middle' || verticalAlign === 'bottom' ? verticalAlign : undefined;
    },
    renderHTML: ({ verticalAlign }: { verticalAlign?: RichEditorTableVerticalAlign }) => (
      verticalAlign ? { style: `vertical-align: ${verticalAlign}` } : {}
    ),
  };
}
