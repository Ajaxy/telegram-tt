<script lang="ts">
  import type { TeactNode } from '../../../lib/teact/teact';
  import { IS_ANDROID, IS_IOS } from '../../../util/browser/windowEnvironment';
  import buildClassName from '../../../util/buildClassName';
  import { globalStore } from '../../../global/store.svelte';

  import Tab from './Tab.svelte';

  export type TabWithProperties = {
    id?: number;
    title: TeactNode;
    badgeCount?: number;
    isBlocked?: boolean;
    isBadgeActive?: boolean;
    contextActions?: any[]; // MenuItemContextAction[];
    emoticon?: string;
    noTitleAnimations?: boolean;
  };

  interface Props {
    tabs: readonly TabWithProperties[];
    activeTab: number;
    className?: string;
    tabClassName?: string;
    contextRootElementSelector?: string;
    onSwitchTab: (index: number) => void;
  }

  let {
    tabs,
    activeTab,
    className,
    tabClassName,
    contextRootElementSelector,
    onSwitchTab,
  }: Props = $props();

  let containerRef: HTMLDivElement | undefined;
  let previousActiveTab = $state(0);

  // Need to figure out how to track previous value in Svelte 5
  $effect(() => {
    if (activeTab !== undefined) {
      previousActiveTab = activeTab;
    }
  });

  const isRtl = $derived(globalStore.state.sharedState?.settings?.language === 'ar' || globalStore.state.sharedState?.settings?.language === 'fa');

  const TAB_SCROLL_THRESHOLD_PX = 16;
  const SCROLL_DURATION = IS_IOS ? 450 : IS_ANDROID ? 400 : 300;

  $effect(() => {
    if (!containerRef) return;
    // Wait for a tick to ensure DOM is updated
    let handle: number;
    Promise.resolve().then(() => {
      handle = requestAnimationFrame(() => {
        if (!containerRef) return;
        const container = containerRef;
        const { scrollWidth, offsetWidth, scrollLeft } = container;
        if (scrollWidth <= offsetWidth) {
          return;
        }

        const activeTabElement = container.children[activeTab] as HTMLElement | null;
        if (!activeTabElement) {
          return;
        }

        const { offsetLeft: activeTabOffsetLeft, offsetWidth: activeTabOffsetWidth } = activeTabElement;
        const newLeft = activeTabOffsetLeft - (offsetWidth / 2) + (activeTabOffsetWidth / 2);

        if (Math.abs(newLeft - scrollLeft) < TAB_SCROLL_THRESHOLD_PX) {
          return;
        }

        animateHorizontalScroll(container, newLeft, SCROLL_DURATION);
      });
    });
    return () => cancelAnimationFrame(handle);
  });

  function animateHorizontalScroll(element: HTMLElement, targetLeft: number, duration: number) {
    const startLeft = element.scrollLeft;
    const distance = targetLeft - startLeft;
    let startTime: number | null = null;

    function step(currentTime: number) {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      element.scrollLeft = startLeft + distance * progress;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

</script>

<div
  class={buildClassName('TabList', 'no-scrollbar', className)}
  bind:this={containerRef}
  dir={isRtl ? 'rtl' : undefined}
>
  {#each tabs as tab, i}
    <Tab
      title={tab.title}
      isActive={i === activeTab}
      isBlocked={tab.isBlocked}
      badgeCount={tab.badgeCount}
      isBadgeActive={tab.isBadgeActive}
      previousActiveTab={previousActiveTab}
      onclick={onSwitchTab}
      clickArg={i}
      contextActions={tab.contextActions}
      contextRootElementSelector={contextRootElementSelector}
      className={tabClassName}
    />
  {/each}
</div>

<style lang="scss">
  @import "../TabList.scss";
</style>
