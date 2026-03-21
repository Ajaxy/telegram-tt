<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import buildClassName from '../../../util/buildClassName';
  import Button from './Button.svelte';
  
  interface Props {
    title?: string | any[];
    className?: string;
    contentClassName?: string;
    headerClassName?: string;
    dialogClassName?: string;
    isOpen?: boolean;
    header?: any;
    isSlim?: boolean;
    hasCloseButton?: boolean;
    hasAbsoluteCloseButton?: boolean;
    absoluteCloseButtonColor?: any;
    noBackdrop?: boolean;
    noBackdropClose?: boolean;
    children: any;
    style?: string;
    dialogStyle?: string;
    dialogContent?: any;
    moreMenuItems?: any;
    headerRightToolBar?: any;
    withBalanceBar?: boolean;
    currencyInBalanceBar?: 'TON' | 'XTR';
    isCondensedHeader?: boolean;
    onclose: () => void;
    onenter?: () => void;
  }

  let {
    title,
    className,
    contentClassName,
    headerClassName,
    dialogClassName,
    isOpen = false,
    header,
    isSlim,
    hasCloseButton,
    hasAbsoluteCloseButton,
    absoluteCloseButtonColor = 'translucent',
    noBackdrop,
    noBackdropClose,
    children,
    style,
    dialogStyle,
    dialogContent,
    moreMenuItems,
    headerRightToolBar,
    withBalanceBar,
    currencyInBalanceBar = 'XTR',
    isCondensedHeader,
    onclose,
    onenter
  }: Props = $props();

  // Simplified show transition logic
  let shouldRender = $state(isOpen);
  
  $effect(() => {
    if (isOpen) {
      shouldRender = true;
      document.body.classList.add('has-open-dialog');
    } else {
      // Small timeout for close animation
      setTimeout(() => {
        if (!isOpen) {
          shouldRender = false;
          document.body.classList.remove('has-open-dialog');
        }
      }, 200);
    }
  });

  onDestroy(() => {
    document.body.classList.remove('has-open-dialog');
  });

  const withCloseButton = $derived(hasCloseButton || hasAbsoluteCloseButton);

  const fullClassName = $derived(buildClassName(
    'Modal',
    className,
    noBackdrop && 'transparent-backdrop',
    isSlim && 'slim',
    withBalanceBar && 'with-balance-bar',
    isOpen ? 'open' : 'closing'
  ));

  const modalDialogClassName = $derived(buildClassName('modal-dialog', dialogClassName));
</script>

{#if shouldRender}
  <div class={fullClassName} tabindex="-1" role="dialog">
    <div class="modal-container">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal-backdrop" onclick={!noBackdropClose ? onclose : undefined}></div>
      
      <div class={modalDialogClassName} style={dialogStyle}>
        {#if header}
          {@render header()}
        {:else if title || withCloseButton}
          <div class={buildClassName('modal-header', headerClassName, isCondensedHeader && 'modal-header-condensed')}>
            {#if withCloseButton}
              <Button
                className={hasAbsoluteCloseButton ? 'modal-absolute-close-button' : ''}
                round
                color={absoluteCloseButtonColor}
                size="tiny"
                iconName="close"
                onclick={onclose}
              />
            {/if}
            {#if title}
              <div class="modal-title">{title}</div>
            {/if}
          </div>
        {/if}

        {#if headerRightToolBar}
          {@render headerRightToolBar()}
        {/if}

        {#if dialogContent}
          {@render dialogContent()}
        {/if}

        <div class={buildClassName('modal-content custom-scroll', contentClassName)} {style}>
          {@render children()}
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  @import "../Modal.scss";
  
  /* Svelte specific overrides if needed */
  :global(.Modal) {
    display: block;
    &.closing {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    &.open {
      opacity: 1;
      transition: opacity 0.2s;
    }
  }
</style>
