<script lang="ts">
  import { getActions } from '../../../global';
  import { getChatTitle } from '../../../global/helpers/chats';
  import { getUserFullName } from '../../../global/helpers/users';
  import { globalStore } from '../../../global/store.svelte';
  import { selectCurrentMessageList, selectIsRightColumnShown } from '../../../global/selectors';
  import { selectPeerFullInfo } from '../../../global/selectors/chats';
  import { getIsMobile } from '../../../hooks/useAppLayout';
  import buildClassName from '../../../util/buildClassName';
  import { getTranslationFn } from '../../../util/localization';

  const tabState = $derived(globalStore.state.byTabId[0]);
  const lang = getTranslationFn();
  const currentMessageList = $derived(selectCurrentMessageList(globalStore.state));
  const chatId = $derived(currentMessageList?.chatId);
  const chat = $derived(chatId ? globalStore.state.chats.byId[chatId] : undefined);
  const user = $derived(chatId ? globalStore.state.users.byId[chatId] : undefined);
  const peer = $derived(user || chat);
  const peerFullInfo = $derived(chatId ? selectPeerFullInfo(globalStore.state, chatId) : undefined);
  const peerTitle = $derived.by(() => {
    if (user) return getUserFullName(user);
    if (chat) return getChatTitle(lang, chat);
    return undefined;
  });
  const isRightColumnShown = $derived(selectIsRightColumnShown(globalStore.state, getIsMobile(), 0));
  const rightColumnContent = $derived(tabState?.rightColumnContent);

  const className = $derived(buildClassName(
    'RightColumn',
    isRightColumnShown && 'is-shown'
  ));

  function handleClose() {
    getActions().toggleChatInfo({ force: false, tabId: 0 });
  }
</script>

<div id="RightColumn" class={className}>
  {#if isRightColumnShown}
    <div class="header-placeholder">
      <button onclick={handleClose}>{lang('CommonBack')}</button>
      <span>{peerTitle || lang('Loading')}</span>
    </div>
    <div class="content-placeholder">
      <div class="summary-card">
        <h3>{peerTitle || lang('Loading')}</h3>
        {#if user?.usernames?.length}
          <p>@{user.usernames?.[0].username}</p>
        {:else if chat?.usernames?.length}
          <p>@{chat.usernames?.[0].username}</p>
        {/if}
        {#if user?.phoneNumber}
          <p>{lang('PhoneOther')}: +{user.phoneNumber}</p>
        {/if}
        {#if peerFullInfo?.bio?.text}
          <p>{peerFullInfo.bio.text}</p>
        {/if}
        <p>{lang('MenuMore')}: {rightColumnContent || lang('Loading')}</p>
        <p>Chat ID: {chatId || '-'}</p>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  #RightColumn {
    width: 380px;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    background: white;
    border-left: 1px solid #e0e0e0;
    transition: transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
    transform: translateX(100%);
    flex-shrink: 0;

    &.is-shown {
      transform: translateX(0);
    }
  }

  .header-placeholder {
    height: 56px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid #e0e0e0;
    
    button {
      margin-right: 16px;
    }
  }

  .content-placeholder {
    padding: 16px;
    flex: 1;
    overflow-y: auto;
  }

  .summary-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    h3,
    p {
      margin: 0;
    }
  }

  @media (max-width: 1200px) {
    #RightColumn {
      position: absolute;
      right: 0;
      top: 0;
      z-index: 100;
      height: 100%;
    }
  }
</style>
