import {
  Editor,
  InputRule,
  type JSONContent as TiptapJsonContent,
  mergeAttributes,
  Node as TiptapNode,
} from '@tiptap/core';
import CodeExtension from '@tiptap/extension-code';
import CodeBlockLowlightExtension from '@tiptap/extension-code-block-lowlight';
import {
  Details as DetailsExtension,
  DetailsContent as DetailsContentExtension,
  type DetailsRenderToggleButtonOptions,
  DetailsSummary as DetailsSummaryExtension,
} from '@tiptap/extension-details';
import HeadingExtension from '@tiptap/extension-heading';
import HorizontalRuleExtension from '@tiptap/extension-horizontal-rule';
import LinkExtension from '@tiptap/extension-link';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import PlaceholderExtension from '@tiptap/extension-placeholder';
import StrikeExtension from '@tiptap/extension-strike';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import UnderlineExtension from '@tiptap/extension-underline';
import { splitBlock } from '@tiptap/pm/commands';
import { redoDepth, undoDepth } from '@tiptap/pm/history';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import {
  Plugin, TextSelection, type Transaction,
} from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import StarterKitExtension from '@tiptap/starter-kit';
import type { ElementRef } from '../../../../lib/teact/teact';

import type { CustomEmojiNodeOptions } from '../../../../util/tiptap/extensions/customEmoji';
import type { RichEditorDateClickTarget } from '../../../../util/tiptap/extensions/date';
import type { RichEditorTooltipsConfig } from '../../../common/tooltips/types';

import { lowlight } from '../../../../util/highlightCode';
import {
  CustomEmojiNode,
  DateMark,
  EmojiNode,
  FormattedDateNode,
  MarkedTextMark,
  MathBlockNode,
  MathInlineNode,
  MentionNode,
  SpoilerMark,
  TeactNodeViewRenderer,
  UnsupportedNode,
} from '../../../../util/tiptap';
import {
  CAPTION_NODE_NAME,
  FOOTER_NODE_NAME,
  TABLE_TITLE_NODE_NAME,
} from '../../../../util/tiptap/constants';
import {
  isRichMarkdownWebLink,
  parseRichMarkdownLink,
  parseRichMarkdownToken,
  RE_RICH_MARKDOWN_LINK_INPUT,
} from '../../../../util/tiptap/richMarkdown';
import setEditorContentWithoutHistory from '../../../../util/tiptap/setEditorContentWithoutHistory';
import styles from '../../../../util/tiptap/styling.module.scss';
import { buildRichEditorFormatting } from '../../../ui/textInput/richEditorFormatting';
import { buildRichEditorBlockquote } from './richEditorBlockquote';
import { RichEditorBotApiHtml } from './richEditorBotApiHtml';
import { RichEditorCaption } from './richEditorCaption';
import { RichEditorMarkdown } from './richEditorMarkdown';
import { RichEditorPullquote } from './richEditorPullquote';
import { buildRichEditorTableExtensions, RichEditorTableTitle } from './richEditorTable';
import { RichEditorTextReplacements } from './richEditorTextReplacements';

import { requestSharedCanvasCoordsRecalculation } from '../../../../hooks/useCoordsInSharedCanvas';

import {
  buildRichEditorTooltips,
  openRichEditorFormatterControl,
} from '../../../common/tooltips/extensions/RichEditorTooltips';
import EditableCodeBlock from '../richInput/EditableCodeBlock';
import EditableListItem from '../richInput/EditableListItem';

export const RICH_HEADING_LEVELS: [1, 2, 3, 4, 5, 6] = [1, 2, 3, 4, 5, 6];
export type RichHeadingLevel = typeof RICH_HEADING_LEVELS[number];
export const RICH_ORDERED_LIST_TYPES = ['1', 'a', 'A', 'i', 'I'] as const;
export type RichOrderedListType = typeof RICH_ORDERED_LIST_TYPES[number];
export type RichListType = 'bulletList' | 'orderedList';

export type RichEditorListState = {
  type: RichListType;
  isChecklist: boolean;
  orderType?: string;
  isReversed: boolean;
};

