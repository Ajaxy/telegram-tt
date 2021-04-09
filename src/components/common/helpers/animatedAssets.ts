import { ApiMediaFormat } from '../../../api/types';

import * as mediaLoader from '../../../util/mediaLoader';

// @ts-ignore
import MonkeyIdle from '../../../assets/TwoFactorSetupMonkeyIdle.tgs';
// @ts-ignore
import MonkeyTracking from '../../../assets/TwoFactorSetupMonkeyTracking.tgs';
// @ts-ignore
import MonkeyClose from '../../../assets/TwoFactorSetupMonkeyClose.tgs';
// @ts-ignore
import MonkeyPeek from '../../../assets/TwoFactorSetupMonkeyPeek.tgs';
// @ts-ignore
import FoldersAll from '../../../assets/FoldersAll.tgs';
// @ts-ignore
import FoldersNew from '../../../assets/FoldersNew.tgs';
// @ts-ignore
import DiscussionGroups from '../../../assets/DiscussionGroupsDucks.tgs';

export const ANIMATED_STICKERS_PATHS = {
  MonkeyIdle,
  MonkeyTracking,
  MonkeyClose,
  MonkeyPeek,
  FoldersAll,
  FoldersNew,
  DiscussionGroups,
};

export default function getAnimationData(name: keyof typeof ANIMATED_STICKERS_PATHS) {
  const path = ANIMATED_STICKERS_PATHS[name].replace(window.location.origin, '');

  return mediaLoader.fetch(`file${path}`, ApiMediaFormat.Lottie);
}
