<script lang="ts">
  import { getActions } from '../../../global';
  import { globalStore } from '../../../global/store.svelte';
  import { FOLDERS_POSITION_LEFT } from '../../../config';
  import { selectAreFoldersPresent } from '../../../global/selectors';
  import { getIsMobile } from '../../../hooks/useAppLayout';
  import { LeftColumnContent } from '../../../types';
  import LeftMain from '../main/svelte/LeftMain.svelte';
  // import ArchivedChats from './ArchivedChats.svelte';
  // import Settings from './settings/Settings.svelte';
  // import NewChat from './newChat/NewChat.svelte';

  // State mapped from globalStore
  const tabState = $derived(globalStore.state.byTabId[0]);
  const leftColumn = $derived(tabState?.leftColumn || { contentKey: LeftColumnContent.ChatList, settingsScreen: 0 }); // Defaulting to ChatList
  
  const contentKey = $derived(leftColumn.contentKey);
  const settingsScreen = $derived(leftColumn.settingsScreen);

  const searchQuery = $derived(tabState?.globalSearch?.query);
  const searchDate = $derived(tabState?.globalSearch?.minDate);
  const isClosingSearch = $derived(tabState?.globalSearch?.isClosing);
  const isFoldersSidebarShown = $derived.by(() => {
    const hasFolders = selectAreFoldersPresent(globalStore.state);
    const foldersPosition = globalStore.state.sharedState.settings.foldersPosition;

    return foldersPosition === FOLDERS_POSITION_LEFT && !getIsMobile() && hasFolders;
  });

  let contentType = $derived.by(() => {
    switch (contentKey) {
      case LeftColumnContent.Archived:
        return 'Archived';
      case LeftColumnContent.Settings:
        return 'Settings';
      case LeftColumnContent.NewChannelStep1:
      case LeftColumnContent.NewChannelStep2:
        return 'NewChannel';
      case LeftColumnContent.NewGroupStep1:
      case LeftColumnContent.NewGroupStep2:
        return 'NewGroup';
      default:
        return 'Main';
    }
  });

  function handleReset() {
    getActions().setGlobalSearchClosing({ isClosing: true, tabId: 0 });
    getActions().setGlobalSearchQuery({ query: '', tabId: 0 });
    getActions().openLeftColumnContent({ contentKey: LeftColumnContent.ChatList, tabId: 0 });
  }

  function handleSearchQuery(query: string) {
    getActions().setGlobalSearchQuery({ query, tabId: 0 });
    getActions().openLeftColumnContent({
      contentKey: query ? LeftColumnContent.GlobalSearch : LeftColumnContent.ChatList,
      tabId: 0,
    });
  }

  function handleTopicSearch() {
    getActions().openLeftColumnContent({ contentKey: LeftColumnContent.GlobalSearch, tabId: 0 });
  }
</script>

<div id="LeftColumn">
  <!-- Transition wrapper omitted for MVP -->
  {#if contentType === 'Archived'}
    <!-- <ArchivedChats /> -->
    <div class="placeholder">ArchivedChats</div>
  {:else if contentType === 'Settings'}
    <!-- <Settings /> -->
    <div class="placeholder">Settings</div>
  {:else if contentType === 'NewChannel'}
    <!-- <NewChat isChannel /> -->
    <div class="placeholder">NewChannel</div>
  {:else if contentType === 'NewGroup'}
    <!-- <NewChat /> -->
    <div class="placeholder">NewGroup</div>
  {:else}
    <LeftMain
      content={contentKey}
      {isClosingSearch}
      {searchQuery}
      {searchDate}
      contactsFilter=""
      onSearchQuery={handleSearchQuery}
      onReset={handleReset}
      onTopicSearch={handleTopicSearch}
      {isFoldersSidebarShown}
    />
  {/if}
</div>

<style lang="scss">
  /* Main wrapper styles */
  #LeftColumn {
    width: 420px;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: white;
    border-right: 1px solid #e0e0e0;
    flex-shrink: 0;
  }
  
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    background: #fafafa;
  }

  @media (max-width: 768px) {
    #LeftColumn {
      width: 100%;
      border-right: none;
    }
  }
</style>
