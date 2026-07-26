import { useEffect, useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiDraft, ApiMessage } from '../../../../api/types';
import type { ThreadId } from '../../../../types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { DRAFT_DEBOUNCE, EDITABLE_INPUT_CSS_SELECTOR } from '../../../../config';
import {
  requestMeasure, requestNextMutation,
} from '../../../../lib/fasterdom/fasterdom';
import { areDeepEqual } from '../../../../util/areDeepEqual';
import focusEditableElement from '../../../../util/focusEditableElement';
import {
  buildRichMessageFromFormatted,
  getRichInputAsFormatted,
} from '../../../ui/textInput/richText';

import useLastCallback from '../../../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../../../hooks/useLayoutEffectWithPrevDeps';
import useRunDebounced from '../../../../hooks/useRunDebounced';
import { useStateRef } from '../../../../hooks/useStateRef';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/window/useBeforeUnload';

let isFrozen = false;

function freeze() {
  isFrozen = true;

  requestMeasure(() => {
    isFrozen = false;
  });
}

const useDraft = ({
  draft,
  chatId,
  threadId,
  richMessage,
  replaceRichMessage,
  editedMessage,
  isDisabled,
}: {
  draft?: ApiDraft;
  chatId: string;
  threadId: ThreadId;
  richMessage?: ApiDraft['richMessage'];
  replaceRichMessage: (richMessage?: ApiDraft['richMessage']) => void;
  editedMessage?: ApiMessage;
  isDisabled?: boolean;
}) => {
  const { saveDraft, clearDraft, loadCustomEmojis } = getActions();

  const isTouchedRef = useRef(false);

  useEffect(() => {
    const isLocalDraft = draft?.isLocal !== undefined;
    if (
      areDeepEqual(getDraftRichMessage(draft), richMessage)
      && !isLocalDraft
    ) {
      isTouchedRef.current = false;
    } else {
      isTouchedRef.current = true;
    }
  }, [draft, richMessage]);
  useEffect(() => {
    isTouchedRef.current = false;
  }, [chatId, threadId]);

  const isEditing = Boolean(editedMessage);

  const updateDraft = useLastCallback((prevState: { chatId?: string; threadId?: ThreadId } = {}) => {
    if (isDisabled || isEditing || !isTouchedRef.current) return;

    const currentRichMessage = richMessage?.blocks.length ? richMessage : undefined;
    const formattedRichMessage = currentRichMessage ? getRichInputAsFormatted(currentRichMessage) : undefined;

    if (currentRichMessage && !formattedRichMessage) {
      requestMeasure(() => {
        saveDraft({
          chatId: prevState.chatId ?? chatId,
          threadId: prevState.threadId ?? threadId,
          text: undefined,
          richMessage: currentRichMessage,
        });
      });
    } else if (formattedRichMessage?.text) {
      requestMeasure(() => {
        saveDraft({
          chatId: prevState.chatId ?? chatId,
          threadId: prevState.threadId ?? threadId,
          text: formattedRichMessage,
        });
      });
    } else {
      clearDraft({
        chatId: prevState.chatId ?? chatId,
        threadId: prevState.threadId ?? threadId,
        shouldKeepReply: true,
        shouldKeepSuggestedPost: true,
      });
    }
  });

  const runDebouncedForSaveDraft = useRunDebounced(DRAFT_DEBOUNCE, true, undefined, [chatId, threadId]);

  // Restore draft on chat change
  useLayoutEffectWithPrevDeps(([prevChatId, prevThreadId, prevDraft]) => {
    if (isDisabled) {
      return;
    }
    const isTouched = isTouchedRef.current;
    const shouldUpdateSuggestedPost = draft?.suggestedPostInfo && !prevDraft?.suggestedPostInfo;

    if (chatId === prevChatId && threadId === prevThreadId) {
      if (isTouched && !draft) return; // Prevent reset from other client if we have local edits
      if (!draft && prevDraft) {
        replaceRichMessage(undefined);
      }

      if (isTouched && !shouldUpdateSuggestedPost) return;
    }

    if (editedMessage || !draft) {
      return;
    }

    if (draft.richMessage) {
      replaceRichMessage(draft.richMessage);
    } else {
      replaceRichMessage(buildRichMessageFromFormatted(draft.text));
    }

    if (shouldUpdateSuggestedPost) {
      requestNextMutation(() => {
        const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
        if (messageInput) {
          focusEditableElement(messageInput, true);
        }
      });
    }

    if (draft.richMessage) {
      return;
    }

    const customEmojiIds = draft.text?.entities
      ?.map((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji && entity.documentId)
      .filter(Boolean) || [];
    if (customEmojiIds.length) loadCustomEmojis({ ids: customEmojiIds });
  }, [chatId, threadId, draft, replaceRichMessage, editedMessage, isDisabled]);

  // Save draft on chat change. Should be layout effect to read correct editor value on cleanup
  useLayoutEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    return () => {
      if (!isEditing) {
        updateDraft({ chatId, threadId });
      }

      freeze();
    };
  }, [chatId, threadId, isEditing, updateDraft, isDisabled]);

  const chatIdRef = useStateRef(chatId);
  const threadIdRef = useStateRef(threadId);
  useEffect(() => {
    if (isDisabled || isFrozen) {
      return;
    }

    if (!richMessage?.blocks.length) {
      updateDraft();

      return;
    }

    const scopedСhatId = chatIdRef.current;
    const scopedThreadId = threadIdRef.current;

    runDebouncedForSaveDraft(() => {
      if (chatIdRef.current === scopedСhatId && threadIdRef.current === scopedThreadId) {
        updateDraft();
      }
    });
  }, [chatIdRef, isDisabled, richMessage, runDebouncedForSaveDraft, threadIdRef, updateDraft]);

  useBackgroundMode(updateDraft);
  useBeforeUnload(updateDraft);
};

export default useDraft;

function getDraftRichMessage(draft?: ApiDraft) {
  if (draft?.richMessage) {
    return draft.richMessage;
  }

  return buildRichMessageFromFormatted(draft?.text);
}
