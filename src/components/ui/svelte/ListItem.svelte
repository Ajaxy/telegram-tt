<script lang="ts">
  import { globalStore } from '../../../global/store.svelte';
  import type { IconName } from '../../../types/icons';
  import { IS_TOUCH_ENV, MouseButton } from '../../../util/browser/windowEnvironment';
  import buildClassName from '../../../util/buildClassName';
  import renderText from '../../common/helpers/renderText';
  import RippleEffect from './RippleEffect.svelte';
  import Icon from '../../common/icons/svelte/Icon.svelte';
  import Button from './Button.svelte';

  export interface MenuItemContextAction {
    title: string;
    icon: IconName;
    destructive?: boolean;
    handler?: () => void;
    isSeparator?: boolean;
    key?: string;
  }

  interface Props {
    icon?: IconName;
    iconClassName?: string;
    leftElement?: any;
    secondaryIcon?: IconName;
    secondaryIconClassName?: string;
    rightElement?: any;
    buttonClassName?: string;
    className?: string;
    style?: string;
    children: any;
    disabled?: boolean;
    allowDisabledClick?: boolean;
    ripple?: boolean;
    narrow?: boolean;
    inactive?: boolean;
    focus?: boolean;
    destructive?: boolean;
    withPrimaryColor?: boolean;
    multiline?: boolean;
    isStatic?: boolean;
    allowSelection?: boolean;
    withColorTransition?: boolean;
    contextActions?: MenuItemContextAction[];
    withPortalForMenu?: boolean;
    menuBubbleClassName?: string;
    href?: string;
    nonInteractive?: boolean;
    onclick?: (e: MouseEvent, arg?: any) => void;
    clickArg?: any;
    onmousedown?: (e: MouseEvent) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    onsecondaryiconclick?: (e: MouseEvent) => void;
    ondragenter?: (e: DragEvent) => void;
    ondragleave?: () => void;
  }

  let {
    icon,
    iconClassName,
    leftElement,
    buttonClassName,
    secondaryIcon,
    secondaryIconClassName,
    rightElement,
    className,
    style,
    children,
    disabled,
    allowDisabledClick,
    ripple,
    narrow,
    inactive,
    focus,
    destructive,
    withPrimaryColor,
    multiline,
    isStatic,
    allowSelection,
    withColorTransition,
    contextActions,
    href,
    nonInteractive,
    onclick,
    clickArg,
    onmousedown,
    oncontextmenu,
    onsecondaryiconclick,
    ondragenter,
    ondragleave
  }: Props = $props();

  let isTouched = $state(false);
  
  // Svelte reactivity for RTL
  const isRtl = $derived(globalStore.state.sharedState?.settings?.language === 'ar' || globalStore.state.sharedState?.settings?.language === 'fa');

  function handleClick(e: MouseEvent) {
    if (disabled && !allowDisabledClick) return;

    if (href) {
      const hasModifierKey = e.ctrlKey || e.metaKey || e.shiftKey;
      if ((hasModifierKey && e.button === MouseButton.Main) || e.button === MouseButton.Auxiliary) {
        return;
      }
      if (onclick) e.preventDefault();
    }

    if (!onclick) return;
    onclick(e, clickArg);

    if (IS_TOUCH_ENV && !ripple) {
      isTouched = true;
      setTimeout(() => isTouched = false, 200);
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (inactive || IS_TOUCH_ENV) return;
    if (e.button === MouseButton.Main) {
      handleClick(e);
    }
    onmousedown?.(e);
  }

  const fullClassName = $derived(buildClassName(
    'ListItem',
    className,
    allowSelection && 'allow-selection',
    ripple && 'has-ripple',
    narrow && 'narrow',
    disabled && 'disabled',
    allowDisabledClick && 'click-allowed',
    inactive && 'inactive',
    focus && 'focus',
    destructive && 'destructive',
    withPrimaryColor && 'primary',
    multiline && 'multiline',
    isStatic && 'is-static',
    withColorTransition && 'with-color-transition',
  ));

  const buttonFullClassName = $derived(buildClassName('ListItem-button', isTouched && 'active', buttonClassName));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={fullClassName}
  dir={isRtl ? 'rtl' : undefined}
  {style}
  onmousedown={onmousedown}
  ondragenter={ondragenter}
  ondragleave={ondragleave}
>
  {#if href}
    <a
      class={buttonFullClassName}
      {href}
      role={!isStatic ? 'button' : undefined}
      rel="noopener noreferrer"
      tabindex={!isStatic ? 0 : undefined}
      onclick={handleClick}
      onmousedown={handleMouseDown}
      oncontextmenu={oncontextmenu}
      aria-disabled={disabled || undefined}
    >
      {@render innerContent()}
    </a>
  {:else}
    <button
      type="button"
      class={buttonFullClassName}
      onclick={handleClick}
      onmousedown={handleMouseDown}
      oncontextmenu={oncontextmenu}
      aria-disabled={disabled || undefined}
      disabled={disabled && !allowDisabledClick}
    >
      {@render innerContent()}
    </button>
  {/if}
  
  <!-- TODO: Context Menu implementation -->
</div>

{#snippet innerContent()}
  {#if !disabled && !inactive && ripple}
    <RippleEffect />
  {/if}
  
  {#if leftElement}
    {@render leftElement()}
  {/if}
  
  {#if icon}
    <Icon name={icon} className={buildClassName('ListItem-main-icon', iconClassName)} />
  {/if}
  
  {#if multiline}
    <div class="multiline-item">{@render children()}</div>
  {:else}
    {@render children()}
  {/if}
  
  {#if secondaryIcon}
    <Button
      nonInteractive={nonInteractive}
      className={buildClassName('secondary-icon', secondaryIconClassName)}
      round
      color="translucent"
      size="smaller"
      onclick={onsecondaryiconclick}
      iconName={secondaryIcon}
    />
  {/if}
  
  {#if rightElement}
    {@render rightElement()}
  {/if}
{/snippet}

<style lang="scss">
  @import "../ListItem.scss";
</style>
