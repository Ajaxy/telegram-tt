import '../../../global/actions/calls';

import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPhoneCall, ApiUser } from '../../../api/types';

import {
  getStreams, IS_SCREENSHARE_SUPPORTED, switchCameraInputP2p, toggleStreamP2p,
} from '../../../lib/secret-sauce';
import { selectTabState } from '../../../global/selectors';
import { selectPhoneCallUser } from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dateFormat';
import {
  IS_ANDROID,
  IS_IOS,
  IS_REQUEST_FULLSCREEN_SUPPORTED,
} from '../../../util/windowEnvironment';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import renderText from '../../common/helpers/renderText';

import useInterval from '../../../hooks/schedulers/useInterval';
import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';

import AnimatedIcon from '../../common/AnimatedIcon';
import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import PhoneCallButton from './PhoneCallButton';

import styles from './PhoneCall.module.scss';

type StateProps = {
  user?: ApiUser;
  phoneCall?: ApiPhoneCall;
  isOutgoing: boolean;
  isCallPanelVisible?: boolean;
};

const PhoneCall: FC<StateProps> = ({
  user,
  isOutgoing,
  phoneCall,
  isCallPanelVisible,
}) => {
  const lang = useLang();
  const {
    hangUp, requestMasterAndAcceptCall, playGroupCallSound, toggleGroupCallPanel, connectToActivePhoneCall,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, openFullscreen, closeFullscreen] = useFlag();
  const { isMobile } = useAppLayout();

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      closeFullscreen();
    } else {
      openFullscreen();
    }
  }, [closeFullscreen, isFullscreen, openFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (isFullscreen) {
      document.exitFullscreen().then(closeFullscreen);
    } else {
      containerRef.current.requestFullscreen().then(openFullscreen);
    }
  }, [closeFullscreen, isFullscreen, openFullscreen]);

  useEffect(() => {
    if (!IS_REQUEST_FULLSCREEN_SUPPORTED) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    container.addEventListener('fullscreenchange', toggleFullscreen);

    return () => {
      container.removeEventListener('fullscreenchange', toggleFullscreen);
    };
  }, [toggleFullscreen]);

  const handleClose = useCallback(() => {
    toggleGroupCallPanel();
    if (isFullscreen) {
      closeFullscreen();
    }
  }, [closeFullscreen, isFullscreen, toggleGroupCallPanel]);

  const isDiscarded = phoneCall?.state === 'discarded';
  const isBusy = phoneCall?.reason === 'busy';

  const isIncomingRequested = phoneCall?.state === 'requested' && !isOutgoing;
  const isOutgoingRequested = (phoneCall?.state === 'requested' || phoneCall?.state === 'waiting') && isOutgoing;
  const isActive = phoneCall?.state === 'active';
  const isConnected = phoneCall?.isConnected;

  const [isHangingUp, startHangingUp, stopHangingUp] = useFlag();
  const handleHangUp = useCallback(() => {
    startHangingUp();
    hangUp();
  }, [hangUp, startHangingUp]);

  useEffect(() => {
    if (isHangingUp) {
      playGroupCallSound({ sound: 'end' });
    } else if (isIncomingRequested) {
      playGroupCallSound({ sound: 'incoming' });
    } else if (isBusy) {
      playGroupCallSound({ sound: 'busy' });
    } else if (isDiscarded) {
      playGroupCallSound({ sound: 'end' });
    } else if (isOutgoingRequested) {
      playGroupCallSound({ sound: 'ringing' });
    } else if (isConnected) {
      playGroupCallSound({ sound: 'connect' });
    }
  }, [isBusy, isDiscarded, isIncomingRequested, isOutgoingRequested, isConnected, playGroupCallSound, isHangingUp]);

  useEffect(() => {
    if (phoneCall?.id) {
      stopHangingUp();
    } else {
      connectToActivePhoneCall();
    }
  }, [connectToActivePhoneCall, phoneCall?.id, stopHangingUp]);

  const forceUpdate = useForceUpdate();

  useInterval(forceUpdate, isConnected ? 1000 : undefined);

  const callStatus = useMemo(() => {
    const state = phoneCall?.state;
    if (isHangingUp) {
      return lang('lng_call_status_hanging');
    }
    if (isBusy) return 'busy';
    if (state === 'requesting') {
      return lang('lng_call_status_requesting');
    } else if (state === 'requested') {
      return isOutgoing ? lang('lng_call_status_ringing') : lang('lng_call_status_incoming');
    } else if (state === 'waiting') {
      return lang('lng_call_status_waiting');
    } else if (state === 'active' && isConnected) {
      return undefined;
    } else {
      return lang('lng_call_status_exchanging');
    }
  }, [isBusy, isConnected, isHangingUp, isOutgoing, lang, phoneCall?.state]);

  const hasVideo = phoneCall?.videoState === 'active';
  const hasPresentation = phoneCall?.screencastState === 'active';

  const streams = getStreams();
  const hasOwnAudio = streams?.ownAudio?.getTracks()[0].enabled;
  const hasOwnPresentation = streams?.ownPresentation?.getTracks()[0].enabled;
  const hasOwnVideo = streams?.ownVideo?.getTracks()[0].enabled;

  const [isHidingPresentation, startHidingPresentation, stopHidingPresentation] = useFlag();
  const [isHidingVideo, startHidingVideo, stopHidingVideo] = useFlag();

  const handleTogglePresentation = useCallback(() => {
    if (hasOwnPresentation) {
      startHidingPresentation();
    }
    if (hasOwnVideo) {
      startHidingVideo();
    }
    setTimeout(async () => {
      await toggleStreamP2p('presentation');
      stopHidingPresentation();
      stopHidingVideo();
    }, 250);
  }, [
    hasOwnPresentation, hasOwnVideo, startHidingPresentation, startHidingVideo, stopHidingPresentation, stopHidingVideo,
  ]);

  const handleToggleVideo = useCallback(() => {
    if (hasOwnVideo) {
      startHidingVideo();
    }
    if (hasOwnPresentation) {
      startHidingPresentation();
    }
    setTimeout(async () => {
      await toggleStreamP2p('video');
      stopHidingPresentation();
      stopHidingVideo();
    }, 250);
  }, [
    hasOwnPresentation, hasOwnVideo, startHidingPresentation, startHidingVideo, stopHidingPresentation, stopHidingVideo,
  ]);

  const handleToggleAudio = useCallback(() => {
    void toggleStreamP2p('audio');
  }, []);

  const [isEmojiOpen, openEmoji, closeEmoji] = useFlag();

  const [isFlipping, startFlipping, stopFlipping] = useFlag();

  const handleFlipCamera = useCallback(() => {
    startFlipping();
    switchCameraInputP2p();
    setTimeout(stopFlipping, 250);
  }, [startFlipping, stopFlipping]);

  const timeElapsed = phoneCall?.startDate && (Number(new Date()) / 1000 - phoneCall.startDate);

  useEffect(() => {
    if (phoneCall?.state === 'discarded') {
      setTimeout(hangUp, 250);
    }
  }, [hangUp, phoneCall?.reason, phoneCall?.state]);

  return (
    <Modal
      isOpen={phoneCall && phoneCall?.state !== 'discarded' && !isCallPanelVisible}
      onClose={handleClose}
      className={buildClassName(
        styles.root,
        isMobile && styles.singleColumn,
      )}
      dialogRef={containerRef}
    >
      <Avatar
        peer={user}
        size="jumbo"
        className={hasVideo || hasPresentation ? styles.blurred : ''}
      />
      {phoneCall?.screencastState === 'active' && streams?.presentation
        && <video className={styles.mainVideo} muted autoPlay playsInline srcObject={streams.presentation} />}
      {phoneCall?.videoState === 'active' && streams?.video
        && <video className={styles.mainVideo} muted autoPlay playsInline srcObject={streams.video} />}
      <video
        className={buildClassName(
          styles.secondVideo,
          !isHidingPresentation && hasOwnPresentation && styles.visible,
          isFullscreen && styles.fullscreen,
        )}
        muted
        autoPlay
        playsInline
        srcObject={streams?.ownPresentation}
      />
      <video
        className={buildClassName(
          styles.secondVideo,
          !isHidingVideo && hasOwnVideo && styles.visible,
          isFullscreen && styles.fullscreen,
        )}
        muted
        autoPlay
        playsInline
        srcObject={streams?.ownVideo}
      />
      <div className={styles.header}>
        {IS_REQUEST_FULLSCREEN_SUPPORTED && (
          <Button
            round
            size="smaller"
            color="translucent"
            onClick={handleToggleFullscreen}
            ariaLabel={lang(isFullscreen ? 'AccExitFullscreen' : 'AccSwitchToFullscreen')}
          >
            <i className={buildClassName('icon', isFullscreen ? 'icon-smallscreen' : 'icon-fullscreen')} />
          </Button>
        )}

        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleClose}
          className={styles.closeButton}
        >
          <i className="icon icon-close" />
        </Button>
      </div>
      <div
        className={buildClassName(styles.emojisBackdrop, isEmojiOpen && styles.open)}
        onClick={!isEmojiOpen ? openEmoji : closeEmoji}
      >
        <div className={buildClassName(styles.emojis, isEmojiOpen && styles.open)}>
          {phoneCall?.isConnected && phoneCall?.emojis && renderText(phoneCall.emojis, ['emoji'])}
        </div>
        <div className={buildClassName(styles.emojiTooltip, isEmojiOpen && styles.open)}>
          {lang('CallEmojiKeyTooltip', user?.firstName).replace('%%', '%')}
        </div>
      </div>
      <div className={styles.userInfo}>
        <h1>{user?.firstName}</h1>
        <span className={styles.status}>{callStatus || formatMediaDuration(timeElapsed || 0)}</span>
      </div>
      <div className={styles.buttons}>
        <PhoneCallButton
          onClick={handleToggleAudio}
          icon="microphone"
          isDisabled={!isActive}
          isActive={hasOwnAudio}
          label={lang(hasOwnAudio ? 'lng_call_mute_audio' : 'lng_call_unmute_audio')}
        />
        <PhoneCallButton
          onClick={handleToggleVideo}
          icon="video"
          isDisabled={!isActive}
          isActive={hasOwnVideo}
          label={lang(hasOwnVideo ? 'lng_call_stop_video' : 'lng_call_start_video')}
        />
        {hasOwnVideo && (IS_ANDROID || IS_IOS) && (
          <PhoneCallButton
            onClick={handleFlipCamera}
            customIcon={(
              <AnimatedIcon
                tgsUrl={LOCAL_TGS_URLS.CameraFlip}
                playSegment={!isFlipping ? [0, 1] : [0, 10]}
                size={32}
              />
            )}
            isDisabled={!isActive}
            label={lang('VoipFlip')}
          />
        )}
        {IS_SCREENSHARE_SUPPORTED && (
          <PhoneCallButton
            onClick={handleTogglePresentation}
            icon="share-screen"
            isDisabled={!isActive}
            isActive={hasOwnPresentation}
            label={lang('lng_call_screencast')}
          />
        )}
        {isIncomingRequested && (
          <PhoneCallButton
            onClick={requestMasterAndAcceptCall}
            icon="phone-discard"
            isDisabled={isDiscarded}
            label={lang('lng_call_accept')}
            className={styles.accept}
            iconClassName={styles.acceptIcon}
          />
        )}
        <PhoneCallButton
          onClick={handleHangUp}
          icon="phone-discard"
          isDisabled={isDiscarded}
          label={lang(isIncomingRequested ? 'lng_call_decline' : 'lng_call_end_call')}
          className={styles.leave}
        />
      </div>
    </Modal>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const { phoneCall, currentUserId } = global;
    const { isCallPanelVisible, isMasterTab } = selectTabState(global);
    const user = selectPhoneCallUser(global);

    return {
      isCallPanelVisible: Boolean(isCallPanelVisible),
      user,
      isOutgoing: phoneCall?.adminId === currentUserId,
      phoneCall: isMasterTab ? phoneCall : undefined,
    };
  },
)(PhoneCall));
