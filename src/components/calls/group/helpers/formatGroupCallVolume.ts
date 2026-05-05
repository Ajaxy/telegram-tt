import type { GroupCallParticipant } from '../../../../lib/vibecalls';

import { GROUP_CALL_DEFAULT_VOLUME, GROUP_CALL_VOLUME_MULTIPLIER } from '../../../../config';

export default function formatGroupCallVolume(participant: GroupCallParticipant) {
  return Math.floor((participant.volume || GROUP_CALL_DEFAULT_VOLUME) / GROUP_CALL_VOLUME_MULTIPLIER).toString();
}
