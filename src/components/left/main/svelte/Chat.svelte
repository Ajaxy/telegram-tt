<script lang="ts">
  import { getActions } from '../../../../global';
  import { getChatTitle } from '../../../../global/helpers/chats';
  import { getMessageTextWithFallback } from '../../../../global/helpers/messages';
  import { getUserFullName } from '../../../../global/helpers/users';
  import { globalStore } from '../../../../global/store.svelte';
  import { selectCurrentMessageList } from '../../../../global/selectors';
  import { formatTime } from '../../../../util/dates/dateFormat';
  import { getTranslationFn } from '../../../../util/localization';
  import buildClassName from '../../../../util/buildClassName';

  import ListItem from '../../../ui/svelte/ListItem.svelte';
  import Avatar from '../../../common/svelte/Avatar.svelte';
  // Other imports will be needed: FullNameTitle, LastMessageMeta, ChatBadge, etc.

  interface Props {
    chatId: string;
    folderId?: number;
    isPinned?: boolean;
    // Plus many more props
  }

  let { chatId, folderId, isPinned }: Props = $props();

  const chat = $derived(globalStore.state.chats.byId[chatId]);
  const user = $derived(globalStore.state.users.byId[chatId]);
  
  const peer = $derived(user || chat);
  const lang = getTranslationFn();
  
  // A lot of derived state is missing here for this MVP
  const isSelected = $derived(selectCurrentMessageList(globalStore.state)?.chatId === chatId);
  const lastMessage = $derived((chat as any)?.lastMessage);
  const title = $derived.by(() => {
    if (user) return getUserFullName(user);
    if (chat) return getChatTitle(lang, chat);
    return lang('Loading');
  });
  const lastMessageText = $derived(lastMessage ? getMessageTextWithFallback(lang, lastMessage)?.text : undefined);
  const lastMessageTime = $derived(lastMessage?.date ? formatTime(lang, new Date(lastMessage.date * 1000)) : undefined);

  const className = $derived(buildClassName(
    'Chat chat-item-clickable',
    user ? 'private' : 'group',
    isSelected && 'selected'
  ));

  function handleClick() {
    getActions().openChat({ id: chatId, shouldReplaceHistory: true });
  }

</script>

<ListItem
  className={className}
  onclick={handleClick}
  ripple
>
  <div class="status">
    <Avatar peer={peer} size="medium" />
    <!-- Online status, call status, etc. would go here -->
  </div>
  <div class="info">
    <div class="info-row">
      <!-- <FullNameTitle peer={peer} /> -->
      <span class="fullName">{title}</span>
      {#if lastMessageTime}
        <!-- <LastMessageMeta message={lastMessage} /> -->
        <span class="date">{lastMessageTime}</span>
      {/if}
    </div>
    <div class="subtitle">
      {#if lastMessageText}
        <span class="last-message">
          {lastMessageText}
        </span>
      {/if}
      <!-- Badges (unread count, muted, etc) would go here -->
    </div>
  </div>
</ListItem>

<style lang="scss">
  @import "../Chat.scss";

  /* Simplified styles for MVP */
  .fullName {
    font-weight: 500;
  }
  .date {
    margin-left: auto;
    color: #aaa;
    font-size: 0.8em;
  }
  .last-message {
    color: #666;
    font-size: 0.9em;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
