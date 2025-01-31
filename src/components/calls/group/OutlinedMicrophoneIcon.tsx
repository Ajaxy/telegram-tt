import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { GroupCallParticipant } from '../../../lib/secret-sauce';

import { THRESHOLD } from '../../../lib/secret-sauce';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';

import AnimatedIcon from '../../common/AnimatedIcon';

type OwnProps = {
  participant: GroupCallParticipant;
  noColor?: boolean;
  className?: string;
};

const OutlinedMicrophoneIcon: FC<OwnProps> = ({
  participant,
  noColor,
  className,
}) => {
  const { isMuted, isMutedByMe } = participant;
  const isSpeaking = (participant.amplitude || 0) > THRESHOLD;
  const isRaiseHand = Boolean(participant.raiseHandRating);
  const prevIsRaiseHand = usePreviousDeprecated(isRaiseHand);
  const canSelfUnmute = Boolean(participant?.canSelfUnmute);
  const shouldRaiseHand = !canSelfUnmute && isMuted;
  const prevIsMuted = usePreviousDeprecated(isMuted);

  const playSegment: [number, number] = useMemo(() => {
    if (isMuted && !prevIsMuted) {
      return [43, 64];
    }

    if (!isMuted && prevIsMuted) {
      return [22, 42];
    }

    if (isRaiseHand && !prevIsRaiseHand) {
      return [65, 84];
    }

    if (!shouldRaiseHand && prevIsRaiseHand) {
      return [0, 21];
    }

    // TODO cancel request to speak should play in reverse
    // if (!isRaiseHand && prevIsRaiseHand) {
    //   return [84, 65];
    // }

    return isMuted ? [22, 23] : [43, 44];
    // eslint-disable-next-line
  }, [isMuted, shouldRaiseHand, isRaiseHand]);

  const microphoneColor: string = useMemo(() => {
    if (noColor) {
      return '#ffffff';
    }

    if (isRaiseHand) {
      return '#4da6e0';
    }

    if (shouldRaiseHand || isMutedByMe) {
      return '#ff706f';
    }

    if (isSpeaking) {
      return '#57bc6c';
    }

    return '#aaaaaa';
  }, [noColor, isRaiseHand, shouldRaiseHand, isMutedByMe, isSpeaking]);

  return (
    <AnimatedIcon
      tgsUrl={LOCAL_TGS_URLS.VoiceOutlined}
      play={playSegment.toString()}
      playSegment={playSegment}
      size={28}
      color={microphoneColor}
      className={className}
      forceAlways
      nonInteractive
    />
  );
};

export default memo(OutlinedMicrophoneIcon);
