<script lang="ts">
  import { onMount } from 'svelte';
  import type { TeactNode } from '../../../lib/teact/teact';
  import type { MenuItemContextAction } from './ListItem.svelte';

  import { requestForcedReflow, requestMutation } from '../../../lib/fasterdom/fasterdom';
  import { MouseButton } from '../../../util/browser/windowEnvironment';
  import buildClassName from '../../../util/buildClassName';
  import forceReflow from '../../../util/forceReflow';
  import renderText from '../../common/helpers/renderText';

  import Icon from '../../common/icons/svelte/Icon.svelte';
  import Menu from './Menu.svelte';
  import MenuItem from './MenuItem.svelte';
  import MenuSeparator from './MenuSeparator.svelte';

  interface Props {
    className?: string;
    title: TeactNode;
    isActive?: boolean;
    isBlocked?: boolean;
    badgeCount?: number;
    isBadgeActive?: boolean;
    previousActiveTab?: number;
    onclick?: (arg: number) => void;
    clickArg?: number;
    contextActions?: MenuItemContextAction[];
    contextRootElementSelector?: string;
    icon?: TeactNode;
  }

  let {
    className,
    title,
    isActive,
    isBlocked,
    badgeCount,
    isBadgeActive,
    previousActiveTab,
    contextActions,
    contextRootElementSelector,
    icon,
    clickArg,
    onclick,
  }: Props = $props();

  let tabRef: HTMLButtonElement | undefined;
  let isContextMenuOpen = $state(false);
  let contextMenuAnchor = $state<{ x: number; y: number } | undefined>(undefined);

  const classNames = {
    active: 'Tab--active',
    badgeActive: 'Tab__badge--active',
  };

  // Mimic useLayoutEffect for initial active state
  onMount(() => {
    if (isActive && previousActiveTab === undefined && tabRef) {
      tabRef.classList.add(classNames.active);
    }
  });

  // Mimic useEffect for tab transitions using $effect
  $effect(() => {
    if (!isActive || previousActiveTab === undefined || !tabRef) {
      return;
    }

    const tabEl = tabRef;
    const parent = tabEl.parentElement;
    if (!parent) return;

    const prevTabEl = parent.children[previousActiveTab] as HTMLElement | null;
    if (!prevTabEl) {
      if (isActive && !tabEl.classList.contains(classNames.active)) {
        requestMutation(() => {
          tabEl.classList.add(classNames.active);
        });
      }
      return;
    }

    const platformEl = tabEl.querySelector<HTMLElement>('.platform')!;
    const prevPlatformEl = prevTabEl.querySelector<HTMLElement>('.platform')!;

    const shiftLeft = prevPlatformEl.parentElement!.offsetLeft - platformEl.parentElement!.offsetLeft;
    const scaleFactor = prevPlatformEl.clientWidth / platformEl.clientWidth;

    requestMutation(() => {
      prevPlatformEl.classList.remove('animate');
      platformEl.classList.remove('animate');
      platformEl.style.transform = `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`;

      requestForcedReflow(() => {
        forceReflow(platformEl);

        return () => {
          platformEl.classList.add('animate');
          platformEl.style.transform = 'none';

          prevTabEl.classList.remove(classNames.active);
          tabEl.classList.add(classNames.active);
        };
      });
    });
  });

  function handleClick(e: MouseEvent) {
    if (contextActions && (e.button === MouseButton.Secondary || !onclick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onclick?.(clickArg!);
  }

  function handleMouseDown(e: MouseEvent) {
    // Mimic useFastClick's mousedown logic
    if (e.button !== MouseButton.Main) {
      return;
    }
  }

  function handleContextMenu(e: MouseEvent) {
    if (!contextActions) return;
    e.preventDefault();
    e.stopPropagation();
    contextMenuAnchor = { x: e.clientX, y: e.clientY };
    isContextMenuOpen = true;
  }

  function handleBeforeContextMenu(e: MouseEvent) {
    if (!contextActions) return;
    e.preventDefault();
    e.stopPropagation();
    contextMenuAnchor = { x: e.clientX, y: e.clientY };
    isContextMenuOpen = true;
  }

  function handleContextMenuClose() {
    isContextMenuOpen = false;
  }

  function handleContextMenuHide() {
    contextMenuAnchor = undefined;
  }

  const getTriggerElement = () => tabRef as HTMLElement | undefined;
  const getRootElement: () => HTMLElement | undefined = () => {
    if (contextRootElementSelector) {
      const el = tabRef!.closest(contextRootElementSelector);
      return el instanceof HTMLElement ? el : undefined;
    }
    return document.body;
  };
  const getMenuElement = () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble');
  const getLayout = () => ({ withPortal: true });

</script>

<button
  type="button"
  class={buildClassName('Tab', onclick && 'Tab--interactive', className)}
  onclick={handleClick}
  onmousedown={handleMouseDown}
  oncontextmenu={handleContextMenu}
  bind:this={tabRef}
>
  {#if icon}
    {icon}
  {/if}
  <span class="Tab_inner">
    {#if typeof title === 'string'}
      {@html renderText(title)}
    {:else}
      {title}
    {/if}
    {#if badgeCount}
      <span class={buildClassName('badge', isBadgeActive && classNames.badgeActive)}>{badgeCount}</span>
    {/if}
    {#if isBlocked}
      <Icon name="lock-badge" className="blocked" />
    {/if}
    <i class="platform"></i>
  </span>

  {#if contextActions && contextMenuAnchor !== undefined && isContextMenuOpen}
    <Menu
      isOpen={isContextMenuOpen}
      anchor={contextMenuAnchor}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElement}
      getMenuElement={getMenuElement}
      getLayout={getLayout}
      className="Tab-context-menu"
      autoClose
      onclose={handleContextMenuClose}
      onCloseAnimationEnd={handleContextMenuHide}
      withPortal
    >
      {#each contextActions as action}
        {#if 'isSeparator' in action}
          <MenuSeparator />
        {:else}
          <MenuItem
            icon={action.icon}
            destructive={action.destructive}
            disabled={!action.handler}
            onclick={action.handler}
          >
            {action.title}
          </MenuItem>
        {/if}
      {/each}
    </Menu>
  {/if}
</button>

<style lang="scss">
  @import "../Tab.scss";
</style>
