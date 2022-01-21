import { ApiMediaFormat } from '../../../api/types';

import * as mediaLoader from '../../../util/mediaLoader';

// @ts-ignore
import MonkeyIdle from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyIdle.tgs';
// @ts-ignore
import MonkeyTracking from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyTracking.tgs';
// @ts-ignore
import MonkeyClose from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyClose.tgs';
// @ts-ignore
import MonkeyPeek from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyPeek.tgs';
// @ts-ignore
import FoldersAll from '../../../assets/tgs/settings/FoldersAll.tgs';
// @ts-ignore
import FoldersNew from '../../../assets/tgs/settings/FoldersNew.tgs';
// @ts-ignore
import DiscussionGroups from '../../../assets/tgs/settings/DiscussionGroupsDucks.tgs';
// @ts-ignore
import CameraFlip from '../../../assets/tgs/calls/CameraFlip.tgs';
// @ts-ignore
import HandFilled from '../../../assets/tgs/calls/HandFilled.tgs';
// @ts-ignore
import HandOutline from '../../../assets/tgs/calls/HandOutline.tgs';
// @ts-ignore
import Speaker from '../../../assets/tgs/calls/Speaker.tgs';
// @ts-ignore
import VoiceAllowTalk from '../../../assets/tgs/calls/VoiceAllowTalk.tgs';
// @ts-ignore
import VoiceMini from '../../../assets/tgs/calls/VoiceMini.tgs';
// @ts-ignore
import VoiceMuted from '../../../assets/tgs/calls/VoiceMuted.tgs';
// @ts-ignore
import VoiceOutlined from '../../../assets/tgs/calls/VoiceOutlined.tgs';
// @ts-ignore
import Peach from '../../../assets/tgs/animatedEmojis/Peach.tgs';
// @ts-ignore
import Eggplant from '../../../assets/tgs/animatedEmojis/Eggplant.tgs';
// @ts-ignore
import Cumshot from '../../../assets/tgs/animatedEmojis/Cumshot.tgs';

export const ANIMATED_STICKERS_PATHS = {
  MonkeyIdle,
  MonkeyTracking,
  MonkeyClose,
  MonkeyPeek,
  FoldersAll,
  FoldersNew,
  DiscussionGroups,
  CameraFlip,
  HandFilled,
  HandOutline,
  Speaker,
  VoiceAllowTalk,
  VoiceMini,
  VoiceMuted,
  VoiceOutlined,
  Peach,
  Eggplant,
  Cumshot,
};

export default function getAnimationData(name: keyof typeof ANIMATED_STICKERS_PATHS) {
  const path = ANIMATED_STICKERS_PATHS[name].replace(window.location.origin, '');

  return mediaLoader.fetch(`file${path}`, ApiMediaFormat.Lottie);
}
