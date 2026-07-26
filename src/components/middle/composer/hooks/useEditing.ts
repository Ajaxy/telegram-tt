import { useEffect, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiDraft, ApiInputRichMessage, ApiMessage,
} from '../../../../api/types';
import type { EditingDraft, MessageListType, ThreadId } from '../../../../types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { EDITABLE_INPUT_CSS_SELECTOR } from '../../../../config';
import { requestMeasure, requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { hasMessageMedia } from '../../../../global/helpers';
import focusEditableElement from '../../../../util/focusEditableElement';
import { buildRichMessageFromFormatted, getRichInputAsFormatted } from '../../../ui/textInput/richText';

import { useDebouncedResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../../hooks/useLastCallback';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/window/useBeforeUnload';

const URL_ENTITIES = new Set<string>([ApiMessageEntityTypes.TextUrl, ApiMessageEntityTypes.Url]);
const DEBOUNCE_MS = 300;

const useEditing = (
  richMessage: ApiInputRichMessage | undefined,
  replaceRichMessage: (richMessage?: ApiInputRichMessage) => void,
  editedMessage: ApiMessage | undefined,
  resetComposer: (shouldPreserveInput?: boolean, shouldSkipCollapseLatch?: boolean) => void,
  validateTextLength: (text: string) => boolean,
  chatId: string,
  threadId: ThreadId,
  type: MessageListType,
  draft?: ApiDraft,
  editingDraft?: EditingDraft,
): [VoidFunction, VoidFunction, boolean] => {
  const {
    editMessage, setEditingDraft, toggleMessageWebPage, openDeleteMessageModal,
  } = getActions();
  const [shouldForceShowEditing, setShouldForceShowEditing] = useState(false);

  const replyingToId = draft?.replyInfo?.replyToMsgId;

  useEffectWithPrevDeps(([prevEditedMessage, prevReplyingToId]) => {
    if (!editedMessage) {
      return;
    }

    if (replyingToId && prevReplyingToId !== replyingToId) {
      replaceRichMessage(undefined);
      setShouldForceShowEditing(false);
      return;
    }

    if (prevEditedMessage?.id === editedMessage.id && replyingToId === prevReplyingToId) {
      return;
    }

    const restoredRichMessage = editingDraft?.richMessage
      || (editingDraft?.text?.length ? buildRichMessageFromFormatted(editingDraft) : undefined);
    const nextRichMessage = !prevEditedMessage && restoredRichMessage
      ? restoredRichMessage
      : editedMessage.content.richMessage || buildRichMessageFromFormatted(editedMessage.content.text);

    replaceRichMessage(nextRichMessage);
    setShouldForceShowEditing(true);

    requestNextMutation(() => {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      if (messageInput) {
        focusEditableElement(messageInput, true);
      }
    });
  }, [editedMessage, replyingToId, editingDraft, replaceRichMessage]);

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

  const saveEditingDraft = useLastCallback((
    scopedChatId: string,
    scopedThreadId: ThreadId,
    scopedType: MessageListType,
  ) => {
    setEditingDraft({
      chatId: scopedChatId,
      threadId: scopedThreadId,
      type: scopedType,
      draft: buildEditingDraft(richMessage),
    });
  });

  useEffect(() => (
    editedMessage ? () => saveEditingDraft(chatId, threadId, type) : undefined
  ), [chatId, editedMessage, threadId, type]);

  const detectLinkDebounced = useDebouncedResolver(() => {
    if (!editedMessage) return false;

    const edited = richMessage ? getRichInputAsFormatted(richMessage) : undefined;
    return !('webPage' in editedMessage.content)
      && editedMessage.content.text?.entities?.some((entity) => URL_ENTITIES.has(entity.type))
      && !(edited?.entities?.some((entity) => URL_ENTITIES.has(entity.type)));
  }, [editedMessage, richMessage], DEBOUNCE_MS, true);

  const getShouldResetNoWebPageDebounced = useDerivedSignal(
    detectLinkDebounced, [detectLinkDebounced, richMessage], true,
  );

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
  }, [editedMessage, chatId, threadId, getShouldResetNoWebPageDebounced]);

  const restoreNewDraftAfterEditing = useLastCallback(() => {
    if (!draft) return;

    // Run one frame after editing draft reset
    requestMeasure(() => {
      replaceRichMessage(draft.richMessage || buildRichMessageFromFormatted(draft.text));

      // Wait one more frame until new editor content is rendered
      requestNextMutation(() => {
        const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
        if (messageInput) {
          focusEditableElement(messageInput, true);
        }
      });
    });
  });

  const handleEditCancel = useLastCallback(() => {
    resetComposer(false, true);
    setEditingDraft({ chatId, threadId, type, draft: undefined });
    restoreNewDraftAfterEditing();
  });

  const handleEditComplete = useLastCallback(() => {
    const { text, entities } = richMessage ? getRichInputAsFormatted(richMessage) || { text: '' } : { text: '' };

    if (!editedMessage) {
      return;
    }

    if (!text && !hasMessageMedia(editedMessage)) {
      openDeleteMessageModal({
        chatId,
        messageIds: [editedMessage.id],
        isSchedule: type === 'scheduled',
      });
      return;
    }

    if (text && !validateTextLength(text)) {
      return;
    }

    editMessage({
      messageList: { chatId, threadId, type },
      text,
      entities,
    });

    resetComposer(false, true);
    setEditingDraft({ chatId, threadId, type, draft: undefined });
    restoreNewDraftAfterEditing();
  });

  const handleBlur = useLastCallback(() => {
    if (!editedMessage) return;

    setEditingDraft({
      chatId, threadId, type, draft: buildEditingDraft(richMessage),
    });
  });

  useBackgroundMode(handleBlur);
  useBeforeUnload(handleBlur);

  return [handleEditComplete, handleEditCancel, shouldForceShowEditing];
};

function buildEditingDraft(richMessage: ApiInputRichMessage | undefined): EditingDraft | undefined {
  if (!richMessage) return undefined;

  const formattedMessage = getRichInputAsFormatted(richMessage);
  if (formattedMessage?.text.length) return formattedMessage;
  if (formattedMessage || !richMessage.blocks.length) return undefined;

  return {
    richMessage,
  };
}

export default useEditing;
