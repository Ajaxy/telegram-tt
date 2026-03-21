<script lang="ts">
  import Menu from './Menu.svelte';
  import Button from './Button.svelte';

  interface TriggerProps {
    onTrigger: () => void;
    isOpen: boolean;
  }

  interface Props {
    className?: string;
    bubbleClassName?: string;
    trigger?: (props: TriggerProps) => any; // snippet
    footer?: string;
    forceOpen?: boolean;
    autoClose?: boolean;
    children?: any;
    onopen?: () => void;
    onclose?: () => void;
  }

  let {
    className,
    bubbleClassName,
    trigger,
    footer,
    forceOpen,
    autoClose = true,
    children,
    onopen,
    onclose
  }: Props = $props();

  let isOpen = $state(false);

  function toggleIsOpen() {
    isOpen = !isOpen;
    if (isOpen) {
      onopen?.();
    } else {
      onclose?.();
    }
  }

  function handleClose() {
    isOpen = false;
    onclose?.();
  }
</script>

<div class={`DropdownMenu ${className || ''}`}>
  {#if trigger}
    {@render trigger({ onTrigger: toggleIsOpen, isOpen })}
  {:else}
    <Button
      round
      size="smaller"
      color="translucent"
      className={isOpen ? 'active' : ''}
      iconName="more"
      onclick={toggleIsOpen}
      ariaLabel="More actions"
    />
  {/if}

  <Menu
    isOpen={isOpen || Boolean(forceOpen)}
    {className}
    {bubbleClassName}
    {footer}
    {autoClose}
    onclose={handleClose}
  >
    {#if children}
      {@render children()}
    {/if}
  </Menu>
</div>

<style lang="scss">
  @import "../DropdownMenu.scss";
</style>
