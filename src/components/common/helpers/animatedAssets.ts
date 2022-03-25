import { ApiMediaFormat } from '../../../api/types';

import * as mediaLoader from '../../../util/mediaLoader';

import MonkeyIdle from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyIdle.tgs';
import MonkeyTracking from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyTracking.tgs';
import MonkeyClose from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyClose.tgs';
import MonkeyPeek from '../../../assets/tgs/monkeys/TwoFactorSetupMonkeyPeek.tgs';

import FoldersAll from '../../../assets/tgs/settings/FoldersAll.tgs';
import FoldersNew from '../../../assets/tgs/settings/FoldersNew.tgs';
import DiscussionGroups from '../../../assets/tgs/settings/DiscussionGroupsDucks.tgs';

import CameraFlip from '../../../assets/tgs/calls/CameraFlip.tgs';
import HandFilled from '../../../assets/tgs/calls/HandFilled.tgs';
import HandOutline from '../../../assets/tgs/calls/HandOutline.tgs';
import Speaker from '../../../assets/tgs/calls/Speaker.tgs';
import VoiceAllowTalk from '../../../assets/tgs/calls/VoiceAllowTalk.tgs';
import VoiceMini from '../../../assets/tgs/calls/VoiceMini.tgs';
import VoiceMuted from '../../../assets/tgs/calls/VoiceMuted.tgs';
import VoiceOutlined from '../../../assets/tgs/calls/VoiceOutlined.tgs';

import Peach from '../../../assets/tgs/animatedEmojis/Peach.tgs';
import Eggplant from '../../../assets/tgs/animatedEmojis/Eggplant.tgs';
import Cumshot from '../../../assets/tgs/animatedEmojis/Cumshot.tgs';

import JoinRequest from '../../../assets/tgs/invites/Requests.tgs';
import Invite from '../../../assets/tgs/invites/Invite.tgs';

import QrPlane from '../../../assets/tgs/auth/QrPlane.tgs';

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
  JoinRequest,
  Invite,
  QrPlane,
};

export default function getAnimationData(name: keyof typeof ANIMATED_STICKERS_PATHS) {
  const path = ANIMATED_STICKERS_PATHS[name].replace(window.location.origin, '');

  return mediaLoader.fetch(`file${path}`, ApiMediaFormat.Lottie);
}
