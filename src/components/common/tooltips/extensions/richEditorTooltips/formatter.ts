import type { Editor } from '@tiptap/core';
import {
  AllSelection, type EditorState, Plugin, Selection, TextSelection,
} from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

import type { RichEditorTooltipsConfig } from '../../types';
import type { GetTooltipController } from './suggestion';

import { IS_IOS } from '../../../../../util/browser/windowEnvironment';
import parseEmojiOnlyString from '../../../../../util/emoji/parseEmojiOnlyString';
import { isUnsuitableNode } from './suggestion';

// Allows browser selection geometry to settle and preserves triple-click selection
const SELECTION_RECALCULATE_DELAY_MS = 260;

export function buildFormatterPlugin(
  editor: Editor,
  config: RichEditorTooltipsConfig,
  getController: GetTooltipController,
) {
  let selectionTimeout: number | undefined;
  let isSelecting = false;

  function updateFormatter(view: EditorView, hasDocChanged = false) {
    getController()?.updateFormatter(
      getFormatterRange(editor, view.state, config),
      hasDocChanged,
    );
  }

  function clearSelectionTimeout() {
    if (selectionTimeout) {
      window.clearTimeout(selectionTimeout);
      selectionTimeout = undefined;
    }
  }

  function handleMouseUp() {
    isSelecting = false;
    document.removeEventListener('mouseup', handleMouseUp);
    clearSelectionTimeout();
    selectionTimeout = window.setTimeout(() => {
      selectionTimeout = undefined;
      if (!editor.isDestroyed) {
        updateFormatter(editor.view);
      }
    }, SELECTION_RECALCULATE_DELAY_MS);
  }

  function handleMouseDown(_view: EditorView, event: MouseEvent) {
    if (event.button !== 0) {
      return false;
    }

    isSelecting = true;
    clearSelectionTimeout();
    document.removeEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp, { once: true });
    getController()?.updateFormatter(undefined);
    return false;
  }

  function destroy() {
    clearSelectionTimeout();
    document.removeEventListener('mouseup', handleMouseUp);
  }

  return new Plugin({
    view: () => ({
      update: (nextView, previousState) => {
        if (nextView.state.doc.eq(previousState.doc) && nextView.state.selection.eq(previousState.selection)) {
          return;
        }

        const hasDocChanged = !nextView.state.doc.eq(previousState.doc);
        if (isSelecting || selectionTimeout) {
          if (hasDocChanged) {
            getController()?.updateFormatter(undefined, true);
          }
          return;
        }

        updateFormatter(nextView, hasDocChanged);
      },
      destroy,
    }),
    props: {
      handleDOMEvents: {
        mousedown: handleMouseDown,
      },
    },
  });
}

export function refreshFormatter(
  editor: Editor,
  config: RichEditorTooltipsConfig,
  getController: GetTooltipController,
) {
  getController()?.updateFormatter(getFormatterRange(editor, editor.state, config));
}

function getFormatterRange(editor: Editor, state: EditorState, config: RichEditorTooltipsConfig) {
  const context = config.getContext();
  if (
    !config.formatter?.isEnabled()
    || !editor.isEditable
    || editor.isDestroyed
    || IS_IOS
    || context.isFormatterDisabled
    || context.isFormatterContextMenuOpen
  ) {
    return undefined;
  }

  const range = getTextSelectionRange(state);
  if (!range) {
    return undefined;
  }

  const text = state.doc.textBetween(range.from, range.to, '\n', '\n').trim();
  if (!text || parseEmojiOnlyString(text)) {
    return undefined;
  }

  let hasUnsuitableNode = false;
  state.doc.nodesBetween(range.from, range.to, (node) => {
    hasUnsuitableNode ||= isUnsuitableNode(node.type.name);
    return !hasUnsuitableNode;
  });
  return hasUnsuitableNode ? undefined : range;
}

function getTextSelectionRange(state: EditorState) {
  const { selection } = state;
  if (selection instanceof TextSelection && !selection.empty) {
    return { from: selection.from, to: selection.to };
  }

  if (selection instanceof AllSelection) {
    return {
      from: Selection.atStart(state.doc).from,
      to: Selection.atEnd(state.doc).to,
    };
  }

  return undefined;
}
