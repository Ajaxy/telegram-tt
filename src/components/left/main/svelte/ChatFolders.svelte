<script lang="ts">
  import { getActions } from '../../../../global';
  import { globalStore } from '../../../../global/store.svelte';
  import { getTranslationFn } from '../../../../util/localization';

  const orderedIds = $derived(globalStore.state.chatFolders?.orderedIds);
  const foldersById = $derived(globalStore.state.chatFolders?.byId);
  const activeChatFolder = $derived(globalStore.state.byTabId[0]?.activeChatFolder || 0);
  const lang = getTranslationFn();

  function handleFolderClick(id: number) {
    getActions().setActiveChatFolder({ activeChatFolder: id, tabId: 0 });
  }

</script>

<div class="ChatFolders">
  <div class="tabs">
    {#if orderedIds && foldersById}
      {#each orderedIds as id (id)}
        <button
          class={`tab-button ${id === activeChatFolder ? 'active' : ''}`}
          onclick={() => handleFolderClick(id)}
        >
          {foldersById[id]?.title.text || (id === 0 ? lang('FilterAllChats') : lang('Loading'))}
        </button>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
  .ChatFolders {
    flex-shrink: 0;
  }
  .tabs {
    display: flex;
    overflow-x: auto;
    background: white;
    border-bottom: 1px solid #e0e0e0;
  }
  .tab-button {
    padding: 12px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 15px;
    position: relative;
    color: #666;

    &.active {
      color: #0088cc;
      font-weight: 500;
      
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: #0088cc;
      }
    }
  }
</style>
