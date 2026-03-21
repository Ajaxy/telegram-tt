<script lang="ts">
  import { getActions } from '../../../../global';
  import { globalStore } from '../../../../global/store.svelte';
  import { GlobalSearchContent } from '../../../../types'; // Keep as value import
  import type { AnimationLevel } from '../../../../types'; // Import as type

  import { parseDateString } from '../../../../util/dates/dateFormat';
  import { parseSearchResultKey } from '../../../../util/keys/searchResultKey';
  // import { resolveTransitionName } from '../../../../util/resolveTransitionName';
  import buildClassName from '../../../../util/buildClassName';
  import { getTranslationFn } from '../../../../util/localization';
  
  import TabList, { type TabWithProperties } from '../../../ui/svelte/TabList.svelte';
  import Button from '../../../ui/svelte/Button.svelte';
  import SearchMessageResult from './SearchMessageResult.svelte';
  import SearchPeerResult from './SearchPeerResult.svelte';
  // import Transition from '../../../ui/svelte/Transition.svelte'; // Placeholder
  // import AudioResults from './AudioResults.svelte';
  // import BotAppResults from './BotAppResults.svelte';
  // import ChatMessageResults from './ChatMessageResults.svelte';
  // import ChatResults from './ChatResults.svelte';
  // import FileResults from './FileResults.svelte';
  // import LinkResults from './LinkResults.svelte';
  // import MediaResults from './MediaResults.svelte';
  // import PublicPostsResults from './PublicPostsResults.svelte';

  interface OwnProps {
    searchQuery?: string;
    searchDate?: number;
    isActive: boolean;
    onReset: () => void;
    onSearchQuery: (query: string) => void;
    onTopicSearch: () => void;
  }

  let {
    searchQuery,
    searchDate,
    isActive,
    onReset,
    onSearchQuery,
    onTopicSearch,
  }: OwnProps = $props();

  // Mapped State from globalStore (mimicking withGlobal)
  const tabState = $derived(globalStore.state.byTabId[0]);
  const currentContent = $derived(tabState?.globalSearch?.currentContent);
  const chatId = $derived(tabState?.globalSearch?.chatId);
  const animationLevel = $derived(globalStore.state.sharedState?.settings?.animationLevel);
  const localPeerIds = $derived(tabState?.globalSearch?.localResults?.peerIds || []);
  const globalPeerIds = $derived(tabState?.globalSearch?.globalResults?.peerIds || []);
  const recentlyFoundChatIds = $derived(globalStore.state.recentlyFoundChatIds || []);
  const topUserIds = $derived(globalStore.state.topPeers?.userIds || []);
  const isSearchingChats = $derived(Boolean(tabState?.globalSearch?.fetchingStatus?.chats));
  const isSearchingMessages = $derived(Boolean(tabState?.globalSearch?.fetchingStatus?.messages));
  const textResultIds = $derived(tabState?.globalSearch?.resultsByType?.text?.foundIds || []);

  // Simplified actions
  function setGlobalSearchContent(content: GlobalSearchContent) {
    getActions().setGlobalSearchContent({ content, tabId: 0 });
  }
  function setGlobalSearchDate(date: number) {
    getActions().setGlobalSearchDate({ date, tabId: 0 });
  }
  function checkSearchPostsFlood() {
    getActions().checkSearchPostsFlood({ query: searchQuery, tabId: 0 });
  }
  function searchMessagesInCurrentScope() {
    getActions().searchMessagesGlobal({
      type: 'text',
      shouldResetResultsByType: true,
      shouldCheckFetchingMessagesStatus: true,
      tabId: 0,
    });
  }
  function loadTopUsers() {
    getActions().loadTopUsers();
  }
  function clearRecentlyFoundChats() {
    getActions().clearRecentlyFoundChats();
  }

  let activeTab = $state<number>(0);
  const dateSearchQuery = $derived(parseDateString(searchQuery));
  const lang = getTranslationFn();

  $effect(() => {
    activeTab = tabs.findIndex((tab) => tab.id === (currentContent ?? GlobalSearchContent.ChatList));
  });

  $effect(() => {
    if (isActive) {
      checkSearchPostsFlood();
      loadTopUsers();
    }
  });

  $effect(() => {
    if (!isActive || !chatId) return;
    if (currentContent !== GlobalSearchContent.ChatList && currentContent !== GlobalSearchContent.ChannelList) return;
    if (!searchQuery && !searchDate) return;

    searchMessagesInCurrentScope();
  });

  // Simplified useLang
  const isRtl = $derived(lang.isRtl);

  const TABS: TabWithProperties[] = [
    { id: GlobalSearchContent.ChatList, title: lang('SearchTabChats') },
    { id: GlobalSearchContent.ChannelList, title: lang('SearchTabChannels') },
    { id: GlobalSearchContent.BotApps, title: lang('SearchTabApps') },
    { id: GlobalSearchContent.PublicPosts, title: lang('SearchTabPublicPosts') },
    { id: GlobalSearchContent.Media, title: lang('SearchTabMedia') },
    { id: GlobalSearchContent.Links, title: lang('SearchTabLinks') },
    { id: GlobalSearchContent.Files, title: lang('SearchTabFiles') },
    { id: GlobalSearchContent.Music, title: lang('SearchTabMusic') },
    { id: GlobalSearchContent.Voice, title: lang('SearchTabVoice') },
  ];

  const CHAT_TABS: TabWithProperties[] = [
    { id: GlobalSearchContent.ChatList, title: lang('SearchTabMessages') },
    ...TABS.slice(3),
  ];

  const tabs = $derived(chatId ? CHAT_TABS : TABS);
  const searchResultIds = $derived([...new Set([...localPeerIds, ...globalPeerIds])]);
  const shouldShowRecentContacts = $derived(!searchQuery && !chatId);
  const hasPeerResults = $derived(searchResultIds.length > 0);
  const foundMessages = $derived(
    textResultIds
      .map((id) => {
        const [resultChatId, messageId] = parseSearchResultKey(id);
        return globalStore.state.messages.byChatId[resultChatId]?.byId[messageId];
      })
      .filter(Boolean)
      .sort((a, b) => b.date - a.date)
  );

  function handleSwitchTab(index: number) {
    const tab = tabs[index];
    setGlobalSearchContent(tab.id as GlobalSearchContent);
    activeTab = index;
  }

  function handleSearchDateSelect(value: Date) {
    setGlobalSearchDate(value.getTime() / 1000);
  }

  // Simplified useHistoryBack
  $effect(() => {
    if (isActive) {
      getActions().setGlobalSearchClosing({ isClosing: false, tabId: 0 });
    }
    return () => {
      getActions().setGlobalSearchClosing({ isClosing: true, tabId: 0 });
    };
  });

  let containerRef: HTMLDivElement;
  // Simplified useKeyboardListNavigation
  function handleKeyDown(_e: KeyboardEvent) {
    // Implement keyboard navigation logic here
  }

