<script lang="ts">
  import type { ApiMessage } from '../../../../api/types';
  import { getActions } from '../../../../global';
  import { getMessageTextWithFallback } from '../../../../global/helpers/messages';
  import { getTranslationFn } from '../../../../util/localization';
  import { formatPastTimeShort } from '../../../../util/dates/dateFormat';

  import ListItem from '../../../ui/svelte/ListItem.svelte';

  interface Props {
    message: ApiMessage;
  }

  let { message }: Props = $props();
  const lang = getTranslationFn();

  const summary = $derived(getMessageTextWithFallback(lang, message)?.text || lang('ActionUnsupported'));
  const dateLabel = $derived(formatPastTimeShort(lang, message.date * 1000));

  function handleClick() {
    getActions().focusMessage({
      chatId: message.chatId,
      messageId: message.id,
      shouldReplaceHistory: true,
    });
  }
</script>

<ListItem className="SearchMessageResult chat-item-clickable" onclick={handleClick} ripple>
  <div class="content">
    <div class="header">
      <span class="title" dir="auto">{summary}</span>
      <span class="date">{dateLabel}</span>
    </div>
    <div class="meta">
      <span class="chat-id">{message.chatId}</span>
      <span class="message-id">#{message.id}</span>
    </div>
  </div>
</ListItem>

<style lang="scss">
  .content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    width: 100%;
  }

  .header,
  .meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .title,
  .chat-id,
  .message-id {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title {
    font-weight: 500;
    flex: 1;
    min-width: 0;
  }

  .date,
  .chat-id,
  .message-id {
    color: var(--color-text-secondary, #707579);
    font-size: 0.8125rem;
  }
  
  .meta {
    gap: 0.5rem;
  }
</style>
