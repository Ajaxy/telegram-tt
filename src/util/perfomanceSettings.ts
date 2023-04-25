import type { PerformanceType } from '../types';

export function applyPerformanceSettings(performanceType: PerformanceType) {
  const {
    pageTransitions,
    messageSendingAnimations,
    mediaViewerAnimations,
    messageComposerAnimations,
    contextMenuAnimations,
    contextMenuBlur,
    rightColumnAnimations,
  } = performanceType;

  const root = document.body;

  root.classList.toggle('no-page-transitions', !pageTransitions);
  root.classList.toggle('no-message-sending-animations', !messageSendingAnimations);
  root.classList.toggle('no-media-viewer-animations', !mediaViewerAnimations);
  root.classList.toggle('no-message-composer-animations', !messageComposerAnimations);
  root.classList.toggle('no-context-menu-animations', !contextMenuAnimations);
  root.classList.toggle('no-menu-blur', !contextMenuBlur);
  root.classList.toggle('no-right-column-animations', !rightColumnAnimations);
}
