<script lang="ts">
  import { globalStore } from '../../../../global/store.svelte';
  import { getTranslationFn } from '../../../../util/localization';
  import Chat from './Chat.svelte';
  import Loading from '../../../ui/svelte/Loading.svelte';

  // Simplified logic from useFolderManager
  const activeChatFolder = $derived(globalStore.state.byTabId[0]?.activeChatFolder || 0);
  const folders = $derived(globalStore.state.chatFolders);
  
  const orderedIds = $derived(
    activeChatFolder === 0
      ? globalStore.state.chats.listIds.active
      : folders?.byId[activeChatFolder]?.includedChatIds
  );
  const lang = getTranslationFn();

</script>

<div class="chat-list custom-scroll">
  {#if orderedIds?.length}
    {#each orderedIds as id (id)}
      <Chat chatId={String(id)} />
    {/each}
  {:else if orderedIds}
    <div class="empty-state">{lang('ChatListSearchNoResults')}</div>
  {:else}
    <Loading />
  {/if}
</div>

<style lang="scss">
  .chat-list {
    height: 100%;
    overflow-y: auto;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #777;
  }
</style>
