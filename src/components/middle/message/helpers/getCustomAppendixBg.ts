import type { ISettings } from '../../../../types';

import { MAX_WORKERS, requestMediaWorker } from '../../../../util/launchMediaWorkers';

const SELECTED_APPENDIX_COLORS = {
  dark: {
    outgoing: 'rgb(135,116,225)',
    incoming: 'rgb(33,33,33)',
  },
  light: {
    outgoing: 'rgb(238,255,222)',
    incoming: 'rgb(255,255,255)',
  },
};

export default function getCustomAppendixBg(
  src: string, isOwn: boolean, id: number, isSelected?: boolean, theme?: ISettings['theme'],
) {
  if (isSelected) {
    return Promise.resolve(SELECTED_APPENDIX_COLORS[theme || 'light'][isOwn ? 'outgoing' : 'incoming']);
  }

  return requestMediaWorker({
    name: 'offscreen-canvas:getAppendixColorFromImage',
    args: [src, isOwn],
  }, Math.round(id) % MAX_WORKERS);
}