type CreateRichEditorParams = {
  element: HTMLDivElement;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
  content: TiptapJsonContent;
  blockPlaceholder: string;
  pullquotePlaceholder: string;
  quoteCaptionPlaceholder: string;
  tableTitlePlaceholder: string;
  unsupportedPlaceholder: string;
  getIsRichInputExpanded: () => boolean;
  onUpdate: (editor: Editor) => void;
  onDateClick: (target: RichEditorDateClickTarget) => void;
  tooltips?: RichEditorTooltipsConfig;
};

type RichEditorPlaceholderParams = Pick<
  CreateRichEditorParams,
  'blockPlaceholder' | 'pullquotePlaceholder' | 'quoteCaptionPlaceholder' | 'tableTitlePlaceholder'
>;

const CODE_BLOCK_TAB_SIZE = 2;
const TOP_LEVEL_PARAGRAPH_DEPTH = 1;
const BULLET_LIST_CHECKLIST_ATTR = 'checklist';
const LIST_ITEM_CHECKBOX_ATTR = 'checkbox';
const LIST_ITEM_CHECKED_ATTR = 'checked';
// The list, list item, and paragraph each add one content boundary
const NESTED_LIST_TEXT_OFFSET = 3;
const ORDERED_LIST_REVERSED_ATTR = 'reversed';
const DEFAULT_TEXT_BLOCK_NODE_TYPE = 'paragraph';
const RICH_TEXT_INLINE_CONTENT = 'inline*';

export function __createRichEditor({
  element,
  sharedCanvasRef,
  sharedCanvasHqRef,
  content,
  blockPlaceholder,
  pullquotePlaceholder,
  quoteCaptionPlaceholder,
  tableTitlePlaceholder,
  unsupportedPlaceholder,
  getIsRichInputExpanded,
  onUpdate,
  onDateClick,
  tooltips,
}: CreateRichEditorParams) {
  const richEditor = new Editor({
    element: { mount: element } as unknown as HTMLElement,
    extensions: buildRichEditorExtensions(
      blockPlaceholder,
      pullquotePlaceholder,
      quoteCaptionPlaceholder,
      tableTitlePlaceholder,
      unsupportedPlaceholder,
      onDateClick,
      tooltips,
      getIsRichInputExpanded,
      { sharedCanvasRef, sharedCanvasHqRef },
    ),
    editorProps: {
      handleKeyDown: handleRichEditorKeyDown,
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor);
      requestSharedCanvasCoordsRecalculation(sharedCanvasRef, sharedCanvasHqRef);
    },
  });

  setEditorContentWithoutHistory(richEditor, content);

  return richEditor;
}

export function __getRichEditorCanUndo(editor: Editor) {
  return Boolean(undoDepth(editor.state));
}

export function __getRichEditorCanRedo(editor: Editor) {
  return Boolean(redoDepth(editor.state));
}

