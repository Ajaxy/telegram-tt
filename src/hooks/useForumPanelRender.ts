import { useRef } from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';
import useLastCallback from './useLastCallback';
import useSyncEffect from './useSyncEffect';

export default function useForumPanelRender(isForumPanelOpen = false) {
  const shouldRenderForumPanelRef = useRef(isForumPanelOpen);
  const isAnimationStartedRef = useRef(false);
  const forceUpdate = useForceUpdate();

  useSyncEffect(() => {
    if (isForumPanelOpen) {
      shouldRenderForumPanelRef.current = true;
    }
  }, [isForumPanelOpen]);

  const handleForumPanelAnimationEnd = useLastCallback(() => {
    shouldRenderForumPanelRef.current = false;
    isAnimationStartedRef.current = false;
    forceUpdate();
  });

  const handleForumPanelAnimationStart = useLastCallback(() => {
    isAnimationStartedRef.current = true;
    forceUpdate();
  });

  return {
    shouldRenderForumPanel: shouldRenderForumPanelRef.current,
    isAnimationStarted: isAnimationStartedRef.current,
    handleForumPanelAnimationEnd,
    handleForumPanelAnimationStart,
  };
}
