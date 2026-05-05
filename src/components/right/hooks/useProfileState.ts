import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect } from '../../../lib/teact/teact';

import { ProfileState, type ProfileTabType } from '../../../types';

import animateScroll from '../../../util/animateScroll';
import { throttle } from '../../../util/schedulers';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../hooks/useLastCallback';

const TRANSITION_DURATION = 300;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 350;

const runThrottledForScroll = throttle((cb) => cb(), 250, false);

let isScrollingProgrammatically = false;

function getTabsNaturalTop(container: HTMLElement): number {
  const profileInfo = container.querySelector<HTMLElement>('.profile-info');
  return profileInfo ? profileInfo.offsetHeight : 0;
}

export default function useProfileState({
  containerRef,
  tabType,
  profileState,
  onProfileStateChange,
  forceScrollProfileTab = false,
  allowAutoScrollToTabs = false,
  handleStopAutoScrollToTabs,
}: {
  containerRef: ElementRef<HTMLDivElement>;
  tabType: ProfileTabType;
  profileState: ProfileState;
  forceScrollProfileTab?: boolean;
  allowAutoScrollToTabs?: boolean;
  onProfileStateChange: (state: ProfileState) => void;
  handleStopAutoScrollToTabs: NoneToVoidFunction;
}) {
  // Scroll to tabs if needed
  useEffectWithPrevDeps(([prevTabType]) => {
    if ((prevTabType && prevTabType !== tabType && allowAutoScrollToTabs) || (tabType && forceScrollProfileTab)) {
      const container = containerRef.current!;
      const tabsEl = container.querySelector<HTMLDivElement>('.shared-media-tabs')!;
      handleStopAutoScrollToTabs();
      if (container.scrollTop < getTabsNaturalTop(container)) {
        onProfileStateChange(getStateFromTabType(tabType));
        isScrollingProgrammatically = true;
        animateScroll({
          container,
          element: tabsEl,
          position: 'start',
          forceDuration: TRANSITION_DURATION,
        });
        setTimeout(() => {
          isScrollingProgrammatically = false;
        }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
      }
    }
  }, [
    tabType, onProfileStateChange, containerRef, forceScrollProfileTab,
    allowAutoScrollToTabs, handleStopAutoScrollToTabs,
  ]);

  // Scroll to top
  useEffectWithPrevDeps(([prevProfileState]) => {
    if (profileState !== ProfileState.Profile || profileState === prevProfileState) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const tabsEl = container.querySelector<HTMLDivElement>('.shared-media-tabs');
    if (!tabsEl || getTabsNaturalTop(container) > container.scrollTop) {
      return;
    }

    isScrollingProgrammatically = true;

    animateScroll({
      container,
      element: container.firstElementChild as HTMLElement,
      position: 'start',
      maxDistance: container.offsetHeight * 2,
    });

    setTimeout(() => {
      isScrollingProgrammatically = false;
    }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
  }, [profileState, containerRef]);

  const determineProfileState = useLastCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!container.querySelector('.shared-media-tabs')) {
      return;
    }

    let state: ProfileState = ProfileState.Profile;
    if (Math.ceil(container.scrollTop) >= getTabsNaturalTop(container)) {
      state = getStateFromTabType(tabType);
    }

    if (state !== profileState) {
      onProfileStateChange(state);
    }
  });

  // Determine profile state when switching tabs
  useEffect(() => {
    if (isScrollingProgrammatically) {
      return;
    }

    determineProfileState();
  }, [determineProfileState, tabType]);

  // Determine profile state when scrolling
  const handleScroll = useLastCallback(() => {
    if (isScrollingProgrammatically) {
      return;
    }

    runThrottledForScroll(determineProfileState);
  });

  return { handleScroll };
}

function getStateFromTabType(tabType: ProfileTabType) {
  switch (tabType) {
    case 'members':
      return ProfileState.MemberList;
    case 'gifts':
      return ProfileState.GiftList;
    case 'stories':
      return ProfileState.StoryList;
    case 'dialogs':
      return ProfileState.SavedDialogs;
    default:
      return ProfileState.SharedMedia;
  }
}
