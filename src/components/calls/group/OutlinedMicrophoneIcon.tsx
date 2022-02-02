import { GroupCallParticipant, THRESHOLD } from '../../../lib/secret-sauce';
import React, { FC, memo, useMemo } from '../../../lib/teact/teact';
import AnimatedIcon from '../../common/AnimatedIcon';
import usePrevious from '../../../hooks/usePrevious';

type OwnProps = {
  participant: GroupCallParticipant;
  noColor?: boolean;
};

const OutlinedMicrophoneIcon: FC<OwnProps> = ({
  participant,
  noColor,
}) => {
  const { isMuted, isMutedByMe } = participant;
  const isSpeaking = (participant.amplitude || 0) > THRESHOLD;
  const isRaiseHand = Boolean(participant.raiseHandRating);
  const prevIsRaiseHand = usePrevious(isRaiseHand);
  const canSelfUnmute = Boolean(participant?.canSelfUnmute);
  const shouldRaiseHand = !canSelfUnmute && isMuted;
  const prevIsMuted = usePrevious(isMuted);

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

  const microphoneColor: [number, number, number] | undefined = useMemo(() => {
    return noColor ? [0xff, 0xff, 0xff] : (
      isRaiseHand ? [0x4d, 0xa6, 0xe0]
        : (shouldRaiseHand || isMutedByMe ? [0xFF, 0x70, 0x6F] : (
          isSpeaking ? [0x57, 0xBC, 0x6C] : [0x84, 0x8D, 0x94]
        ))
    );
  }, [noColor, isRaiseHand, shouldRaiseHand, isMutedByMe, isSpeaking]);

  return (
    <AnimatedIcon
      name="VoiceOutlined"
      playSegment={playSegment}
      size={28}
      color={microphoneColor}
    />
  );
};

export default memo(OutlinedMicrophoneIcon);
