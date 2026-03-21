<script lang="ts">
  import { getChatTitle } from '../../../global/helpers/chats';
  import { getMessageTextWithFallback } from '../../../global/helpers/messages';
  import { getUserFullName } from '../../../global/helpers/users';
  import { globalStore } from '../../../global/store.svelte';
  import {
    selectCurrentChat,
    selectCurrentMessageList,
    selectListedIds,
    selectThreadInfo,
    selectViewportIds,
  } from '../../../global/selectors';
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
  const previewMessages = $derived(visibleMessages.slice(-6).reverse());
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
  const composerPlaceholder = $derived.by(() => {
    if (!chatId) return lang('Loading');
    return currentUser ? lang('DlgSearchForMessages') : lang('SearchMessages');
  });

  const isChatOpen = $derived(Boolean(chatId));

  const className = $derived(buildClassName(
    'MiddleColumn',
    'mask-image-enabled'
  ));
  
  const bgClassName = $derived(buildClassName(
    'background',
    // ... custom background logic
  ));

  // let isReady = $state(true);
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
            </div>

            {#if previewMessages.length}
              <div class="message-stack">
                {#each previewMessages as message (message.id)}
                  <div class:outgoing={message.isOutgoing} class="message-bubble">
                    <span class="message-text" dir="auto">
                      {getMessageTextWithFallback(lang, message)?.text || lang('ActionUnsupported')}
                    </span>
                    <span class="message-time">{formatTime(lang, new Date(message.date * 1000))}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <p>{lang('ChatListSearchNoResultsDescription')}</p>
            {/if}
          </div>
        {/if}
      </div>

      <div class="middle-column-footer">
        <div class="composer-placeholder">
          {composerPlaceholder}
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

    &.outgoing {
      align-self: flex-end;
      border-radius: 1rem 1rem 0.375rem 1rem;
      background: rgba(223, 255, 219, 0.92);
    }
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

  .composer-placeholder {
    height: 48px;
    background: #fff;
    border-radius: 24px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    color: #999;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
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