function buildRichEditorExtensions(
  blockPlaceholder: string,
  pullquotePlaceholder: string,
  quoteCaptionPlaceholder: string,
  tableTitlePlaceholder: string,
  unsupportedPlaceholder: string,
  onDateClick: (target: RichEditorDateClickTarget) => void,
  tooltips: RichEditorTooltipsConfig | undefined,
  getIsRichInputExpanded: () => boolean,
  customEmojiOptions: CustomEmojiNodeOptions,
) {
  const extensions = [
    StarterKitExtension.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      listItem: false,
      link: false,
      orderedList: false,
      paragraph: {
        HTMLAttributes: {
          class: styles.paragraph,
        },
      },
      strike: false,
      underline: false,
    }),
    RichEditorCode.configure({
      HTMLAttributes: {
        class: styles.inlineCode,
      },
    }),
    RichEditorLink.configure({
      autolink: false,
      linkOnPaste: false,
      openOnClick: false,
      protocols: ['tg', 'ton'],
      HTMLAttributes: {
        class: styles.textEntityLink,
        dir: 'auto',
        target: undefined,
        rel: undefined,
      },
    }),
    RichEditorStrike,
    RichEditorMarkdown,
    buildRichEditorBlockquote(getIsRichInputExpanded).configure({
      HTMLAttributes: {
        class: styles.blockquote,
      },
    }),
    RichEditorPullquote.configure({
      HTMLAttributes: {
        class: styles.pullquote,
      },
    }),
    RichEditorCaption.configure({
      HTMLAttributes: {
        class: styles.quoteCaption,
      },
      getIsRichInputExpanded,
    }),
    RichEditorTableTitle.configure({
      HTMLAttributes: {
        class: styles.tableTitle,
      },
    }),
    RichEditorCodeBlock.configure({
      lowlight,
      enableTabIndentation: true,
      tabSize: CODE_BLOCK_TAB_SIZE,
    }),
    RichEditorTextReplacements,
    buildRichEditorFormatting(getIsRichInputExpanded),
    RichEditorBotApiHtml,
    HeadingExtension.configure({
      levels: RICH_HEADING_LEVELS,
      HTMLAttributes: {
        class: styles.heading,
      },
    }),
    HorizontalRuleExtension.configure({
      HTMLAttributes: {
        class: styles.divider,
      },
    }),
    RichEditorFooter.configure({
      HTMLAttributes: {
        class: styles.footer,
      },
    }),
    buildRichEditorBulletList(getIsRichInputExpanded),
    buildRichEditorOrderedList(getIsRichInputExpanded),
    RichEditorListItem.configure({
      HTMLAttributes: {
        class: styles.listItem,
      },
    }),
    RichEditorUnderline,
    buildRichEditorPlaceholder({
      blockPlaceholder,
      pullquotePlaceholder,
      quoteCaptionPlaceholder,
      tableTitlePlaceholder,
    }),
    RichEditorDate.configure({ onClick: onDateClick }),
    FormattedDateNode.configure({ onClick: onDateClick }),
    SpoilerMark,
    MarkedTextMark,
    SubscriptExtension.configure({
      HTMLAttributes: {
        class: styles.subscript,
      },
    }),
    SuperscriptExtension.configure({
      HTMLAttributes: {
        class: styles.superscript,
      },
    }),
    EmojiNode,
    CustomEmojiNode.configure(customEmojiOptions),
    MentionNode,
    MathBlockNode,
    MathInlineNode,
    UnsupportedNode.configure({ label: unsupportedPlaceholder }),
  ];

  if (tooltips) {
    extensions.push(buildRichEditorTooltips(tooltips));
  }
  extensions.push(...buildRichComposerExtensions());

  return extensions;
}

function buildRichEditorPlaceholder(params: RichEditorPlaceholderParams) {
  // The placeholder state field owns the document used to calculate callback positions
  let currentDoc: ProseMirrorNode;
  return PlaceholderExtension.extend({
    addProseMirrorPlugins() {
      const [plugin] = this.parent!();
      const stateField = plugin.spec.state!;

      return [
        new Plugin({
          ...plugin.spec,
          state: {
            ...stateField,
            init(config, state) {
              currentDoc = state.doc;
              return stateField.init.call(plugin, config, state);
            },
            apply(transaction, value, oldState, newState) {
              currentDoc = newState.doc;
              return stateField.apply.call(plugin, transaction, value, oldState, newState);
            },
          },
        }),
      ];
    },
  }).configure({
    emptyNodeClass: ({ node, pos }) => {
      return getRichEditorEmptyNodeClass(node, currentDoc.resolve(pos).parent);
    },
    includeChildren: true,
    placeholder: ({ node, pos }) => {
      return getRichEditorPlaceholder(node, currentDoc.resolve(pos).parent, params);
    },
    showOnlyCurrent: false,
    showOnlyWhenEditable: false,
  });
}

function getRichEditorEmptyNodeClass(node: ProseMirrorNode, parent: ProseMirrorNode) {
  if (node.type.name === TABLE_TITLE_NODE_NAME) {
    return styles.emptyBlock;
  }

  if (node.type.name === CAPTION_NODE_NAME) {
    return parent.textContent.trim() ? styles.emptyBlock : styles.hiddenCaption;
  }

  if (node.type.name === 'codeBlock') {
    return '';
  }

  if (node.type.name !== 'paragraph') {
    return styles.emptyBlock;
  }

  return parent.type.name === 'blockquote' || parent.type.name === 'pullquote' ? styles.emptyBlock : '';
}

