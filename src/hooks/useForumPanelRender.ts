import { useCallback, useRef } from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';
import useSyncEffect from './useSyncEffect';

export default function useForumPanelRender(isForumPanelOpen = false) {
  const shouldRenderForumPanelRef = useRef(isForumPanelOpen);
  const forceUpdate = useForceUpdate();

  useSyncEffect(() => {
    if (isForumPanelOpen) {
      shouldRenderForumPanelRef.current = true;
    }
  }, [isForumPanelOpen]);

  const handleForumPanelAnimationEnd = useCallback(() => {
    shouldRenderForumPanelRef.current = false;
    forceUpdate();
  }, [forceUpdate]);

  return {
    shouldRenderForumPanel: shouldRenderForumPanelRef.current,
    handleForumPanelAnimationEnd,
  };
}
