import { useEffect } from '../../../lib/teact/teact';

import { ProfileState } from '../../../types';

import animateScroll from '../../../util/animateScroll';
import { throttle } from '../../../util/schedulers';

import useLastCallback from '../../../hooks/useLastCallback';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';

const TRANSITION_DURATION = 300;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 350;

const runThrottledForScroll = throttle((cb) => cb(), 250, false);

let isScrollingProgrammatically = false;

export default function useProfileState(
  containerRef: { current: HTMLDivElement | null },
  tabType: string,
  profileState: ProfileState,
  onProfileStateChange: (state: ProfileState) => void,
) {
  // Scroll to tabs if needed
  useEffectWithPrevDeps(([prevTabType]) => {
    if (prevTabType && prevTabType !== tabType) {
      const container = containerRef.current!;
      const tabsEl = container.querySelector<HTMLDivElement>('.TabList')!;
      if (container.scrollTop < tabsEl.offsetTop) {
        onProfileStateChange(
          tabType === 'members'
            ? ProfileState.MemberList
            : (tabType === 'stories' ? ProfileState.StoryList : ProfileState.SharedMedia),
        );
        isScrollingProgrammatically = true;
        animateScroll(container, tabsEl, 'start', undefined, undefined, undefined, TRANSITION_DURATION);
        setTimeout(() => {
          isScrollingProgrammatically = false;
        }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
      }
    }
  }, [tabType, onProfileStateChange, containerRef]);

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
    animateScroll(
      container,
      container.firstElementChild as HTMLElement,
      'start',
      undefined,
      container.offsetHeight * 2,
    );

    setTimeout(() => {
      isScrollingProgrammatically = false;
    }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);

    onProfileStateChange(profileState);
  }, [profileState, containerRef, onProfileStateChange]);

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
      state = tabType === 'members'
        ? ProfileState.MemberList
        : (tabType === 'stories' ? ProfileState.StoryList : ProfileState.SharedMedia);
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
