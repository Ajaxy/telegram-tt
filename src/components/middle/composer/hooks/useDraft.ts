import { useEffect, useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiDraft, ApiMessage } from '../../../../api/types';
import type { ThreadId } from '../../../../types';
import type { Signal } from '../../../../util/signals';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { DRAFT_DEBOUNCE } from '../../../../config';
import {
  requestMeasure,
} from '../../../../lib/fasterdom/fasterdom';
import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';
import { getTextWithEntitiesAsHtml } from '../../../common/helpers/renderTextWithEntities';

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
  getHtml,
  setHtml,
  editedMessage,
  isDisabled,
}: {
  draft?: ApiDraft;
  chatId: string;
  threadId: ThreadId;
  getHtml: Signal<string>;
  setHtml: (html: string) => void;
  editedMessage?: ApiMessage;
  isDisabled?: boolean;
}) => {
  const { saveDraft, clearDraft, loadCustomEmojis } = getActions();

  const isTouchedRef = useRef(false);

  useEffect(() => {
    const html = getHtml();
    const isLocalDraft = draft?.isLocal !== undefined;
    if (getTextWithEntitiesAsHtml(draft?.text) === html && !isLocalDraft) {
      isTouchedRef.current = false;
    } else {
      isTouchedRef.current = true;
    }
  }, [draft, getHtml]);
  useEffect(() => {
    isTouchedRef.current = false;
  }, [chatId, threadId]);

  const isEditing = Boolean(editedMessage);

  const updateDraft = useLastCallback((prevState: { chatId?: string; threadId?: ThreadId } = {}) => {
    if (isDisabled || isEditing || !isTouchedRef.current) return;

    const html = getHtml();

    if (html) {
      requestMeasure(() => {
        saveDraft({
          chatId: prevState.chatId ?? chatId,
          threadId: prevState.threadId ?? threadId,
          text: parseHtmlAsFormattedText(html),
        });
      });
    } else {
      clearDraft({
        chatId: prevState.chatId ?? chatId,
        threadId: prevState.threadId ?? threadId,
        shouldKeepReply: true,
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

    if (chatId === prevChatId && threadId === prevThreadId) {
      if (isTouched && !draft) return; // Prevent reset from other client if we have local edits
      if (!draft && prevDraft) {
        setHtml('');
      }

      if (isTouched) return;
    }

    if (editedMessage || !draft) {
      return;
    }

    setHtml(getTextWithEntitiesAsHtml(draft.text));

    const customEmojiIds = draft.text?.entities
      ?.map((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji && entity.documentId)
      .filter(Boolean) || [];
    if (customEmojiIds.length) loadCustomEmojis({ ids: customEmojiIds });
  }, [chatId, threadId, draft, getHtml, setHtml, editedMessage, isDisabled]);

  // Save draft on chat change. Should be layout effect to read correct html on cleanup
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

    if (!getHtml()) {
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
  }, [chatIdRef, getHtml, isDisabled, runDebouncedForSaveDraft, threadIdRef, updateDraft]);

  useBackgroundMode(updateDraft);
  useBeforeUnload(updateDraft);
};

export default useDraft;
