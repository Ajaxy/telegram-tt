import {
  GroupCallConnectionState, GroupCallParticipant as TypeGroupCallParticipant,
  IS_SCREENSHARE_SUPPORTED, switchCameraInput, toggleSpeaker,
} from '../../../lib/secret-sauce';
import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';
import '../../../modules/actions/calls';

import { IAnchorPosition } from '../../../types';

import {
  IS_ANDROID,
  IS_IOS,
  IS_REQUEST_FULLSCREEN_SUPPORTED,
  IS_SINGLE_COLUMN_LAYOUT,
} from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import {
  selectGroupCall,
  selectGroupCallParticipant,
  selectIsAdminInActiveGroupCall,
} from '../../../modules/selectors/calls';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Loading from '../../ui/Loading';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';
import MicrophoneButton from './MicrophoneButton';
import AnimatedIcon from '../../common/AnimatedIcon';
import Checkbox from '../../ui/Checkbox';
import GroupCallParticipantMenu from './GroupCallParticipantMenu';
import GroupCallParticipantList from './GroupCallParticipantList';
import GroupCallParticipantStreams from './GroupCallParticipantStreams';

import './GroupCall.scss';

const CAMERA_FLIP_PLAY_SEGMENT: [number, number] = [0, 10];
const PARTICIPANT_HEIGHT = 60;

export type OwnProps = {
  groupCallId: string;
};

type StateProps = {
  isGroupCallPanelHidden: boolean;
  connectionState: GroupCallConnectionState;
  title?: string;
  meParticipant?: TypeGroupCallParticipant;
  participantsCount?: number;
  isSpeakerEnabled?: boolean;
  isAdmin: boolean;
  participants: Record<string, TypeGroupCallParticipant>;
};

