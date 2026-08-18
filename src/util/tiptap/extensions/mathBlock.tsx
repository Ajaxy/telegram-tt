import {
  InputRule, Node as TiptapNode, nodeInputRule,
} from '@tiptap/core';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import {
  useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';
import type { TeactNodeViewComponentProps } from '../TeactNodeViewRenderer';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../buildClassName';
import { MATH_BLOCK_NODE_NAME, MATH_INLINE_NODE_NAME } from '../constants';
import { escapeRichMarkdownHtml } from '../richMarkdown';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Latex from '../../../components/iv/Latex';
import Portal from '../../../components/ui/Portal';
import TextFormatterInput from '../../../components/ui/textInput/TextFormatterInput';
import TeactNodeViewRenderer from '../TeactNodeViewRenderer';

import textFormatterStyles from '../../../components/ui/textInput/TextFormatter.module.scss';
import styles from '../styling.module.scss';

const MATH_BLOCK_INPUT_REGEX = /^\$\$(?=\S).*\S\$\$$/;
const MATH_BLOCK_TOKEN_REGEX = /^\$\$\s*([\s\S]*?)\s*\$\$(?:\n|$)/;
const MATH_FENCE_TOKEN_REGEX = /^```math[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/;
const MATH_FENCE_INPUT_REGEX = /^```math[\s\n]$/;
const MATH_INLINE_INPUT_REGEX = /(?:^|\s)(\$(?!\$)(?=\S)(.*?\S)\$(?!\$))$/;
const MATH_INLINE_TOKEN_REGEX = /^\$(?!\$)(?=\S)(.*?\S)\$(?!\$)/;

const MathNode = TiptapNode.create({
  name: 'math',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (element: HTMLElement) => element.dataset.source || element.textContent || '',
      },
    };
  },

  renderText({ node }) {
    return node.attrs.source;
  },

  addNodeView() {
    const isInline = this.name === MATH_INLINE_NODE_NAME;

    return TeactNodeViewRenderer(EditableMath, {
      as: isInline ? 'span' : undefined,
      className: styles.mathNode,
    });
  },
});