function getRichEditorPlaceholder(
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  {
    blockPlaceholder,
    pullquotePlaceholder,
    quoteCaptionPlaceholder,
    tableTitlePlaceholder,
  }: RichEditorPlaceholderParams,
) {
  if (node.type.name === TABLE_TITLE_NODE_NAME) {
    return tableTitlePlaceholder;
  }

  if (node.type.name === CAPTION_NODE_NAME) {
    return quoteCaptionPlaceholder;
  }

  if (node.type.name !== 'paragraph') {
    return blockPlaceholder;
  }

  return parent.type.name === 'pullquote' ? pullquotePlaceholder : blockPlaceholder;
}

function handleRichEditorKeyDown(view: EditorView, event: KeyboardEvent) {
  const { $from } = view.state.selection;
  if (
    event.key !== 'Enter'
    || !event.shiftKey
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || $from.depth !== TOP_LEVEL_PARAGRAPH_DEPTH
    || $from.parent.type.name !== 'paragraph'
  ) {
    return false;
  }

  if (view.someProp('handleTextInput', (handler) => (
    handler(
      view,
      $from.pos,
      $from.pos,
      '\n',
      () => view.state.tr.insertText('\n', $from.pos),
    )
  ))) {
    event.preventDefault();
    return true;
  }

  event.preventDefault();
  return splitBlock(view.state, view.dispatch);
}

export function __isRichEditorEmpty(editor: Editor) {
  if (!editor.isEmpty) {
    return false;
  }

  const { doc } = editor.state;
  if (!doc.childCount) {
    return true;
  }

  return doc.childCount === 1 && doc.firstChild!.type.name === DEFAULT_TEXT_BLOCK_NODE_TYPE;
}

export function getCurrentRichEditorList(editor: Editor): RichEditorListState | undefined {
  const currentList = findCurrentRichEditorAncestor(editor.state.selection.$from, 'list');
  if (!currentList) {
    return undefined;
  }

  const { node } = currentList;
  const isOrdered = node.type.name === 'orderedList';

  return {
    type: isOrdered ? 'orderedList' : 'bulletList',
    isChecklist: checkIsRichEditorChecklist(node),
    orderType: isOrdered && typeof node.attrs.type === 'string' ? node.attrs.type : undefined,
    isReversed: isOrdered && Boolean(node.attrs[ORDERED_LIST_REVERSED_ATTR]),
  };
}

export function checkCanInsertRichEditorList(editor: Editor, type: RichListType) {
  const currentListItem = findCurrentRichEditorAncestor(editor.state.selection.$from, 'listItem');
  if (!currentListItem) {
    return type === 'bulletList' ? editor.can().toggleBulletList() : editor.can().toggleOrderedList();
  }

  const listType = editor.schema.nodes[type];
  return Boolean(listType && currentListItem.node.canReplaceWith(
    currentListItem.node.childCount,
    currentListItem.node.childCount,
    listType,
  ));
}

export function insertRichEditorList(editor: Editor, type: RichListType, isChecklist?: boolean) {
  const currentListItem = findCurrentRichEditorAncestor(editor.state.selection.$from, 'listItem');
  if (!currentListItem) {
    const chain = editor.chain().focus();
    const isInserted = (type === 'bulletList' ? chain.toggleBulletList() : chain.toggleOrderedList()).run();
    if (isInserted && isChecklist) {
      toggleCurrentRichEditorListChecklist(editor);
    }
    return isInserted;
  }

  const position = currentListItem.position + currentListItem.node.nodeSize - 1;
  return editor.chain().focus().insertContentAt(position, {
    type,
    attrs: buildRichEditorListAttrs(type, Boolean(isChecklist)),
    content: [{
      type: 'listItem',
      attrs: isChecklist ? {
        [LIST_ITEM_CHECKBOX_ATTR]: true,
        [LIST_ITEM_CHECKED_ATTR]: false,
      } : undefined,
      content: [{ type: 'paragraph' }],
    }],
  }).setTextSelection(position + NESTED_LIST_TEXT_OFFSET).run();
}

export function setCurrentRichEditorListType(editor: Editor, type: RichListType) {
  return updateCurrentRichEditorList(editor, (tr, currentList) => {
    const listType = editor.schema.nodes[type];
    if (!listType || currentList.node.type === listType || !listType.validContent(currentList.node.content)) {
      return undefined;
    }

    return tr.setNodeMarkup(
      currentList.position,
      listType,
      buildRichEditorListAttrs(type, checkIsRichEditorChecklist(currentList.node), currentList.node.attrs),
    );
  });
}

