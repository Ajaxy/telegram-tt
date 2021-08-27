import { useCallback, useEffect } from '../../../lib/teact/teact';

import { ProfileState } from '../../../types';

import fastSmoothScroll from '../../../util/fastSmoothScroll';
import { throttle } from '../../../util/schedulers';
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
        onProfileStateChange(tabType === 'members' ? ProfileState.MemberList : ProfileState.SharedMedia);
        isScrollingProgrammatically = true;
        fastSmoothScroll(container, tabsEl, 'start', undefined, undefined, undefined, TRANSITION_DURATION);
        setTimeout(() => {
          isScrollingProgrammatically = false;
        }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
      }
    }
  }, [tabType, onProfileStateChange]);

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
    if (!tabListEl) {
      return;
    }

    isScrollingProgrammatically = true;
    fastSmoothScroll(
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
  }, [profileState]);

  const determineProfileState = useCallback(() => {
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
        : ProfileState.SharedMedia;
    }

    onProfileStateChange(state);
  }, [containerRef, onProfileStateChange, tabType]);

  // Determine profile state when switching tabs
  useEffect(() => {
    if (isScrollingProgrammatically) {
      return;
    }

    determineProfileState();
  }, [determineProfileState, tabType]);

  // Determine profile state when scrolling
  const handleScroll = useCallback(() => {
    if (isScrollingProgrammatically) {
      return;
    }

    runThrottledForScroll(determineProfileState);
  }, [determineProfileState]);

  return { handleScroll };
}
