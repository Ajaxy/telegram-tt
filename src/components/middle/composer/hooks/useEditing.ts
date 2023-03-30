import { useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiFormattedText, ApiMessage } from '../../../../api/types';
import type { MessageListType } from '../../../../global/types';
import type { Signal } from '../../../../util/signals';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { EDITABLE_INPUT_CSS_SELECTOR } from '../../../../config';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import parseMessageInput from '../../../../util/parseMessageInput';
import focusEditableElement from '../../../../util/focusEditableElement';
import { hasMessageMedia } from '../../../../global/helpers';
import { getTextWithEntitiesAsHtml } from '../../../common/helpers/renderTextWithEntities';
import { fastRaf } from '../../../../util/schedulers';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/useBeforeUnload';
import { useDebouncedResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';

const URL_ENTITIES = new Set<string>([ApiMessageEntityTypes.TextUrl, ApiMessageEntityTypes.Url]);
const DEBOUNCE_MS = 300;

const useEditing = (
  getHtml: Signal<string>,
  setHtml: (html: string) => void,
  editedMessage: ApiMessage | undefined,
  resetComposer: (shouldPreserveInput?: boolean) => void,
  openDeleteModal: () => void,
  chatId: string,
  threadId: number,
  type: MessageListType,
  draft?: ApiFormattedText,
  editingDraft?: ApiFormattedText,
  replyingToId?: number,
): [VoidFunction, VoidFunction, boolean] => {
  const { editMessage, setEditingDraft, toggleMessageWebPage } = getActions();
  const [shouldForceShowEditing, setShouldForceShowEditing] = useState(false);

  useEffectWithPrevDeps(([prevEditedMessage, prevReplyingToId]) => {
    if (!editedMessage) {
      return;
    }

    if (replyingToId && prevReplyingToId !== replyingToId) {
      setHtml('');
      setShouldForceShowEditing(false);
      return;
    }

    if (prevEditedMessage?.id === editedMessage.id && replyingToId === prevReplyingToId) {
      return;
    }

    const text = !prevEditedMessage && editingDraft?.text.length ? editingDraft : editedMessage.content.text;
    const html = getTextWithEntitiesAsHtml(text);

    setHtml(html);
    setShouldForceShowEditing(true);
    // `fastRaf` would execute syncronously in this case
    requestAnimationFrame(() => {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      if (messageInput) {
        focusEditableElement(messageInput, true);
      }
    });
  }, [editedMessage, replyingToId, editingDraft, setHtml]);

  useEffect(() => {
    if (!editedMessage) {
      return;
    }

    const shouldSetNoWebPage = !('webPage' in editedMessage.content)
        && editedMessage.content.text?.entities?.some((entity) => URL_ENTITIES.has(entity.type));

    toggleMessageWebPage({
      chatId,
      threadId,
      noWebPage: shouldSetNoWebPage,
    });
  }, [chatId, threadId, editedMessage]);

  useEffect(() => {
    if (!editedMessage) return undefined;
    return () => {
      const edited = parseMessageInput(getHtml());
      const update = edited.text.length ? edited : undefined;

      setEditingDraft({
        chatId, threadId, type, text: update,
      });
    };
  }, [chatId, editedMessage, getHtml, setEditingDraft, threadId, type]);

  const detectLinkDebounced = useDebouncedResolver(() => {
    if (!editedMessage) return false;

    const edited = parseMessageInput(getHtml());
    return !('webPage' in editedMessage.content)
      && editedMessage.content.text?.entities?.some((entity) => URL_ENTITIES.has(entity.type))
      && !(edited.entities?.some((entity) => URL_ENTITIES.has(entity.type)));
  }, [editedMessage, getHtml], DEBOUNCE_MS, true);

  const getShouldResetNoWebPageDebounced = useDerivedSignal(detectLinkDebounced, [detectLinkDebounced, getHtml], true);

  useEffectWithPrevDeps(([prevEditedMessage]) => {
    if (!editedMessage || prevEditedMessage?.id !== editedMessage.id) {
      return;
    }

    if (getShouldResetNoWebPageDebounced()) {
      toggleMessageWebPage({
        chatId,
        threadId,
        noWebPage: false,
      });
    }
  }, [editedMessage, chatId, getHtml, threadId, getShouldResetNoWebPageDebounced]);

  const restoreNewDraftAfterEditing = useCallback(() => {
    if (!draft) return;
    // Run 1 frame after editing draft reset
    fastRaf(() => {
      setHtml(getTextWithEntitiesAsHtml(draft));
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      if (messageInput) {
        requestAnimationFrame(() => {
          focusEditableElement(messageInput, true);
        });
      }
    });
  }, [draft, setHtml]);

  const handleEditCancel = useCallback(() => {
    resetComposer();
    restoreNewDraftAfterEditing();
  }, [resetComposer, restoreNewDraftAfterEditing]);

  const handleEditComplete = useCallback(() => {
    const { text, entities } = parseMessageInput(getHtml());

    if (!editedMessage) {
      return;
    }

    if (!text && !hasMessageMedia(editedMessage)) {
      openDeleteModal();
      return;
    }

    editMessage({
      text,
      entities,
    });

    resetComposer();
    restoreNewDraftAfterEditing();
  }, [editMessage, editedMessage, getHtml, openDeleteModal, resetComposer, restoreNewDraftAfterEditing]);

  const handleBlur = useCallback(() => {
    if (!editedMessage) return;
    const edited = parseMessageInput(getHtml());
    const update = edited.text.length ? edited : undefined;

    setEditingDraft({
      chatId, threadId, type, text: update,
    });
  }, [chatId, editedMessage, getHtml, setEditingDraft, threadId, type]);

  useBackgroundMode(handleBlur);
  useBeforeUnload(handleBlur);

  return [handleEditComplete, handleEditCancel, shouldForceShowEditing];
};

export default useEditing;
