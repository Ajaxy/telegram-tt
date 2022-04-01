import { useCallback, useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { ApiFormattedText, ApiMessage } from '../../../../api/types';
import { MessageListType } from '../../../../global/types';

import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import { EDITABLE_INPUT_CSS_SELECTOR } from '../../../../config';
import parseMessageInput from '../../../../util/parseMessageInput';
import focusEditableElement from '../../../../util/focusEditableElement';
import { hasMessageMedia } from '../../../../global/helpers';
import { getTextWithEntitiesAsHtml } from '../../../common/helpers/renderTextWithEntities';
import { fastRaf } from '../../../../util/schedulers';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/useBeforeUnload';

const useEditing = (
  htmlRef: { current: string },
  setHtml: (html: string) => void,
  editedMessage: ApiMessage | undefined,
  resetComposer: (shouldPreserveInput?: boolean) => void,
  openDeleteModal: () => void,
  chatId: string,
  threadId: number,
  type: MessageListType,
  draft?: ApiFormattedText,
  editingDraft?: ApiFormattedText,
) => {
  const { editMessage, setEditingDraft } = getActions();

  useEffectWithPrevDeps(([prevEditedMessage]) => {
    if (!editedMessage) {
      return;
    }
    if (prevEditedMessage?.id === editedMessage.id) {
      return;
    }

    const html = getTextWithEntitiesAsHtml(editingDraft?.text.length ? editingDraft : editedMessage.content.text);
    setHtml(html);
    // `fastRaf` would execute syncronously in this case
    requestAnimationFrame(() => {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      if (messageInput) {
        focusEditableElement(messageInput, true);
      }
    });
  }, [editedMessage, setHtml] as const);

  useEffect(() => {
    if (!editedMessage) return undefined;
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const edited = parseMessageInput(htmlRef.current!);
      const update = edited.text.length ? edited : undefined;
      setEditingDraft({
        chatId, threadId, type, text: update,
      });
    };
  }, [chatId, editedMessage, htmlRef, setEditingDraft, threadId, type]);

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
    const { text, entities } = parseMessageInput(htmlRef.current!);

    if (!editedMessage) {
      return;
    }

    if (!text && !hasMessageMedia(editedMessage)) {
      openDeleteModal();
      return;
    }

    editMessage({
      messageId: editedMessage.id,
      text,
      entities,
    });

    resetComposer();
    restoreNewDraftAfterEditing();
  }, [editMessage, editedMessage, htmlRef, openDeleteModal, resetComposer, restoreNewDraftAfterEditing]);

  const handleBlur = useCallback(() => {
    if (!editedMessage) return;
    const edited = parseMessageInput(htmlRef.current!);
    const update = edited.text.length ? edited : undefined;
    setEditingDraft({
      chatId, threadId, type, text: update,
    });
  }, [chatId, editedMessage, htmlRef, setEditingDraft, threadId, type]);

  useBackgroundMode(handleBlur);
  useBeforeUnload(handleBlur);

  return [handleEditComplete, handleEditCancel];
};

export default useEditing;
