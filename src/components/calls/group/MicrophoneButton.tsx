import { GroupCallConnectionState } from '../../../lib/secret-sauce';
import React, {
  FC, memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import buildClassName from '../../../util/buildClassName';
import { vibrateShort } from '../../../util/vibrate';
import usePrevious from '../../../hooks/usePrevious';
import { selectActiveGroupCall, selectGroupCallParticipant } from '../../../global/selectors/calls';
import useLang from '../../../hooks/useLang';

import AnimatedIcon from '../../common/AnimatedIcon';

import './MicrophoneButton.scss';

const CONNECTION_STATE_DEFAULT = 'discarded';

type StateProps = {
  connectionState?: GroupCallConnectionState;
  hasRequestedToSpeak: boolean;
  isMuted?: boolean;
  canSelfUnmute?: boolean;
  noAudioStream: boolean;
};

const REQUEST_TO_SPEAK_THROTTLE = 3000;
const HOLD_TO_SPEAK_TIME = 200;
const ICON_SIZE = 48;

const MicrophoneButton: FC<StateProps> = ({
  noAudioStream,
  canSelfUnmute,
  isMuted,
  hasRequestedToSpeak,
  connectionState,
}) => {
  const {
    toggleGroupCallMute,
    requestToSpeak,
    playGroupCallSound,
  } = getActions();

  const lang = useLang();
  const muteMouseDownState = useRef('up');

  const [isRequestingToSpeak, setIsRequestingToSpeak] = useState(false);
  const isConnecting = connectionState !== 'connected';
  const shouldRaiseHand = !canSelfUnmute && isMuted;
  const prevShouldRaiseHand = usePrevious(shouldRaiseHand);

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

  const toggleMute = () => {
    vibrateShort();
    toggleGroupCallMute();
  };

  const handleMouseDownMute = () => {
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
  };

  const handleMouseUpMute = () => {
    if (shouldRaiseHand) {
      return;
    }
    toggleMute();
    muteMouseDownState.current = 'up';
  };

  const buttonText = useMemo(() => {
    return lang(
      hasRequestedToSpeak ? 'VoipMutedTapedForSpeak' : (
        shouldRaiseHand ? 'VoipMutedByAdmin' : (
          noAudioStream ? 'VoipUnmute' : 'VoipTapToMute'
        )
      ),
    );
  }, [hasRequestedToSpeak, noAudioStream, lang, shouldRaiseHand]);

  return (
    <div className="button-wrapper microphone-wrapper">
      <button
        className={buildClassName(
          'MicrophoneButton',
          noAudioStream && 'crossed',
          canSelfUnmute && 'can-self-unmute',
          isConnecting && 'is-connecting',
          shouldRaiseHand && 'muted-by-admin',
        )}
        onMouseDown={handleMouseDownMute}
        onMouseUp={handleMouseUpMute}
      >
        <AnimatedIcon
          name={animatedIconName}
          size={ICON_SIZE}
          playSegment={playSegment}
        />
      </button>
      <div className="button-text">
        {buttonText}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
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
