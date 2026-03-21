<script lang="ts">
  import type { IconName } from '../../../types/icons';
  import buildClassName from '../../../util/buildClassName';
  import Icon from '../../common/icons/svelte/Icon.svelte';

  interface Props {
    customIcon?: any;
    className?: string;
    children: any;
    href?: string;
    rel?: string;
    target?: string;
    download?: string;
    disabled?: boolean;
    destructive?: boolean;
    ariaLabel?: string;
    withWrap?: boolean;
    withPreventDefaultOnMouseDown?: boolean;
    icon?: IconName | 'A' | 'K';
    isCharIcon?: boolean;
    onclick?: (e: MouseEvent) => void;
  }

  let {
    icon,
    isCharIcon,
    customIcon,
    className,
    children,
    href,
    target,
    download,
    disabled,
    destructive,
    ariaLabel,
    withWrap,
    rel = 'noopener noreferrer',
    withPreventDefaultOnMouseDown,
    onclick
  }: Props = $props();

  function handleClick(e: MouseEvent) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onclick?.(e);
  }

  function handleMouseDown(e: MouseEvent) {
    if (withPreventDefaultOnMouseDown) {
      e.preventDefault();
    }
  }

  const fullClassName = $derived(buildClassName(
    'MenuItem',
    className,
    disabled && 'disabled',
    destructive && 'destructive',
    withWrap && 'wrap',
    !icon && !customIcon && 'text-only'
  ));
</script>

{#snippet content()}
  {#if !customIcon && icon}
    <Icon name={isCharIcon ? 'char' : icon as IconName} character={isCharIcon ? icon : undefined} />
  {/if}
  {#if customIcon}
    {@render customIcon()}
  {/if}
  {@render children()}
{/snippet}

{#if href && !disabled}
  <a
    tabindex="0"
    class={fullClassName}
    {href}
    {download}
    aria-label={ariaLabel}
    title={ariaLabel}
    {target}
    {rel}
    onclick={handleClick}
    onmousedown={handleMouseDown}
  >
    {@render content()}
  </a>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    role="menuitem"
    tabindex="0"
    class={fullClassName}
    onclick={handleClick}
    onmousedown={handleMouseDown}
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    {@render content()}
  </div>
{/if}

<style lang="scss">
  @import "../MenuItem.scss";
</style>
