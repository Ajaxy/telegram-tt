<script lang="ts">
  import buildClassName from '../../../util/buildClassName';

  interface Props {
    isOpen: boolean;
    className?: string;
    bubbleClassName?: string;
    autoClose?: boolean;
    footer?: string;
    children?: any;
    onclose?: () => void;
    anchor?: { x: number; y: number };
    getTriggerElement?: () => HTMLElement | undefined;
    getRootElement?: () => HTMLElement | undefined;
    getMenuElement?: () => HTMLElement | undefined;
    getLayout?: () => { withPortal?: boolean };
  }

  let {
    isOpen,
    className,
    bubbleClassName,
    autoClose = false,
    footer,
    children,
    onclose
  }: Props = $props();

  const bubbleFullClassName = $derived(buildClassName(
    'bubble menu-container custom-scroll',
    footer && 'with-footer',
    bubbleClassName,
  ));

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (autoClose) {
      onclose?.();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class={buildClassName('Menu', className)}>
    <div
      role="presentation"
      class={bubbleFullClassName}
      onclick={handleClick}
    >
      {#if children}        {@render children()}
      {/if}
      {#if footer}
        <div class="footer">{footer}</div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @import "../Menu.scss";
</style>
