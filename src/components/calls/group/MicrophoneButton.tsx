import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { GroupCallConnectionState } from '../../../lib/secret-sauce';

import { selectActiveGroupCall, selectGroupCallParticipant } from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';
import { vibrateShort } from '../../../util/vibrate';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';

import AnimatedIcon from '../../common/AnimatedIcon';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';

import styles from './MicrophoneButton.module.scss';

const CONNECTION_STATE_DEFAULT = 'discarded';

type OwnProps = {
  className?: string;
};

type StateProps = {
  connectionState?: GroupCallConnectionState;
  hasRequestedToSpeak: boolean;
  isMuted?: boolean;
  canSelfUnmute?: boolean;
  noAudioStream: boolean;
};

const REQUEST_TO_SPEAK_THROTTLE = 3000;
const HOLD_TO_SPEAK_TIME = 200;
const ICON_SIZE = 36;

const MicrophoneButton: FC<OwnProps & StateProps> = ({
  className,
  noAudioStream,
  canSelfUnmute,
  isMuted,
  connectionState,
}) => {
  const {
    toggleGroupCallMute,
    requestToSpeak,
    playGroupCallSound,
  } = getActions();

  const lang = useOldLang();
  const muteMouseDownState = useRef('up');

  const [isRequestingToSpeak, setIsRequestingToSpeak] = useState(false);
  const isConnecting = connectionState !== 'connected';
  const shouldRaiseHand = !canSelfUnmute && isMuted;
  const prevShouldRaiseHand = usePreviousDeprecated(shouldRaiseHand);

  useEffect(() => {
    if (prevShouldRaiseHand && !shouldRaiseHand) {
      playGroupCallSound({ sound: 'allowTalk' });
    }
  }, [playGroupCallSound, prevShouldRaiseHand, shouldRaiseHand]);

  // Voice mini
  // unmuted -> muted [69, 99]
  // muted -> unmuted [36, 69]
  // raise -> muted [0, 36]
  // muted -> raise [99, 136]
  // unmuted -> raise [136, 172]
  // TODO should probably move to other component
  const playSegment: [number, number] = useMemo(() => {
    if (isRequestingToSpeak) {
      const r = Math.floor(Math.random() * 100);
      return (r < 32 ? [0, 120]
        : (r < 64 ? [120, 240]
          : (r < 97 ? [240, 420]
            : [420, 540]
          )
        )
      );
    }
    if (!prevShouldRaiseHand && shouldRaiseHand) {
      return noAudioStream ? [99, 135] : [136, 172];
    }
    if (prevShouldRaiseHand && !shouldRaiseHand) {
      return [0, 36];
    }
    if (!shouldRaiseHand) {
      return noAudioStream ? [69, 99] : [36, 69];
    }
    return [0, 0];
  }, [prevShouldRaiseHand, isRequestingToSpeak, noAudioStream, shouldRaiseHand]);

  const animatedIconName = isRequestingToSpeak ? 'HandFilled' : 'VoiceMini';

  const toggleMute = useCallback(() => {
    vibrateShort();
    toggleGroupCallMute();
  }, [toggleGroupCallMute]);

  const handleMouseDownMute = useCallback(() => {
    if (shouldRaiseHand) {
      if (isRequestingToSpeak) return;
      vibrateShort();
      requestToSpeak();
      setIsRequestingToSpeak(true);
      setTimeout(() => {
        setIsRequestingToSpeak(false);
      }, REQUEST_TO_SPEAK_THROTTLE);
      return;
    }
    muteMouseDownState.current = 'down';
    if (noAudioStream) {
      setTimeout(() => {
        if (muteMouseDownState.current === 'down') {
          muteMouseDownState.current = 'hold';
          toggleMute();
        }
      }, HOLD_TO_SPEAK_TIME);
    }
  }, [isRequestingToSpeak, noAudioStream, requestToSpeak, shouldRaiseHand, toggleMute]);

  const handleMouseUpMute = useCallback(() => {
    if (shouldRaiseHand) {
      return;
    }
    toggleMute();
    muteMouseDownState.current = 'up';
  }, [shouldRaiseHand, toggleMute]);

  return (
    <Button
      round
      size="default"
      className={buildClassName(
        styles.root,
        !isConnecting && noAudioStream && styles.canUnmute,
        !isConnecting && shouldRaiseHand && styles.mutedByAdmin,
        className,
      )}
      onMouseDown={handleMouseDownMute}
      onMouseUp={handleMouseUpMute}
      ariaLabel={lang(isMuted ? 'VoipUnmute' : 'VoipMute')}
      disabled={isConnecting}
    >
      <AnimatedIcon
        tgsUrl={LOCAL_TGS_URLS[animatedIconName]}
        size={ICON_SIZE}
        play={playSegment.toString()}
        playSegment={playSegment}
        className={styles.icon}
        forceAlways
      />
      <Spinner className={buildClassName(styles.spinner, isConnecting && styles.spinnerVisible)} color="white" />
    </Button>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const groupCall = selectActiveGroupCall(global);

    const { connectionState } = groupCall || {};
    const meParticipant = groupCall && selectGroupCallParticipant(global, groupCall.id, global.currentUserId!);

    const {
      raiseHandRating, hasAudioStream, canSelfUnmute, isMuted,
    } = meParticipant || {};

    return {
      connectionState: connectionState || CONNECTION_STATE_DEFAULT,
      hasRequestedToSpeak: Boolean(raiseHandRating),
      noAudioStream: !hasAudioStream,
      canSelfUnmute,
      isMuted,
    };
  },
)(MicrophoneButton));
