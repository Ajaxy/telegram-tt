<script lang="ts">
  import { getActions } from '../../../global';
  import { getChatTitle } from '../../../global/helpers/chats';
  import { getMessageTextWithFallback } from '../../../global/helpers/messages';
  import { getPeerTitle, getMessageSenderName } from '../../../global/helpers/peers';
  import { getMessageReplyInfo } from '../../../global/helpers/replies';
  import { getUserFullName } from '../../../global/helpers/users';
  import { globalStore } from '../../../global/store.svelte';
  import {
    selectChatMessage,
    selectCurrentChat,
    selectCurrentMessageList,
    selectListedIds,
    selectPeer,
    selectViewportIds,
  } from '../../../global/selectors';
  import { selectDraft, selectThreadInfo } from '../../../global/selectors/threads';
  import { formatTime } from '../../../util/dates/dateFormat';
  import buildClassName from '../../../util/buildClassName';
  import { getTranslationFn } from '../../../util/localization';
  
  // import MessageList from './MessageList.svelte';
  // import Composer from '../common/Composer.svelte';
  import MiddleHeader from './MiddleHeader.svelte';

  const lang = getTranslationFn();
  const currentMessageList = $derived(selectCurrentMessageList(globalStore.state));
  const chatId = $derived(currentMessageList?.chatId);
  const threadId = $derived(currentMessageList?.threadId);
  const currentChat = $derived(selectCurrentChat(globalStore.state));
  const currentUser = $derived(chatId ? globalStore.state.users.byId[chatId] : undefined);
  const threadInfo = $derived(chatId && threadId !== undefined ? selectThreadInfo(globalStore.state, chatId, threadId) : undefined);
  const draft = $derived(chatId && threadId !== undefined ? selectDraft(globalStore.state, chatId, threadId) : undefined);
  const listedIds = $derived(chatId && threadId !== undefined ? selectListedIds(globalStore.state, chatId, threadId) : undefined);
  const viewportIds = $derived(chatId && threadId !== undefined ? selectViewportIds(globalStore.state, chatId, threadId, 0) : undefined);
  const visibleMessageIds = $derived(viewportIds?.length ? viewportIds : listedIds);
  const visibleMessages = $derived(
    chatId && visibleMessageIds?.length
      ? visibleMessageIds
        .map((id) => globalStore.state.messages.byChatId[chatId]?.byId[id])
        .filter(Boolean)
      : []
  );
  const previewMessages = $derived(visibleMessages.slice(-8).reverse());
  const messageItems = $derived.by(() => previewMessages.map((message) => {
    const sender = message.senderId ? selectPeer(globalStore.state, message.senderId) : undefined;
    const replyInfo = getMessageReplyInfo(message);
    const replyMessage = replyInfo?.replyToMsgId
      ? selectChatMessage(globalStore.state, replyInfo.replyToPeerId || message.chatId, replyInfo.replyToMsgId)
      : undefined;

    return {
      id: message.id,
      isOutgoing: message.isOutgoing,
      senderTitle: sender ? getMessageSenderName(lang, message.chatId, sender) : undefined,
      text: getMessageTextWithFallback(lang, message)?.text || lang('ActionUnsupported'),
      time: formatTime(lang, new Date(message.date * 1000)),
      replyTitle: replyMessage
        ? (replyMessage.senderId
          ? getPeerTitle(lang, selectPeer(globalStore.state, replyMessage.senderId) || currentChat || currentUser)
          : previewTitle)
        : undefined,
      replyText: replyMessage
        ? (getMessageTextWithFallback(lang, replyMessage)?.text || lang('ActionUnsupported'))
        : undefined,
    };
  }));
  const replyToMessageId = $derived(draft?.replyInfo?.replyToMsgId);
  const replyToMessage = $derived(
    chatId && replyToMessageId
      ? selectChatMessage(globalStore.state, chatId, replyToMessageId)
      : undefined
  );
  const previewTitle = $derived.by(() => {
    if (currentUser) return getUserFullName(currentUser);
    if (currentChat) return getChatTitle(lang, currentChat);
    return undefined;
  });
  const threadLabel = $derived.by(() => {
    if (threadInfo?.title) return threadInfo.title;
    if (threadId !== undefined) return `${lang('ChatInfoForumTopic')} #${threadId}`;
    return undefined;
  });
  const messageCountLabel = $derived.by(() => {
    if (!visibleMessages.length) return undefined;

    return lang('Messages', { count: visibleMessages.length }, { pluralValue: visibleMessages.length });
  });
  const composerPlaceholder = $derived.by(() => {
    if (!chatId) return lang('Loading');
    return currentUser ? lang('DlgSearchForMessages') : lang('SearchMessages');
  });
  const draftText = $derived(draft?.text.text || '');

  const isChatOpen = $derived(Boolean(chatId));
  let composerText = $state('');

  $effect(() => {
    if (composerText !== draftText) {
      composerText = draftText;
    }
  });

  const className = $derived(buildClassName(
    'MiddleColumn',
    'mask-image-enabled'
  ));
  
  const bgClassName = $derived(buildClassName(
    'background',
    // ... custom background logic
  ));

  // let isReady = $state(true);

  function handleFocusMessage(messageId: number) {
    if (!currentMessageList || !chatId || threadId === undefined) return;

    getActions().focusMessage({
      chatId,
      threadId,
      messageId,
      messageListType: currentMessageList.type,
      tabId: 0,
    });
  }

  function handleComposerInput(event: Event) {
    if (!chatId || threadId === undefined) return;

    const nextValue = (event.currentTarget as HTMLTextAreaElement).value;
    composerText = nextValue;

    if (!nextValue.trim()) {
      getActions().clearDraft({
        chatId,
        threadId,
        isLocalOnly: true,
      });

      return;
    }

    getActions().saveDraft({
      chatId,
      threadId,
      text: {
        text: nextValue,
        entities: [],
      },
    });
  }

  function handleSendMessage() {
    if (!currentMessageList) return;

    const trimmedText = composerText.trim();
    if (!trimmedText) return;

    getActions().sendMessage({
      messageList: currentMessageList,
      text: trimmedText,
      entities: [],
      tabId: 0,
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    handleSendMessage();
  }

  function handleResetReply() {
    getActions().resetDraftReplyInfo({ tabId: 0 });
  }
</script>

<div
  id="MiddleColumn"
  class={className}
>
  <div class={bgClassName}></div>
  <div id="middle-column-portals"></div>

  {#if isChatOpen}
    <div class="messages-layout">
      <MiddleHeader />

      <div class="message-list-placeholder">
        {#if previewTitle}
          <div class="message-preview">
            <div class="preview-header">
              <h2>{previewTitle}</h2>
              {#if threadLabel}
                <p class="thread-label">{threadLabel}</p>
              {/if}
              {#if messageCountLabel}
                <p class="message-count">{messageCountLabel}</p>
              {/if}
            </div>

            {#if messageItems.length}
              <div class="message-stack">
                {#each messageItems as item (item.id)}
                  <button
                    type="button"
                    class:outgoing={item.isOutgoing}
                    class="message-bubble"
                    onclick={() => handleFocusMessage(item.id)}
                  >
                    {#if item.senderTitle}
                      <span class="message-sender">{item.senderTitle}</span>
                    {/if}
                    {#if item.replyText}
                      <span class="message-reply">
                        {#if item.replyTitle}
                          <span class="message-reply-title">{item.replyTitle}</span>
                        {/if}
                        <span class="message-reply-text" dir="auto">{item.replyText}</span>
                      </span>
                    {/if}
                    <span class="message-text" dir="auto">
                      {item.text}
                    </span>
                    <span class="message-time">{item.time}</span>
                  </button>
                {/each}
              </div>
            {:else}
              <p>{lang('ChatListSearchNoResultsDescription')}</p>
            {/if}
          </div>
        {/if}
      </div>

      <div class="middle-column-footer">
        <div class="composer-shell">
          {#if replyToMessage}
            <div class="reply-preview">
              <div class="reply-copy">
                <span class="reply-label">{lang('Reply')}</span>
                <span class="reply-text" dir="auto">
                  {getMessageTextWithFallback(lang, replyToMessage)?.text || lang('ActionUnsupported')}
                </span>
              </div>
              <button type="button" class="reply-close" onclick={handleResetReply}>
                {lang('CommonClose')}
              </button>
            </div>
          {/if}

          <div class="composer-placeholder">
            <textarea
              rows="1"
              class="composer-input"
              value={composerText}
              placeholder={composerPlaceholder}
              oninput={handleComposerInput}
              onkeydown={handleComposerKeyDown}
            ></textarea>
            <button
              type="button"
              class="composer-send"
              disabled={!composerText.trim()}
              onclick={handleSendMessage}
            >
              {lang('Send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="no-chat-selected">
      <div class="content">{lang('SearchFriends')}</div>
    </div>
  {/if}
</div>

<style lang="scss">
  #MiddleColumn {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    height: 100%;
    overflow: hidden;
    background: #fff;
  }

  .background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    background: url('../../../assets/chat-bg-br.png') center/cover no-repeat;
    opacity: 0.5;
  }

  .messages-layout {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .header-placeholder {
    height: 56px;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    backdrop-filter: blur(10px);
  }

  .message-list-placeholder {
    flex-grow: 1;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 1.5rem;
    color: #666;
  }

  .message-preview {
    max-width: 34rem;
    width: 100%;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    h2 {
      margin: 0;
      font-size: 1.375rem;
    }

    p {
      margin: 0;
      font-size: 1rem;
      line-height: 1.5;
    }
  }

  .preview-header {
    text-align: center;
  }

  .thread-label {
    color: var(--color-text-secondary);
    margin-top: 0.375rem !important;
  }

  .message-count {
    color: var(--color-text-secondary);
    margin-top: 0.375rem !important;
  }

  .message-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .message-bubble {
    max-width: 75%;
    padding: 0.75rem 0.875rem;
    border-radius: 1rem 1rem 1rem 0.375rem;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    border: none;
    width: fit-content;
    text-align: start;
    cursor: pointer;

    &.outgoing {
      align-self: flex-end;
      border-radius: 1rem 1rem 0.375rem 1rem;
      background: rgba(223, 255, 219, 0.92);
    }
  }

  .message-sender {
    font-size: 0.8125rem;
    color: var(--color-primary);
  }

  .message-reply {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-inline-start: 0.625rem;
    border-inline-start: 0.125rem solid rgba(0, 136, 204, 0.25);
  }

  .message-reply-title {
    font-size: 0.75rem;
    color: var(--color-primary);
  }

  .message-reply-text {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .message-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .message-time {
    align-self: flex-end;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .middle-column-footer {
    padding: 16px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
  }

  .composer-shell {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reply-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.08);
  }

  .reply-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .reply-label {
    font-size: 0.75rem;
    color: var(--color-primary);
  }

  .reply-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reply-close {
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .composer-placeholder {
    background: #fff;
    border-radius: 24px;
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem 0.625rem 1rem;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  .composer-input {
    flex: 1;
    border: none;
    resize: none;
    min-height: 2.25rem;
    max-height: 8rem;
    padding: 0.375rem 0;
    font: inherit;
    background: transparent;

    &:focus {
      outline: none;
    }
  }

  .composer-send {
    border: none;
    background: var(--color-primary);
    color: #fff;
    border-radius: 999px;
    min-width: 5.5rem;
    height: 2.5rem;
    padding: 0 1rem;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  .no-chat-selected {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    
    .content {
      background: rgba(0, 0, 0, 0.4);
      color: white;
      padding: 8px 16px;
      border-radius: 16px;
    }
  }
</style>
