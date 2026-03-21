<script lang="ts">
  import type { IconName } from '../../../../types/icons';
  import buildClassName from '../../../../util/buildClassName';

  interface Props {
    name: IconName;
    className?: string;
    style?: string;
    role?: string;
    ariaLabel?: string;
    character?: string;
    onclick?: (e: MouseEvent) => void;
  }

  let {
    name,
    className,
    style,
    role,
    ariaLabel,
    character,
    onclick
  }: Props = $props();

  const fullClassName = $derived(buildClassName(`icon icon-${name}`, className));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<i
  class={fullClassName}
  {style}
  aria-hidden={!ariaLabel}
  aria-label={ariaLabel}
  data-char={character}
  {role}
  onclick={onclick}
></i>