export const MathBlockNode = MathNode.extend({
  name: MATH_BLOCK_NODE_NAME,
  group: 'block',
  priority: 101,

  parseHTML() {
    return [
      { tag: 'tg-math-block' },
      { tag: 'div[data-rich-block-type="math"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tg-math-block', HTMLAttributes.source];
  },

  renderMarkdown(node) {
    const source = String(node.attrs?.source || '');
    return source.includes('$$')
      ? `<tg-math-block>${escapeRichMarkdownHtml(source)}</tg-math-block>`
      : `$$${source}$$`;
  },

  parseMarkdown(token, helpers) {
    return helpers.createNode(MATH_BLOCK_NODE_NAME, { source: token.text || '' });
  },

  markdownTokenizer: {
    name: MATH_BLOCK_NODE_NAME,
    level: 'block',
    start: (source) => source.search(/\$\$|```math/),
    tokenize: (source) => {
      const match = MATH_BLOCK_TOKEN_REGEX.exec(source) || MATH_FENCE_TOKEN_REGEX.exec(source);
      if (!match) {
        return undefined;
      }

      return {
        type: MATH_BLOCK_NODE_NAME,
        raw: match[0],
        text: match[1],
      };
    },
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: MATH_BLOCK_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({ source: match[0].slice(2, -2) }),
      }),
      nodeInputRule({
        find: MATH_FENCE_INPUT_REGEX,
        type: this.type,
      }),
    ];
  },
});

export const MathInlineNode = MathNode.extend({
  name: MATH_INLINE_NODE_NAME,
  group: 'inline',
  inline: true,

  parseHTML() {
    return [
      { tag: 'span[data-rich-text-type="math"]' },
      { tag: 'tg-math' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tg-math', HTMLAttributes.source];
  },

  renderMarkdown(node) {
    const source = String(node.attrs?.source || '');
    return source.includes('$') || source.includes('\n')
      ? `<tg-math>${escapeRichMarkdownHtml(source)}</tg-math>`
      : `$${source}$`;
  },

  parseMarkdown(token, helpers) {
    return helpers.createNode(MATH_INLINE_NODE_NAME, { source: token.text || '' });
  },

  markdownTokenizer: {
    name: MATH_INLINE_NODE_NAME,
    level: 'inline',
    start: (source) => source.indexOf('$'),
    tokenize: (source) => {
      const match = MATH_INLINE_TOKEN_REGEX.exec(source);
      if (!match) {
        return undefined;
      }

      return {
        type: MATH_INLINE_NODE_NAME,
        raw: match[0],
        text: match[1],
      };
    },
  },

  addInputRules() {
    return [new InputRule({
      find: MATH_INLINE_INPUT_REGEX,
      handler: ({ state, range, match }) => {
        state.tr.replaceWith(
          range.to - match[1].length,
          range.to,
          this.type.create({ source: match[2] }),
        );
      },
    })];
  },
});

function EditableMath({
  editor, node, selected, getPos,
}: TeactNodeViewComponentProps) {
  const isInline = node.type.name === MATH_INLINE_NODE_NAME;
  const mathRef = useRef<HTMLSpanElement>();
  const editorRef = useRef<HTMLDivElement>();
  const nodePosition = getPos();
  const isMathNodeSelected = selected
    && typeof nodePosition === 'number'
    && editor.state.selection instanceof NodeSelection
    && editor.state.selection.from === nodePosition;
  const [isEditorOpen, setIsEditorOpen] = useState(isMathNodeSelected);
  const [editorAnchor, setEditorAnchor] = useState<IAnchorPosition>();
  const lang = useLang();

  const source = typeof node.attrs.source === 'string' ? node.attrs.source : '';
  const hasSource = Boolean(source.trim());
  const canToggleDisplayMode = Boolean(buildDisplayModeTransaction(editor, node, getPos));

  const updateEditorAnchor = useLastCallback(() => {
    requestMeasure(() => {
      const math = mathRef.current;
      if (!math) {
        return;
      }

      const rect = math.getBoundingClientRect();
      setEditorAnchor({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    });
  });

  useEffect(() => {
    setIsEditorOpen(isMathNodeSelected);
  }, [isMathNodeSelected]);

  useEffect(() => {
    if (!isEditorOpen) {
      setEditorAnchor(undefined);
      return undefined;
    }

    updateEditorAnchor();
    window.addEventListener('resize', updateEditorAnchor);
    document.addEventListener('scroll', updateEditorAnchor, true);

    return () => {
      window.removeEventListener('resize', updateEditorAnchor);
      document.removeEventListener('scroll', updateEditorAnchor, true);
    };
  }, [isEditorOpen, updateEditorAnchor]);

  useEffect(() => {
    if (!isEditorOpen) {
      return undefined;
    }

    function handleDocumentMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (mathRef.current?.contains(target) || editorRef.current?.contains(target)) {
        return;
      }

      setIsEditorOpen(false);
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [isEditorOpen]);

  function handleMathMouseDown() {
    setIsEditorOpen(true);
  }

  const handleSourceChange = useLastCallback((value: string) => {
    const position = getPos();
    if (typeof position !== 'number') {
      return;
    }

    const currentNode = editor.state.doc.nodeAt(position);
    if (currentNode?.type !== node.type) {
      return;
    }

    const transaction = editor.state.tr.setNodeMarkup(position, undefined, {
      ...currentNode.attrs,
      source: value,
    });
    transaction.setSelection(NodeSelection.create(transaction.doc, position));
    editor.view.dispatch(transaction);
  });

  const deleteMath = useLastCallback(() => {
    const position = getPos();
    if (typeof position !== 'number') {
      return;
    }

    editor.chain().focus().deleteRange({
      from: position,
      to: position + node.nodeSize,
    }).run();
  });

  const toggleDisplayMode = useLastCallback(() => {
    const transaction = buildDisplayModeTransaction(editor, node, getPos);
    if (!transaction) {
      return;
    }

    editor.view.dispatch(transaction);
    editor.commands.focus();
  });

  function handleEditorMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  const closeEditor = useLastCallback(() => {
    setIsEditorOpen(false);
    editor.commands.focus();
  });

  const submitEditor = useLastCallback(() => {
    setIsEditorOpen(false);

    const position = getPos();
    if (typeof position !== 'number') {
      return;
    }

    const nextSelection = Selection.near(editor.state.doc.resolve(position + node.nodeSize));
    editor.view.dispatch(editor.state.tr.setSelection(nextSelection));
    editor.commands.focus();
  });

  const editorStyle = editorAnchor
    ? `left: ${editorAnchor.x}px; top: ${editorAnchor.y}px;`
    : undefined;

  return (
    <>
      <span
        ref={mathRef}
        className={buildClassName(isInline ? styles.mathInline : styles.mathBlock, selected && styles.mathSelected)}
        contentEditable={false}
        onMouseDown={handleMathMouseDown}
      >
        {hasSource ? (
          <Latex source={source} isBlock={isInline ? undefined : true} />
        ) : (
          <span className={styles.mathPlaceholder}>{lang('RichEditorFormulaPrompt')}</span>
        )}
      </span>
      {isEditorOpen && editorAnchor && (
        <Portal>
          <div
            ref={editorRef}
            className={buildClassName(textFormatterStyles.inputPopup, styles.mathEditor)}
            style={editorStyle}
            contentEditable={false}
            onMouseDown={handleEditorMouseDown}
          >
            <TextFormatterInput
              value={source}
              placeholder={lang('RichEditorFormulaPrompt')}
              ariaLabel={lang('RichEditorFormula')}
              isActive
              leadingButtonIconName={canToggleDisplayMode
                ? (!isInline ? 'table-merge-horizontal' : 'table-split-horizontal')
                : undefined}
              leadingButtonAriaLabel={canToggleDisplayMode
                ? lang(isInline ? 'RichEditorFormulaToBlock' : 'RichEditorFormulaToInline')
                : undefined}
              shouldSpellCheck={false}
              dir="ltr"
              onChange={handleSourceChange}
              onSubmit={submitEditor}
              onEscape={closeEditor}
              onDeleteEmpty={deleteMath}
              onLeadingButtonClick={canToggleDisplayMode ? toggleDisplayMode : undefined}
            />
          </div>
        </Portal>
      )}
    </>
  );
}

function buildDisplayModeTransaction(
  editor: TeactNodeViewComponentProps['editor'],
  node: TeactNodeViewComponentProps['node'],
  getPos: TeactNodeViewComponentProps['getPos'],
) {
  const position = getPos();
  if (typeof position !== 'number' || editor.state.doc.nodeAt(position)?.type !== node.type) {
    return undefined;
  }

  const targetTypeName = node.isInline ? MATH_BLOCK_NODE_NAME : MATH_INLINE_NODE_NAME;
  const targetType = editor.schema.nodes[targetTypeName];
  const targetNode = targetType.create(node.attrs);
  const $position = editor.state.doc.resolve(position);
  const transaction = editor.state.tr;
  let canReplaceParent = false;
  if (node.isInline && $position.parent.childCount === 1) {
    const parentIndex = $position.index($position.depth - 1);
    canReplaceParent = $position.node($position.depth - 1).canReplaceWith(
      parentIndex,
      parentIndex + 1,
      targetType,
    );
  }
  const targetPosition = canReplaceParent ? $position.before() : position + 1;

  if (canReplaceParent) {
    transaction.replaceRangeWith($position.before(), $position.after(), targetNode);
  } else {
    transaction.replaceWith(position, position + node.nodeSize, targetNode);
  }

  if (transaction.doc.nodeAt(targetPosition) !== targetNode) {
    return undefined;
  }

  transaction.setSelection(NodeSelection.create(transaction.doc, targetPosition));
  return transaction;
}