export function toggleCurrentRichEditorListChecklist(editor: Editor) {
  return updateCurrentRichEditorList(editor, (tr, currentList) => {
    const isChecklist = !checkIsRichEditorChecklist(currentList.node);
    if (currentList.node.type.name === 'bulletList') {
      tr.setNodeMarkup(currentList.position, undefined, {
        ...currentList.node.attrs,
        [BULLET_LIST_CHECKLIST_ATTR]: isChecklist,
      });
    }

    currentList.node.forEach((child, offset) => {
      tr.setNodeMarkup(currentList.position + offset + 1, undefined, {
        ...child.attrs,
        [LIST_ITEM_CHECKBOX_ATTR]: isChecklist,
        [LIST_ITEM_CHECKED_ATTR]: isChecklist && Boolean(child.attrs[LIST_ITEM_CHECKED_ATTR]),
      });
    });

    return tr;
  });
}

export function setCurrentRichEditorOrderedListType(editor: Editor, orderType: RichOrderedListType) {
  return updateCurrentRichEditorOrderedList(editor, { type: orderType });
}

export function toggleCurrentRichEditorOrderedListReversed(editor: Editor) {
  return updateCurrentRichEditorOrderedList(editor, (currentList) => ({
    [ORDERED_LIST_REVERSED_ATTR]: !currentList.node.attrs[ORDERED_LIST_REVERSED_ATTR],
  }));
}

function updateCurrentRichEditorOrderedList(
  editor: Editor,
  attrs: Record<string, unknown> | ((currentList: RichEditorAncestor) => Record<string, unknown>),
) {
  return updateCurrentRichEditorList(editor, (tr, currentList) => {
    if (currentList.node.type.name !== 'orderedList') {
      return undefined;
    }

    const nextAttrs = typeof attrs === 'function' ? attrs(currentList) : attrs;
    return tr.setNodeMarkup(currentList.position, undefined, {
      ...currentList.node.attrs,
      ...nextAttrs,
    });
  });
}

function updateCurrentRichEditorList(
  editor: Editor,
  update: (tr: Transaction, currentList: RichEditorAncestor) => Transaction | undefined,
) {
  editor.commands.focus();
  const { state, view } = editor;
  const currentList = findCurrentRichEditorAncestor(state.selection.$from, 'list');
  if (!currentList) {
    return false;
  }

  const tr = update(state.tr, currentList);
  if (!tr) {
    return false;
  }

  view.dispatch(tr);
  return true;
}

type RichEditorAncestor = {
  node: ProseMirrorNode;
  position: number;
};

function findCurrentRichEditorAncestor($from: ResolvedPos, type: 'list' | 'listItem'): RichEditorAncestor | undefined {
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const isMatch = type === 'listItem'
      ? node.type.name === 'listItem'
      : node.type.name === 'bulletList' || node.type.name === 'orderedList';
    if (isMatch) {
      return {
        node,
        position: $from.before(depth),
      };
    }
  }

  return undefined;
}

function checkIsRichEditorChecklist(list: ProseMirrorNode) {
  let isChecklist = list.childCount > 0;
  list.forEach((listItem) => {
    if (!listItem.attrs[LIST_ITEM_CHECKBOX_ATTR]) {
      isChecklist = false;
    }
  });

  return isChecklist;
}

function buildRichEditorListAttrs(
  type: RichListType,
  isChecklist: boolean,
  currentAttrs?: Record<string, unknown>,
) {
  if (type === 'bulletList') {
    return { [BULLET_LIST_CHECKLIST_ATTR]: isChecklist };
  }

  return {
    start: typeof currentAttrs?.start === 'number' ? currentAttrs.start : 1,
    type: typeof currentAttrs?.type === 'string' ? currentAttrs.type : undefined,
    [ORDERED_LIST_REVERSED_ATTR]: Boolean(currentAttrs?.[ORDERED_LIST_REVERSED_ATTR]),
  };
}

