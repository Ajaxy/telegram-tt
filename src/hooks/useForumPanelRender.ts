import { useCallback, useRef } from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';
import useOnChange from './useOnChange';

export default function useForumPanelRender(isForumPanelOpen = false) {
  const shouldRenderForumPanelRef = useRef(isForumPanelOpen);
  const forceUpdate = useForceUpdate();

  useOnChange(() => {
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