</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="LeftSearch" bind:this={containerRef} onkeydown={handleKeyDown} role="region">
  <TabList activeTab={activeTab} tabs={tabs} onSwitchTab={handleSwitchTab} />
  <!-- <Transition
    name={resolveTransitionName('slideOptimized', animationLevel, undefined, isRtl)}
    renderCount={tabs.length}
    activeKey={currentContent}
  > -->
    {#if currentContent === GlobalSearchContent.ChatList || currentContent === GlobalSearchContent.ChannelList}
      {#if chatId}
        <div class="search-results custom-scroll">
          {#if dateSearchQuery}
            <section class="search-section">
              <h3 class="section-heading" dir={isRtl ? 'rtl' : undefined}>Date</h3>
              <div class="date-chip">
                <Button
                  size="smaller"
                  color="translucent"
                  onclick={() => handleSearchDateSelect(new Date(dateSearchQuery))}
                >
                  {dateSearchQuery}
                </Button>
              </div>
            </section>
          {/if}

          {#if foundMessages.length}
            <section class="search-section">
              <h3 class="section-heading" dir={isRtl ? 'rtl' : undefined}>Messages</h3>
              <div class="result-list">
                {#each foundMessages as message (message.chatId + '_' + message.id)}
                  <SearchMessageResult {message} />
                {/each}
              </div>
            </section>
          {:else if isSearchingMessages}
            <div class="placeholder">{lang('Loading')}</div>
          {:else if searchQuery || searchDate}
            <div class="placeholder">{lang('SearchNoResults')}</div>
          {:else}
            <div class="placeholder">{lang('DlgSearchForMessages')}</div>
          {/if}
        </div>
      {:else}
        <div class="search-results custom-scroll">
          {#if shouldShowRecentContacts}
            {#if topUserIds.length}
              <section class="search-section">
                <h3 class="section-heading" dir={isRtl ? 'rtl' : undefined}>{lang('Contacts')}</h3>
                <div class="result-list">
                  {#each topUserIds as peerId (peerId)}
                    <SearchPeerResult {peerId} onReset={onReset} />
                  {/each}
                </div>
              </section>
            {/if}

            {#if recentlyFoundChatIds.length}
              <section class="search-section">
                <div class="section-heading-row">
                  <h3 class="section-heading" dir={isRtl ? 'rtl' : undefined}>{lang('Recent')}</h3>
                  <Button
                    className="clear-recent"
                    round
                    size="smaller"
                    color="translucent"
                    ariaLabel={lang('Clear')}
                    iconName="close"
                    onclick={clearRecentlyFoundChats}
                  />
                </div>
                <div class="result-list">
                  {#each recentlyFoundChatIds as peerId (peerId)}
                    <SearchPeerResult {peerId} onReset={onReset} />
                  {/each}
                </div>
              </section>
            {/if}

            {#if !topUserIds.length && !recentlyFoundChatIds.length}
              <div class="placeholder">{lang('Search')}</div>
            {/if}
          {:else if hasPeerResults}
            <div class="result-list">
              {#each searchResultIds as peerId (peerId)}
                <SearchPeerResult {peerId} onReset={onReset} />
              {/each}
            </div>
          {:else if isSearchingChats}
            <div class="placeholder">{lang('Loading')}</div>
          {:else}
            <div class="placeholder">{lang('ChatListSearchNoResults')}</div>
          {/if}
        </div>
      {/if}
    {:else if currentContent === GlobalSearchContent.Media}
      <!-- <MediaResults searchQuery={searchQuery} /> -->
      <div class="placeholder">{lang('SearchTabMedia')}</div>
    {:else if currentContent === GlobalSearchContent.Links}
      <!-- <LinkResults searchQuery={searchQuery} /> -->
      <div class="placeholder">{lang('SearchTabLinks')}</div>
    {:else if currentContent === GlobalSearchContent.Files}
      <!-- <FileResults searchQuery={searchQuery} /> -->
      <div class="placeholder">{lang('SearchTabFiles')}</div>
    {:else if currentContent === GlobalSearchContent.Music || currentContent === GlobalSearchContent.Voice}
      <!-- <AudioResults
        key="audio"
        searchQuery={searchQuery}
        isVoice={currentContent === GlobalSearchContent.Voice}
      /> -->
      <div class="placeholder">{lang(currentContent === GlobalSearchContent.Voice ? 'SearchTabVoice' : 'SearchTabMusic')}</div>
    {:else if currentContent === GlobalSearchContent.BotApps}
      <!-- <BotAppResults
        key="botApps"
        searchQuery={searchQuery}
      /> -->
      <div class="placeholder">{lang('SearchTabApps')}</div>
    {:else if currentContent === GlobalSearchContent.PublicPosts}
      <!-- <PublicPostsResults
        key="publicPosts"
        searchQuery={searchQuery}
      /> -->
      <div class="placeholder">{lang('SearchTabPublicPosts')}</div>
    {:else}
      <div class="placeholder">{lang('ChatListSearchNoResults')}</div>
    {/if}
  <!-- </Transition> -->
</div>

<style lang="scss">
  @import "../LeftSearch.scss";

  .LeftSearch {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .search-section {
    padding-bottom: 0.75rem;
  }

  .section-heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0 1rem;
  }

  .section-heading {
    margin: 0;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #707579);
  }

  .section-heading-row .section-heading {
    padding: 0.5rem 0;
  }

  .result-list {
    display: flex;
    flex-direction: column;
  }

  .date-chip {
    margin: 0 1rem;
    width: fit-content;
  }
</style>
