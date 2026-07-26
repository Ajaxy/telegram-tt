import type { Editor } from '@tiptap/core';
import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { TeactNodeViewComponentProps } from '../TeactNodeViewRenderer';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectPeer, selectPeerByUsername, selectUser } from '../../../global/selectors';
import buildDefinedAttributes from './buildDefinedAttributes';

import Avatar from '../../../components/common/Avatar';
import NodeViewContent from '../NodeViewContent';
import TeactNodeViewRenderer from '../TeactNodeViewRenderer';

import styles from '../styling.module.scss';

const MENTION_AVATAR_SIZE = 16;
const MENTION_NAME_PARSE_PRIORITY = 100;

export const MentionNode = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  content: 'text*',
  marks: '',
  selectable: false,

  addAttributes() {
    return {
      userId: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.dataset.userId,
      },
      username: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.dataset.username,
      },
      label: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.dataset.label,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[href^="tg://user?id="]',
        priority: MENTION_NAME_PARSE_PRIORITY,
        getAttrs: (element) => buildMentionNameAttrs(element),
      },
      { tag: 'span[data-rich-text-type="mention"]' },
      { tag: 'span[data-rich-text-type="mention-name"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', buildDefinedAttributes({
      class: styles.mention,
      'data-rich-text-type': 'mention',
      'data-user-id': HTMLAttributes.userId,
      'data-username': HTMLAttributes.username,
      'data-label': HTMLAttributes.label,
    }), 0];
  },

  addNodeView() {
    return TeactNodeViewRenderer(EditableMention, {
      as: 'span',
      className: styles.mention,
      contentDOMElementTag: 'span',
      contentDOMClassName: styles.mentionContentDom,
      selectedOnTextSelection: true,
    });
  },

  addKeyboardShortcuts() {
    return {
      ArrowLeft: () => moveCursorOutsideMention(this.editor, this.name, 'backward'),
      ArrowRight: () => moveCursorOutsideMention(this.editor, this.name, 'forward'),
      Backspace: () => deleteMentionCharacter(this.editor, this.name, 'backward'),
      Delete: () => deleteMentionCharacter(this.editor, this.name, 'forward'),
    };
  },
});

function EditableMention({ node, contentDOMElement }: TeactNodeViewComponentProps) {
  const peer = getMentionPeer(node.attrs);
  const isEmpty = !node.textContent;
  const hasUserReference = Boolean(node.attrs.userId || node.attrs.username);
  const isReadOnly = hasUserReference && !peer;

  useMentionChrome(contentDOMElement, isEmpty);

  return (
    <>
      {peer && (
        <span className={styles.mentionAvatar} contentEditable={false}>
          <Avatar size={MENTION_AVATAR_SIZE} peer={peer} />
        </span>
      )}
      <NodeViewContent as="span" className={styles.mentionContent} contentEditable={isReadOnly ? false : undefined} />
    </>
  );
}

function useMentionChrome(contentDOMElement: HTMLElement | undefined, isEmpty: boolean) {
  useEffect(() => {
    const mentionElement = getMentionElement(contentDOMElement);
    if (!mentionElement) {
      return undefined;
    }

    requestMutation(() => {
      mentionElement.classList.toggle(styles.mentionEmpty, isEmpty);
    });

    return () => {
      requestMutation(() => {
        mentionElement.classList.remove(styles.mentionEmpty);
      });
    };
  }, [contentDOMElement, isEmpty]);
}

function getMentionElement(contentDOMElement: HTMLElement | undefined) {
  return contentDOMElement?.closest<HTMLElement>(`.${styles.mention}`);
}

function getMentionPeer(attrs: AnyLiteral): ApiPeer | undefined {
  const userId = typeof attrs.userId === 'string' ? attrs.userId : undefined;
  if (userId) {
    return selectPeer(getGlobal(), userId);
  }

  const username = typeof attrs.username === 'string' ? attrs.username.toLowerCase() : undefined;
  if (!username) {
    return undefined;
  }

  return selectPeerByUsername(getGlobal(), username);
}

function buildMentionNameAttrs(element: HTMLElement | string) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const href = element.getAttribute('href');
  if (!href) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }

  if (url.protocol !== 'tg:' || url.host !== 'user') {
    return false;
  }

  const userId = url.searchParams.get('id') || undefined;
  const user = userId ? selectUser(getGlobal(), userId) : undefined;
  if (!user?.accessHash) {
    return false;
  }

  return { userId };
}

function moveCursorOutsideMention(editor: Editor, typeName: string, direction: 'backward' | 'forward') {
  const { state, view } = editor;
  const { selection } = state;
  if (!selection.empty) {
    return false;
  }

  const mentionRange = getSelectedMentionRange(selection.$from, typeName);
  if (!mentionRange) {
    return false;
  }

  const targetPosition = direction === 'backward' ? mentionRange.before : mentionRange.after;
  const isAtBoundary = direction === 'backward'
    ? selection.$from.pos <= mentionRange.contentStart
    : selection.$from.pos >= mentionRange.contentEnd;

  if (!isAtBoundary) {
    return false;
  }

  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, targetPosition)));
  return true;
}

function deleteMentionCharacter(editor: Editor, typeName: string, direction: 'backward' | 'forward') {
  const { state, view } = editor;
  const { selection } = state;
  if (!selection.empty) {
    return false;
  }

  const mentionRange = getSelectedMentionRange(selection.$from, typeName);
  if (!mentionRange) {
    return false;
  }

  const from = direction === 'backward' ? selection.$from.pos - 1 : selection.$from.pos;
  const to = from + 1;
  if (from < mentionRange.contentStart || to > mentionRange.contentEnd) {
    return false;
  }

  const transaction = state.tr.delete(from, to);
  view.dispatch(transaction.setSelection(TextSelection.create(transaction.doc, from)));
  return true;
}

function getSelectedMentionRange($position: TextSelection['$from'], typeName: string) {
  for (let depth = $position.depth; depth > 0; depth--) {
    const node = $position.node(depth);
    if (node.type.name !== typeName) {
      continue;
    }

    const before = $position.before(depth);
    const after = before + node.nodeSize;

    return {
      before,
      after,
      contentStart: before + 1,
      contentEnd: after - 1,
    };
  }

  return undefined;
}