const GroupCall: FC<OwnProps & StateProps> = ({
  groupCallId,
  isGroupCallPanelHidden,
  connectionState,
  isSpeakerEnabled,
  title,
  meParticipant,
  isAdmin,
  participants,

}) => {
  const {
    toggleGroupCallVideo,
    toggleGroupCallPresentation,
    leaveGroupCall,
    toggleGroupCallPanel,
    connectToActiveGroupCall,
    playGroupCallSound,
  } = getDispatch();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLeaving, setIsLeaving] = useState(false);
  const [isFullscreen, openFullscreen, closeFullscreen] = useFlag();
  const [isSidebarOpen, openSidebar, closeSidebar] = useFlag(true);
  const hasVideoParticipants = participants && Object.values(participants).some((l) => l.video || l.presentation);
  const isLandscape = isFullscreen && !IS_SINGLE_COLUMN_LAYOUT && hasVideoParticipants;

  const [participantMenu, setParticipantMenu] = useState<{
    participant: TypeGroupCallParticipant;
    anchor: IAnchorPosition;
  } | undefined>();
  const [isParticipantMenuOpen, openParticipantMenu, closeParticipantMenu] = useFlag();

  const [isConfirmLeaveModalOpen, openConfirmLeaveModal, closeConfirmLeaveModal] = useFlag();
  const [isEndGroupCallModal, setIsEndGroupCallModal] = useState(false);
  const [shouldEndGroupCall, setShouldEndGroupCall] = useState(false);

  const hasVideo = meParticipant?.hasVideoStream;
  const hasPresentation = meParticipant?.hasPresentationStream;
  const isConnecting = connectionState !== 'connected';
  const canSelfUnmute = meParticipant?.canSelfUnmute;
  const shouldRaiseHand = !canSelfUnmute && meParticipant?.isMuted;

  const handleOpenParticipantMenu = useCallback((anchor: HTMLDivElement, participant: TypeGroupCallParticipant) => {
    const rect = anchor.getBoundingClientRect();
    const container = containerRef.current!;

    setParticipantMenu({
      anchor: { x: rect.left, y: rect.top - container.offsetTop + PARTICIPANT_HEIGHT },
      participant,
    });

    openParticipantMenu();
  }, [openParticipantMenu]);

  useEffect(() => {
    if (connectionState === 'connected') {
      playGroupCallSound({ sound: 'join' });
    } else if (connectionState === 'reconnecting') {
      playGroupCallSound({ sound: 'connecting' });
    }
  }, [connectionState, playGroupCallSound]);

  const handleCloseConfirmLeaveModal = () => {
    closeConfirmLeaveModal();
    setIsEndGroupCallModal(false);
  };

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : undefined}
        onClick={onTrigger}
        ariaLabel={lang('AccDescrMoreOptions')}
      >
        <i className="icon-more" />
      </Button>
    );
  }, [lang]);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (isFullscreen) {
      document.exitFullscreen().then(closeFullscreen);
    } else {
      containerRef.current.requestFullscreen().then(openFullscreen);
    }
  }, [closeFullscreen, isFullscreen, openFullscreen]);

  const handleToggleSidebar = () => {
    if (isSidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  };

  const handleStreamsDoubleClick = useCallback(() => {
    if (!IS_REQUEST_FULLSCREEN_SUPPORTED) return;

    if (!isFullscreen) {
      closeSidebar();
      handleToggleFullscreen();
    } else {
      handleToggleFullscreen();
    }
  }, [closeSidebar, handleToggleFullscreen, isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      closeFullscreen();
    } else {
      openFullscreen();
    }
  }, [closeFullscreen, isFullscreen, openFullscreen]);

  const handleClose = () => {
    toggleGroupCallPanel();
    if (isFullscreen) {
      closeFullscreen();
    }
  };

  useEffect(() => {
    if (!IS_REQUEST_FULLSCREEN_SUPPORTED) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    container.addEventListener('fullscreenchange', toggleFullscreen);

    return () => {
      container.removeEventListener('fullscreenchange', toggleFullscreen);
    };
  }, [toggleFullscreen]);

  const handleClickVideoOrSpeaker = () => {
    if (shouldRaiseHand) {
      toggleSpeaker();
    } else {
      toggleGroupCallVideo();
    }
  };

  useEffect(() => {
    connectToActiveGroupCall();
  }, [connectToActiveGroupCall, groupCallId]);

  const endGroupCall = () => {
    setIsEndGroupCallModal(true);
    setShouldEndGroupCall(true);
    openConfirmLeaveModal();
    if (isFullscreen) {
      handleToggleFullscreen();
    }
  };

  const handleLeaveGroupCall = () => {
    if (isAdmin && !isConfirmLeaveModalOpen) {
      openConfirmLeaveModal();
      if (isFullscreen) {
        handleToggleFullscreen();
      }
      return;
    }
    playGroupCallSound({ sound: 'leave' });
    setIsLeaving(true);
    closeConfirmLeaveModal();
  };

  const handleCloseAnimationEnd = () => {
    if (isLeaving) {
      leaveGroupCall({
        shouldDiscard: shouldEndGroupCall,
      });
    }
  };

  return (
    <Modal
      isOpen={!isGroupCallPanelHidden && !isLeaving}
      onClose={toggleGroupCallPanel}
      className={buildClassName(
        'GroupCall',
        IS_SINGLE_COLUMN_LAYOUT && 'single-column',
        isLandscape && 'landscape',
        !isSidebarOpen && 'no-sidebar',
      )}
      dialogRef={containerRef}
      onCloseAnimationEnd={handleCloseAnimationEnd}
    >
      <div className="header">
        <h3>{title || lang('VoipGroupVoiceChat')}</h3>
        {IS_REQUEST_FULLSCREEN_SUPPORTED && (
          <Button
            round
            size="smaller"
            color="translucent"
            onClick={handleToggleFullscreen}
            ariaLabel={lang(isFullscreen ? 'AccExitFullscreen' : 'AccSwitchToFullscreen')}
          >
            <i className={isFullscreen ? 'icon-smallscreen' : 'icon-fullscreen'} />
          </Button>
        )}
        {isLandscape && (
          <Button
            round
            size="smaller"
            color="translucent"
            onClick={handleToggleSidebar}
          >
            <i className="icon-sidebar" />
          </Button>
        )}
        {((IS_SCREENSHARE_SUPPORTED && !shouldRaiseHand) || isAdmin) && (
          <DropdownMenu
            positionX="right"
            trigger={MainButton}
          >
            {IS_SCREENSHARE_SUPPORTED && !shouldRaiseHand && (
              <MenuItem
                icon="share-screen"
                onClick={toggleGroupCallPresentation}
              >
                {lang(hasPresentation ? 'VoipChatStopScreenCapture' : 'VoipChatStartScreenCapture')}
              </MenuItem>
            )}
            {isAdmin && (
              <MenuItem
                icon="phone-discard-outline"
                onClick={endGroupCall}
                destructive
              >
                {lang('VoipGroupLeaveAlertEndChat')}
              </MenuItem>
            )}
          </DropdownMenu>
        )}
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleClose}
        >
          <i className="icon-close" />
        </Button>
      </div>

      <div className="scrollable custom-scroll">
        <GroupCallParticipantStreams onDoubleClick={handleStreamsDoubleClick} />

        {(!isLandscape || isSidebarOpen)
        && <GroupCallParticipantList openParticipantMenu={handleOpenParticipantMenu} />}
      </div>

      <GroupCallParticipantMenu
        participant={participantMenu?.participant}
        anchor={participantMenu?.anchor}
        isDropdownOpen={isParticipantMenuOpen}
        closeDropdown={closeParticipantMenu}
      />

      <div className="buttons">
        {isConnecting && <Loading />}

        <div className="button-wrapper">
          <div className="video-buttons">
            {hasVideo && (IS_ANDROID || IS_IOS) && (
              <button className="smaller-button" onClick={switchCameraInput}>
                <AnimatedIcon name="CameraFlip" playSegment={CAMERA_FLIP_PLAY_SEGMENT} size={24} />
              </button>
            )}
            <button
              className={buildClassName(
                'small-button',
                shouldRaiseHand ? 'speaker' : 'camera',
                (hasVideo || (shouldRaiseHand && isSpeakerEnabled)) && 'active',
              )}
              onClick={handleClickVideoOrSpeaker}
            >
              <i className={shouldRaiseHand ? 'icon-speaker' : (hasVideo ? 'icon-video-stop' : 'icon-video')} />
            </button>
          </div>

          <div className="button-text">
            {lang(shouldRaiseHand ? 'VoipSpeaker' : 'VoipCamera')}
          </div>
        </div>

        <MicrophoneButton />

        <div className="button-wrapper">
          <button className="small-button leave" onClick={handleLeaveGroupCall}>
            <i className="icon-phone-discard" />
          </button>

          <div className="button-text">
            {lang('VoipGroupLeave')}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isConfirmLeaveModalOpen}
        onClose={handleCloseConfirmLeaveModal}
        className="error"
        title={lang(isEndGroupCallModal ? 'VoipGroupEndAlertTitle' : 'VoipGroupLeaveAlertTitle')}
      >
        <p>{lang(isEndGroupCallModal ? 'VoipGroupEndAlertText' : 'VoipGroupLeaveAlertText')}</p>
        {!isEndGroupCallModal && (
          <Checkbox
            label={lang('VoipGroupEndChat')}
            checked={shouldEndGroupCall}
            onCheck={setShouldEndGroupCall}
          />
        )}
        <Button isText className="confirm-dialog-button" onClick={handleLeaveGroupCall}>
          {lang(isEndGroupCallModal ? 'VoipGroupEnd' : 'VoipGroupLeave')}
        </Button>
        <Button isText className="confirm-dialog-button" onClick={handleCloseConfirmLeaveModal}>
          {lang('Cancel')}
        </Button>
      </Modal>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { groupCallId }): StateProps => {
    const {
      connectionState, title, isSpeakerDisabled, participants, participantsCount,
    } = selectGroupCall(global, groupCallId)! || {};

    return {
      connectionState,
      title,
      isSpeakerEnabled: !isSpeakerDisabled,
      participantsCount,
      meParticipant: selectGroupCallParticipant(global, groupCallId, global.currentUserId!),
      isGroupCallPanelHidden: Boolean(global.groupCalls.isGroupCallPanelHidden),
      isAdmin: selectIsAdminInActiveGroupCall(global),
      participants,
    };
  },
)(GroupCall));
