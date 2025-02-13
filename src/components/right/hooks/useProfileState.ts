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

export default function useProfileState(
  containerRef: { current: HTMLDivElement | null },
  tabType: ProfileTabType,
  profileState: ProfileState,
  onProfileStateChange: (state: ProfileState) => void,
  forceScrollProfileTab = false,
  allowAutoScrollToTabs = false,
  handleStopAutoScrollToTabs: () => void,
) {
  // Scroll to tabs if needed
  useEffectWithPrevDeps(([prevTabType]) => {
    if ((prevTabType && prevTabType !== tabType && allowAutoScrollToTabs) || (tabType && forceScrollProfileTab)) {
      const container = containerRef.current!;
      const tabsEl = container.querySelector<HTMLDivElement>('.TabList')!;
      handleStopAutoScrollToTabs();
      if (container.scrollTop < tabsEl.offsetTop) {
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
  }, [tabType, onProfileStateChange, containerRef, forceScrollProfileTab,
    allowAutoScrollToTabs, handleStopAutoScrollToTabs]);

  // Scroll to top
  useEffectWithPrevDeps(([prevProfileState]) => {
    if (profileState !== ProfileState.Profile || profileState === prevProfileState) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const tabListEl = container.querySelector<HTMLDivElement>('.TabList');
    if (!tabListEl || tabListEl.offsetTop > container.scrollTop) {
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

    const tabListEl = container.querySelector<HTMLDivElement>('.TabList');
    if (!tabListEl) {
      return;
    }

    let state: ProfileState = ProfileState.Profile;
    if (container.scrollTop >= tabListEl.offsetTop) {
      state = getStateFromTabType(tabType);
    }

    onProfileStateChange(state);
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
