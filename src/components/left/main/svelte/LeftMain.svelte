<script lang="ts">
  import { globalStore } from '../../../../global/store.svelte';
  import buildClassName from '../../../../util/buildClassName';
  import { getTranslationFn } from '../../../../util/localization';
  
  import Button from '../../../ui/svelte/Button.svelte';
  import ChatFolders from './ChatFolders.svelte';
  import ChatList from './ChatList.svelte';
  import LeftMainHeader from './LeftMainHeader.svelte';
  import LeftSearch from '../../search/svelte/LeftSearch.svelte';
  
  interface Props {
    content: number; // LeftColumnContent enum
    searchQuery?: string;
    searchDate?: number;
    contactsFilter: string;
    shouldSkipTransition?: boolean;
    isAppUpdateAvailable?: boolean;
    isForumPanelOpen?: boolean;
    isClosingSearch?: boolean;
    isAccountFrozen?: boolean;
    isFoldersSidebarShown?: boolean;
    onSearchQuery: (query: string) => void;
    onTopicSearch: () => void;
    onReset: () => void;
    // foldersDispatch
  }

  let {
    content,
    searchQuery,
    searchDate,
    contactsFilter,
    shouldSkipTransition,
    isAppUpdateAvailable,
    isForumPanelOpen,
    isClosingSearch,
    isAccountFrozen,
    isFoldersSidebarShown,
    onSearchQuery,
    onTopicSearch,
    onReset
  }: Props = $props();

  const lang = getTranslationFn();
  let isNewChatButtonShown = $state(false);

  function handleMouseEnter() {
    // 0 is ChatList
    if (content !== 0) return;
    isNewChatButtonShown = true;
  }

  function handleMouseLeave() {
    // simplified mouse leave
    isNewChatButtonShown = false;
  }

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="LeftColumn-main"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <LeftMainHeader
    shouldHideSearch={isForumPanelOpen}
    {content}
    {contactsFilter}
    onSearchQuery={onSearchQuery}
    onReset={onReset}
    {shouldSkipTransition}
    {isClosingSearch}
    {isFoldersSidebarShown}
  />

  <div class="content-placeholder">
    {#if content === 0}
      <ChatFolders />
      <ChatList />
    {:else if content === 1}
      <LeftSearch
        isActive={content === 1}
        searchQuery={searchQuery}
        searchDate={searchDate}
        onSearchQuery={onSearchQuery}
        onReset={onReset}
        onTopicSearch={onTopicSearch}
      />
    {:else if content === 2}
      <!-- <ContactList /> -->
      <div>{lang('Contacts')}</div>
    {:else}
      <div>{lang('MenuMore')}</div>
    {/if}
  </div>

  <!-- <NewChatButton isShown={isNewChatButtonShown} /> -->
</div>

<style lang="scss">
  /* Placeholder styles */
  #LeftColumn-main {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--color-background);
  }
  .content-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
</style>