const RichEditorFooter = TiptapNode.create({
  name: FOOTER_NODE_NAME,
  group: 'block',
  content: RICH_TEXT_INLINE_CONTENT,
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [{ tag: 'footer' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'footer',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-rich-editor-footer': '' }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: () => exitRichEditorFooterUp(this.editor),
    };
  },
});

function exitRichEditorFooterUp(editor: Editor) {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== FOOTER_NODE_NAME || $from.parentOffset) {
    return false;
  }

  const footerDepth = $from.depth;
  const footerPosition = $from.before(footerDepth);
  const $footer = editor.state.doc.resolve(footerPosition);
  if ($footer.index()) {
    return false;
  }

  const paragraphType = editor.schema.nodes[DEFAULT_TEXT_BLOCK_NODE_TYPE];
  if (!$footer.parent.canReplaceWith(0, 0, paragraphType)) {
    return false;
  }

  const transaction = editor.state.tr.insert(footerPosition, paragraphType.create());
  transaction.setSelection(TextSelection.create(transaction.doc, footerPosition + 1));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function buildRichEditorBulletList(getIsRichInputExpanded: () => boolean) {
  return RichEditorBulletList.extend({
    addInputRules() {
      return wrapRichOnlyInputRules(this.parent?.(), getIsRichInputExpanded);
    },
  }).configure({
    HTMLAttributes: {
      class: styles.list,
    },
  });
}

function buildRichEditorOrderedList(getIsRichInputExpanded: () => boolean) {
  return RichEditorOrderedList.extend({
    addInputRules() {
      return wrapRichOnlyInputRules(this.parent?.(), getIsRichInputExpanded);
    },
  }).configure({
    HTMLAttributes: {
      class: styles.list,
    },
  });
}

function wrapRichOnlyInputRules(
  rules: InputRule[] | undefined,
  getIsRichInputExpanded: () => boolean,
) {
  return (rules || []).map((rule) => new InputRule({
    find: rule.find,
    handler: (props) => (getIsRichInputExpanded() ? rule.handler(props) : undefined),
    undoable: rule.undoable,
  }));
}

const RichEditorCodeBlock = CodeBlockLowlightExtension.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Shift-Enter': () => this.editor.commands.newlineInCode(),
    };
  },

  addNodeView() {
    return TeactNodeViewRenderer(EditableCodeBlock, {
      contentDOMElementTag: 'code',
    });
  },
});

const RichEditorCode = CodeExtension.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-m': () => {
        if (this.editor.state.selection.empty && !this.editor.isActive(this.name)) {
          return false;
        }

        return toggleRichEditorCode(this.editor);
      },
      'Mod-M': () => toggleRichEditorCode(this.editor),
    };
  },
});

function toggleRichEditorCode(editor: Editor) {
  return editor.state.selection.empty
    ? editor.commands.toggleCode()
    : editor.commands.toggleSelectionCode();
}

const RichEditorLink = LinkExtension.extend({
  parseMarkdown(token, helpers) {
    const markdown = parseRichMarkdownToken(token, false);
    if (!markdown || !isRichMarkdownWebLink(markdown)) {
      return helpers.parseInline(token.tokens || []);
    }

    return helpers.applyMark('link', helpers.parseInline(token.tokens || []), {
      href: markdown.href,
    });
  },

  addInputRules() {
    return [new InputRule({
      find: RE_RICH_MARKDOWN_LINK_INPUT,
      handler: ({ state, range, match }) => {
        const markdown = parseRichMarkdownLink(match[0]);
        if (!markdown || !isRichMarkdownWebLink(markdown)) {
          return;
        }

        const marks = state.doc.resolve(range.from).marks().filter(({ type }) => type !== this.type);
        marks.push(this.type.create({ href: markdown.href }));
        state.tr
          .replaceWith(range.from, range.to, state.schema.text(markdown.label, marks))
          .removeStoredMark(this.type)
          .scrollIntoView();
      },
    })];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => openRichEditorFormatterControl(this.editor, 'link'),
      'Mod-K': () => openRichEditorFormatterControl(this.editor, 'link'),
    };
  },
});

const RichEditorStrike = StrikeExtension.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Mod-s': () => {
        if (this.editor.state.selection.empty && !this.editor.isActive(this.name)) {
          return false;
        }

        return this.editor.commands.toggleStrike();
      },
    };
  },
});

