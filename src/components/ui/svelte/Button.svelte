<script lang="ts">
  import { onMount } from 'svelte';
  import type { IconName } from '../../../types/icons';
  import { IS_TOUCH_ENV, MouseButton } from '../../../util/browser/windowEnvironment';
  import buildClassName from '../../../util/buildClassName';
  import buildStyle from '../../../util/buildStyle';
  import { globalStore } from '../../../global/store.svelte';
  
  import RippleEffect from './RippleEffect.svelte';
  import Spinner from './Spinner.svelte';
  import Icon from '../../common/icons/svelte/Icon.svelte';

  interface Props {
    type?: 'button' | 'submit' | 'reset';
    children?: any;
    size?: 'default' | 'smaller' | 'tiny';
    color?: (
      'primary' | 'secondary' | 'gray' | 'danger' | 'translucent' | 'translucent-white' | 'translucent-black'
      | 'translucent-bordered' | 'dark' | 'green' | 'adaptive' | 'stars' | 'bluredStarsBadge' | 'transparentBlured'
    );
    backgroundImage?: string;
    id?: string;
    className?: string;
    round?: boolean;
    pill?: boolean;
    badge?: boolean;
    fluid?: boolean;
    inline?: boolean;
    isText?: boolean;
    isLoading?: boolean;
    ariaLabel?: string;
    ariaControls?: string;
    hasPopup?: boolean;
    href?: string;
    download?: string;
    disabled?: boolean;
    nonInteractive?: boolean;
    allowDisabledClick?: boolean;
    noFastClick?: boolean;
    ripple?: boolean;
    faded?: boolean;
    tabIndex?: number;
    isRtl?: boolean;
    isShiny?: boolean;
    isRectangular?: boolean;
    withPremiumGradient?: boolean;
    withSparkleEffect?: boolean;
    noSparkleAnimation?: boolean;
    noPreventDefault?: boolean;
    noForcedUpperCase?: boolean;
    shouldStopPropagation?: boolean;
    style?: string;
    iconName?: IconName;
    iconAlignment?: 'top' | 'bottom' | 'start' | 'end';
    iconClassName?: string;
    onclick?: (e: MouseEvent) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    onmousedown?: (e: MouseEvent) => void;
    onmouseup?: (e: MouseEvent) => void;
    onmouseenter?: (e: MouseEvent) => void;
    onmouseleave?: () => void;
    onfocus?: () => void;
    ontransitionend?: () => void;
  }

  let {
    type = 'button',
    id,
    children,
    size = 'default',
    color = 'primary',
    backgroundImage,
    className,
    round,
    pill,
    badge,
    fluid,
    inline,
    isText,
    isLoading,
    isShiny,
    withPremiumGradient,
    withSparkleEffect,
    noSparkleAnimation,
    ariaLabel,
    ariaControls,
    hasPopup,
    href,
    download,
    disabled,
    nonInteractive,
    allowDisabledClick,
    noFastClick = color === 'danger',
    ripple,
    faded,
    tabIndex,
    isRtl,
    isRectangular,
    noPreventDefault,
    shouldStopPropagation,
    noForcedUpperCase,
    style,
    iconName,
    iconAlignment = 'start',
    iconClassName,
    onclick,
    oncontextmenu,
    onmousedown,
    onmouseup,
    onmouseenter,
    onmouseleave,
    onfocus,
    ontransitionend,
  }: Props = $props();

  let isClicked = $state(false);
  const CLICKED_TIMEOUT = 400;

  const isNotInteractive = $derived(disabled || nonInteractive);

  const fullClassName = $derived(buildClassName(
    'Button',
    className,
    size,
    color,
    round && 'round',
    pill && 'pill',
    fluid && 'fluid',
    badge && 'badge',
    isNotInteractive && 'disabled',
    nonInteractive && 'non-interactive',
    allowDisabledClick && 'click-allowed',
    isText && 'text',
    isLoading && 'loading',
    ripple && 'has-ripple',
    faded && 'faded',
    isClicked && 'clicked',
    backgroundImage && 'with-image',
    isShiny && 'shiny',
    withPremiumGradient && 'premium',
    isRectangular && 'rectangular',
    noForcedUpperCase && 'no-upper-case',
    inline && 'inline',
    Boolean(iconName && children) && `content-with-icon-${iconAlignment}`,
  ));

  function handleClick(e: MouseEvent) {
    if ((allowDisabledClick || !isNotInteractive) && onclick) {
      onclick(e);
    }

    if (shouldStopPropagation) e.stopPropagation();

    isClicked = true;
    setTimeout(() => {
      isClicked = false;
    }, CLICKED_TIMEOUT);
  }

  function handleMouseDown(e: MouseEvent) {
    if (!noPreventDefault) e.preventDefault();

    if ((allowDisabledClick || !isNotInteractive) && onmousedown) {
      onmousedown(e);
    }

    if (!IS_TOUCH_ENV && e.button === MouseButton.Main && !noFastClick) {
      handleClick(e);
    }
  }

  const finalStyle = $derived(buildStyle(style, backgroundImage && `background-image: url(${backgroundImage})`) || undefined);
</script>

{#if href}
  <a
    {id}
    class={fullClassName}
    {href}
    title={ariaLabel}
    {download}
    tabindex={tabIndex}
    dir={isRtl ? 'rtl' : undefined}
    aria-label={ariaLabel}
    aria-controls={ariaControls}
    style={finalStyle}
    ontransitionend={ontransitionend}
    target="_blank"
    rel="noreferrer"
  >
    {@render content()}
  </a>
{:else}
  <button
    {id}
    {type}
    class={fullClassName}
    onclick={IS_TOUCH_ENV || noFastClick ? handleClick : undefined}
    oncontextmenu={oncontextmenu}
    onmousedown={handleMouseDown}
    onmouseup={onmouseup}
    onmouseenter={onmouseenter && !isNotInteractive ? onmouseenter : undefined}
    onmouseleave={onmouseleave && !isNotInteractive ? onmouseleave : undefined}
    ontransitionend={ontransitionend}
    onfocus={onfocus && !isNotInteractive ? onfocus : undefined}
    aria-label={ariaLabel}
    aria-controls={ariaControls}
    aria-haspopup={hasPopup}
    title={ariaLabel}
    tabindex={tabIndex}
    dir={isRtl ? 'rtl' : undefined}
    style={finalStyle}
  >
    {@render content()}
  </button>
{/if}

{#snippet content()}
  <!-- TODO: Sparkles component -->
  <!-- {#if withSparkleEffect} <Sparkles preset="button" noAnimation={noSparkleAnimation} /> {/if} -->
  
  {#if isLoading}
    <div>
      <span dir={isRtl ? 'auto' : undefined}>Loading...</span>
      <Spinner color={isText ? 'blue' : 'white'} />
    </div>
  {:else}
    <div class={iconName && children ? `with-icon-${iconAlignment}` : ''}>
      {#if iconName}
        <Icon name={iconName} className={iconClassName} />
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}

  {#if !isNotInteractive && ripple}
    <RippleEffect />
  {/if}
{/snippet}

<style lang="scss">
  @import "../Button.scss";
</style>
