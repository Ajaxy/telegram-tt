<script lang="ts">
  import type { ApiPeer } from '../../../../api/types';
  import { getActions } from '../../../../global';
  import { globalStore } from '../../../../global/store.svelte';
  import { getPeerFullTitle, getPeerTypeKey } from '../../../../global/helpers/peers';
  import { getTranslationFn } from '../../../../util/localization';
  import buildClassName from '../../../../util/buildClassName';

  import Avatar from '../../../common/svelte/Avatar.svelte';
  import ListItem from '../../../ui/svelte/ListItem.svelte';

  interface Props {
    peerId: string;
    onReset?: () => void;
  }

  let { peerId, onReset }: Props = $props();

  const peer = $derived((globalStore.state.users.byId[peerId] || globalStore.state.chats.byId[peerId]) as ApiPeer | undefined);
  const title = $derived(peer ? getPeerFullTitle(getTranslationFn(), peer) : undefined);
  const subtitleKey = $derived(peer ? getPeerTypeKey(peer) : undefined);
  const subtitle = $derived(subtitleKey ? getTranslationFn()(subtitleKey) : undefined);

  function handleClick() {
    if (!peer) return;

    getActions().openChat({ id: peerId, shouldReplaceHistory: true });

    if (peerId !== globalStore.state.currentUserId) {
      getActions().addRecentlyFoundChatId({ id: peerId });
    }

    onReset?.();
  }

  const className = $derived(buildClassName('SearchPeerResult chat-item-clickable'));
</script>

<ListItem className={className} onclick={handleClick} ripple>
  <div class="search-peer-result">
    <Avatar peer={peer} />
    <div class="content">
      <div class="title" dir="auto">{title || peerId}</div>
      {#if subtitle}
        <div class="subtitle" dir="auto">{subtitle}</div>
      {/if}
    </div>
  </div>
</ListItem>

<style lang="scss">
  .search-peer-result {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .title,
  .subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title {
    font-weight: 500;
  }

  .subtitle {
    color: var(--color-text-secondary, #707579);
    font-size: 0.875rem;
  }
</style>
