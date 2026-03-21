<script lang="ts">
  import { getActions } from '../../../global';
  import { getChatTitle } from '../../../global/helpers/chats';
  import { getPeerTypeKey } from '../../../global/helpers/peers';
  import { getUserFullName } from '../../../global/helpers/users';
  import { globalStore } from '../../../global/store.svelte';
  import { selectCurrentMessageList } from '../../../global/selectors';
  import { getTranslationFn } from '../../../util/localization';

  import Avatar from '../../common/svelte/Avatar.svelte';
  import Button from '../../ui/svelte/Button.svelte';

  const tabState = $derived(globalStore.state.byTabId[0]);
  const currentMessageList = $derived(selectCurrentMessageList(globalStore.state));
  const chatId = $derived(currentMessageList?.chatId);
  
  const chat = $derived(chatId ? globalStore.state.chats.byId[chatId] : undefined);
  const user = $derived(chatId ? globalStore.state.users.byId[chatId] : undefined);
  
  const peer = $derived(user || chat);
  const lang = getTranslationFn();
  const title = $derived.by(() => {
    if (user) return getUserFullName(user);
    if (chat) return getChatTitle(lang, chat);
    return undefined;
  });
  const subtitle = $derived.by(() => {
    if (!peer) return undefined;
    const typeKey = getPeerTypeKey(peer);
    return typeKey ? lang(typeKey) : undefined;
  });

  const isLeftColumnShown = $derived(Boolean(tabState?.isLeftColumnShown));

  function handleBackClick() {
    getActions().openPreviousChat({ tabId: 0 });
  }

  function handleHeaderClick() {
    if (!chatId) return;
    getActions().openChatWithInfo({ id: chatId, tabId: 0 });
    getActions().toggleChatInfo({ force: true, tabId: 0 });
  }

</script>

<div class="MiddleHeader">
  <div class="back-button">
    <Button
      round
      size="smaller"
      color="translucent"
      onclick={handleBackClick}
      ariaLabel={lang('CommonBack')}
    >
      <!-- Animated close icon placeholder -->
      <i class="icon-back"></i>
    </Button>
  </div>
  
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="chat-info-wrapper" onclick={handleHeaderClick}>
    {#if peer}
      <Avatar {peer} size="medium" />
      <div class="chat-info">
        <div class="title">
          <h3>{title}</h3>
        </div>
        <div class="status">
          {subtitle || (!isLeftColumnShown ? lang('CommonBack') : undefined)}
        </div>
      </div>
    {/if}
  </div>

  <div class="header-tools">
    <!-- Header actions placeholder -->
    <Button round size="smaller" color="translucent" ariaLabel={lang('Search')}><i class="icon-search"></i></Button>
    <Button round size="smaller" color="translucent" ariaLabel={lang('Call')}><i class="icon-phone"></i></Button>
    <Button round size="smaller" color="translucent" ariaLabel={lang('MenuMore')}><i class="icon-more"></i></Button>
  </div>
</div>

<style lang="scss">
  @import "../MiddleHeader.scss";

  /* Simplified styles for MVP */
  .MiddleHeader {
    display: flex;
    align-items: center;
    height: 56px;
    padding: 0 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background-secondary);
    position: relative;
    z-index: 2;
  }
  .chat-info-wrapper {
    display: flex;
    align-items: center;
    cursor: pointer;
    flex-grow: 1;
    margin-left: 8px;
  }
  .chat-info {
    margin-left: 12px;
  }
  .title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
  .status {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
  .header-tools {
    display: flex;
    align-items: center;
    margin-left: auto;

    > :global(button) {
      margin-left: 4px;
    }
  }

  /* Icons should be replaced with real ones */
  .icon-back, .icon-search, .icon-phone, .icon-more {
    font-style: normal;
    &::before {
      display: inline-block;
      width: 24px;
      text-align: center;
    }
  }
  .icon-back::before { content: '‹'; font-size: 24px; }
  .icon-search::before { content: '🔍'; }
  .icon-phone::before { content: '📞'; }
  .icon-more::before { content: '…'; }
</style>
