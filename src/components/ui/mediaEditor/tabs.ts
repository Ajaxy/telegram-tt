import type { EditorTabContext, EditorTabDescriptor } from './types';

import AdjustPanel from './panels/AdjustPanel';
import CropPanel from './panels/CropPanel';
import DrawPanel from './panels/DrawPanel';
import StickerPanel from './panels/StickerPanel';
import TextPanel from './panels/TextPanel';

function getIsEditable({ isVideo, canProcessVideo }: EditorTabContext) {
  return !isVideo || canProcessVideo;
}

const EDITOR_TABS: EditorTabDescriptor[] = [
  {
    id: 'adjust', icon: 'tools', labelKey: 'Adjust', Panel: AdjustPanel,
  },
  {
    id: 'crop', icon: 'crop', labelKey: 'Crop', isCropMode: true, isAvailable: getIsEditable, Panel: CropPanel,
  },
  {
    id: 'text', icon: 'text', labelKey: 'Text', isAvailable: getIsEditable, Panel: TextPanel,
  },
  {
    id: 'draw', icon: 'brush', labelKey: 'Draw', isAvailable: getIsEditable, Panel: DrawPanel,
  },
  {
    id: 'stickers',
    icon: 'smile',
    labelKey: 'Stickers',
    isAvailable: (context) => getIsEditable(context) && context.canAddStickers,
    Panel: StickerPanel,
  },
];

export function getAvailableTabs(context: EditorTabContext) {
  return EDITOR_TABS.filter((tab) => !tab.isAvailable || tab.isAvailable(context));
}