const RichEditorDate = DateMark.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-d': () => openRichEditorFormatterControl(this.editor, 'date'),
      'Mod-D': () => openRichEditorFormatterControl(this.editor, 'date'),
    };
  },
});

const RichEditorUnderline = UnderlineExtension.extend({
  markdownTokenizer: {
    name: 'underline',
    level: 'inline',
    start: () => -1,
    tokenize: () => undefined,
  },

  parseHTML() {
    return [
      { tag: 'u' },
      { tag: 'ins' },
      {
        style: 'text-decoration',
        consuming: false,
        getAttrs: (style) => (style.includes('underline') ? {} : false),
      },
    ];
  },
});

const RichEditorBulletList = BulletList.extend({
  addAttributes() {
    return {
      [BULLET_LIST_CHECKLIST_ATTR]: {
        default: false,
        parseHTML: (element) => {
          return element.hasAttribute('data-checklist') || element.classList.contains(styles.checklist);
        },
        renderHTML: (attributes) => {
          return attributes[BULLET_LIST_CHECKLIST_ATTR] ? {
            class: styles.checklist,
            'data-checklist': 'true',
          } : {};
        },
      },
    };
  },
});

const RichEditorOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      [ORDERED_LIST_REVERSED_ATTR]: {
        default: false,
        parseHTML: (element) => element.hasAttribute(ORDERED_LIST_REVERSED_ATTR),
        renderHTML: (attributes) => attributes[ORDERED_LIST_REVERSED_ATTR] ? {
          [ORDERED_LIST_REVERSED_ATTR]: '',
        } : {},
      },
    };
  },
});

const RichEditorListItem = ListItem.extend({
  addAttributes() {
    return {
      [LIST_ITEM_CHECKBOX_ATTR]: {
        default: false,
        keepOnSplit: true,
        parseHTML: (element) => {
          return element.hasAttribute('data-checkbox')
            || element.hasAttribute('data-checked')
            || Boolean(element.querySelector(':scope > input[type="checkbox"]'));
        },
        renderHTML: (attributes) => {
          return attributes[LIST_ITEM_CHECKBOX_ATTR] ? { 'data-checkbox': 'true' } : {};
        },
      },
      [LIST_ITEM_CHECKED_ATTR]: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => {
          const checked = element.getAttribute('data-checked');

          return checked === ''
            || checked === 'true'
            || Boolean(element.querySelector(':scope > input[type="checkbox"][checked]'));
        },
        renderHTML: (attributes) => {
          if (!attributes[LIST_ITEM_CHECKBOX_ATTR]) {
            return {};
          }

          return { 'data-checked': attributes[LIST_ITEM_CHECKED_ATTR] ? 'true' : 'false' };
        },
      },
    };
  },

  renderHTML({ node }) {
    if (!node.attrs[LIST_ITEM_CHECKBOX_ATTR]) {
      return ['li', 0];
    }

    const element = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.toggleAttribute('checked', Boolean(node.attrs[LIST_ITEM_CHECKED_ATTR]));
    element.append(input);

    return { dom: element, contentDOM: element };
  },

  addNodeView() {
    return TeactNodeViewRenderer(EditableListItem, {
      as: 'li',
      className: styles.listItem,
    });
  },
});

function buildRichComposerExtensions() {
  return [
    DetailsExtension.configure({
      persist: true,
      openClassName: styles.detailsOpen,
      HTMLAttributes: {
        class: styles.details,
      },
      renderToggleButton: handleRenderDetailsToggleButton,
    }),
    RichEditorDetailsSummary.configure({
      HTMLAttributes: {
        class: styles.detailsSummary,
      },
    }),
    DetailsContentExtension.configure({
      HTMLAttributes: {
        class: styles.detailsContent,
      },
    }),
    ...buildRichEditorTableExtensions(),
  ];
}

const RichEditorDetailsSummary = DetailsSummaryExtension.extend({
  content: RICH_TEXT_INLINE_CONTENT,
});

function handleRenderDetailsToggleButton({ element, isOpen }: DetailsRenderToggleButtonOptions) {
  element.className = styles.detailsToggle;
  element.setAttribute('aria-expanded', String(isOpen));
}
