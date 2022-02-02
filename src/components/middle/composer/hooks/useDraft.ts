import { useCallback, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getDispatch } from '../../../../lib/teact/teactn';

import { ApiFormattedText, ApiMessage } from '../../../../api/types';

import { DRAFT_DEBOUNCE, EDITABLE_INPUT_ID } from '../../../../config';
import usePrevious from '../../../../hooks/usePrevious';
import { debounce } from '../../../../util/schedulers';
import focusEditableElement from '../../../../util/focusEditableElement';
import parseMessageInput from '../../../../util/parseMessageInput';
import useBackgroundMode from '../../../../hooks/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/useBeforeUnload';
import { IS_TOUCH_ENV } from '../../../../util/environment';
import { getTextWithEntitiesAsHtml } from '../../../common/helpers/renderTextWithEntities';

// Used to avoid running debounced callbacks when chat changes.
let currentChatId: string | undefined;
let currentThreadId: number | undefined;

const useDraft = (
  draft: ApiFormattedText | undefined,
  chatId: string,
  threadId: number,
  htmlRef: { current: string },
  setHtml: (html: string) => void,
  editedMessage: ApiMessage | undefined,
) => {
  const { saveDraft, clearDraft } = getDispatch();

  const updateDraft = useCallback((draftChatId: string, draftThreadId: number) => {
    const currentHtml = htmlRef.current;
    if (currentHtml.length && !editedMessage) {
      saveDraft({ chatId: draftChatId, threadId: draftThreadId, draft: parseMessageInput(currentHtml!) });
    } else {
      clearDraft({ chatId: draftChatId, threadId: draftThreadId });
    }
  }, [clearDraft, editedMessage, htmlRef, saveDraft]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runDebouncedForSaveDraft = useMemo(() => debounce((cb) => cb(), DRAFT_DEBOUNCE, false), [chatId]);

  const prevChatId = usePrevious(chatId);
  const prevThreadId = usePrevious(threadId);

  // Save draft on chat change
  useEffect(() => {
    currentChatId = chatId;
    currentThreadId = threadId;

    return () => {
      currentChatId = undefined;
      currentThreadId = undefined;

      updateDraft(chatId, threadId);
    };
  }, [chatId, threadId, updateDraft]);

  // Restore draft on chat change
  useEffect(() => {
    if (chatId === prevChatId && threadId === prevThreadId) {
      return;
    }

    if (!draft) {
      return;
    }

    setHtml(getTextWithEntitiesAsHtml(draft));

    if (!IS_TOUCH_ENV) {
      requestAnimationFrame(() => {
        const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;
        focusEditableElement(messageInput, true);
      });
    }
  }, [chatId, threadId, draft, setHtml, updateDraft, prevChatId, prevThreadId]);

  const html = htmlRef.current;
  // Update draft when input changes
  const prevHtml = usePrevious(html);
  useEffect(() => {
    if (!chatId || !threadId || prevChatId !== chatId || prevThreadId !== threadId || prevHtml === html) {
      return;
    }

    if (html.length) {
      runDebouncedForSaveDraft(() => {
        if (currentChatId !== chatId || currentThreadId !== threadId) {
          return;
        }

        updateDraft(chatId, threadId);
      });
    } else {
      updateDraft(chatId, threadId);
    }
  }, [chatId, html, prevChatId, prevHtml, prevThreadId, runDebouncedForSaveDraft, threadId, updateDraft]);

  const handleBlur = useCallback(() => {
    if (chatId && threadId) {
      updateDraft(chatId, threadId);
    }
  }, [chatId, threadId, updateDraft]);

  useBackgroundMode(handleBlur);
  useBeforeUnload(handleBlur);
};

export default useDraft;
