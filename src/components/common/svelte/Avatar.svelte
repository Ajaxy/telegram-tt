<script lang="ts">
  import type { ApiChat, ApiPeer, ApiUser } from '../../../api/types';
  import { getChatTitle, getPeerColorKey } from '../../../global/helpers/chats';
  import { getUserFullName, isDeletedUser } from '../../../global/helpers/users';
  import { getTranslationFn } from '../../../util/localization';
  import buildClassName from '../../../util/buildClassName';
  import buildStyle from '../../../util/buildStyle';
  import { isUserId } from '../../../util/entities/ids';
  import { getFirstLetters } from '../../../util/textFormat';

  import '../Avatar.scss';

  const AVATAR_SIZES = {
    tiny: 32,
    small: 34,
    medium: 44,
    large: 54,
    jumbo: 120,
  } as const;

  interface Props {
    peer?: ApiPeer;
    text?: string;
    size?: keyof typeof AVATAR_SIZES | number;
    className?: string;
  }

  let {
    peer,
    text,
    size = 'medium',
    className,
  }: Props = $props();

  const user = $derived(peer && !('title' in peer) ? peer as ApiUser : undefined);
  const chat = $derived(peer && 'title' in peer ? peer as ApiChat : undefined);
  const lang = getTranslationFn();

  const title = $derived.by(() => {
    if (user) return getUserFullName(user);
    if (chat) return getChatTitle(lang, chat);
    return text;
  });

  const letters = $derived.by(() => {
    if (!title) return undefined;
    if (user && isDeletedUser(user)) return 'X';
    return getFirstLetters(title, chat && !isUserId(chat.id) ? 1 : 2);
  });

  const colorKey = $derived(getPeerColorKey(peer, true));
  const fullClassName = $derived(buildClassName(
    'Avatar',
    className,
    `peer-color-${colorKey}`,
    !peer && text && 'hidden-user',
    !peer?.avatarPhotoId && 'no-photo',
  ));

  const pxSize = $derived(typeof size === 'number' ? size : AVATAR_SIZES[size]);
  const style = $derived(buildStyle(`--_size: ${pxSize}px;`) || undefined);
</script>

<div
  class={fullClassName}
  aria-label={title}
  style={style}
>
  <div class="inner">
    {#if letters}
      <span class="letters">{letters}</span>
    {/if}
  </div>
</div>
