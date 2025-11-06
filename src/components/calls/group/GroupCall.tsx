import '../../../global/actions/calls';

import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  GroupCallConnectionState, GroupCallParticipant as TypeGroupCallParticipant,
} from '../../../lib/secret-sauce';
import type { VideoParticipant } from './hooks/useGroupCallVideoLayout';

import { IS_SCREENSHARE_SUPPORTED } from '../../../lib/secret-sauce';
import { selectChat, selectTabState } from '../../../global/selectors';
import {
  selectCanInviteToActiveGroupCall,
  selectGroupCall,
  selectGroupCallParticipant,
  selectIsAdminInActiveGroupCall,
} from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';
import { compact } from '../../../util/iteratees';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';
import useGroupCallVideoLayout from './hooks/useGroupCallVideoLayout';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Modal from '../../ui/Modal';
import GroupCallParticipantList from './GroupCallParticipantList';
import GroupCallParticipantVideo from './GroupCallParticipantVideo';
import MicrophoneButton from './MicrophoneButton';

import styles from './GroupCall.module.scss';

const INTERSECTION_THROTTLE = 200;

export type OwnProps = {
  groupCallId: string;
};

type StateProps = {
  isCallPanelVisible: boolean;
  connectionState: GroupCallConnectionState;
  title?: string;
  meParticipant?: TypeGroupCallParticipant;
  participantsCount?: number;
  isAdmin: boolean;
  participants: Record<string, TypeGroupCallParticipant>;
  canInvite: boolean;
};

const GroupCall: FC<OwnProps & StateProps> = ({
  groupCallId,
  isCallPanelVisible,
  connectionState,
  participantsCount,
  title,
  meParticipant,
  isAdmin,
  participants,
  canInvite,
}) => {
  const {
    toggleGroupCallVideo,
    toggleGroupCallPresentation,
    leaveGroupCall,
    toggleGroupCallPanel,
    connectToActiveGroupCall,
    playGroupCallSound,
    createGroupCallInviteLink,
  } = getActions();

  const lang = useOldLang();
  const containerRef = useRef<HTMLDivElement>();

  const primaryVideoContainerRef = useRef<HTMLDivElement>();
  const secondaryVideoContainerRef = useRef<HTMLDivElement>();

  const panelScrollTriggerRef = useRef<HTMLDivElement>();
  const panelRef = useRef<HTMLDivElement>();

  const [isLeaving, setIsLeaving] = useState(false);
  const isOpen = !isCallPanelVisible && !isLeaving;

  const { observe } = useIntersectionObserver({
    rootRef: panelRef,
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: !isOpen,
  });

  const hasScrolled = !useIsIntersecting(panelScrollTriggerRef, isOpen ? observe : undefined);

  const { isMobile, isLandscape } = useAppLayout();

  const [isFullscreen, openFullscreen, closeFullscreen] = useFlag();
  const [isSidebarOpen, openSidebar, closeSidebar] = useFlag(true);
  const isLandscapeLayout = Boolean(isFullscreen && isLandscape);
  const isAppFullscreen = useFullscreenStatus();

  const firstPresentation = useMemo(() => {
    return Object.values(participants).find(({ presentation }) => presentation);
  }, [participants]);
  const videoParticipants = useMemo(() => Object.values(participants)
    .filter(({ video, presentation }) => video || presentation)
    .flatMap(({ id, video, presentation }) => compact([
      video ? {
        id,
        type: 'video' as const,
      } : undefined,
      presentation ? {
        id,
        type: 'screen' as const,
      } : undefined,
    ])),
  [participants]);
  const hasVideoParticipants = videoParticipants.length > 0;

  const groupCallTitle = title || lang('VoipGroupVoiceChat');
  const membersString = lang('Participants', participantsCount, 'i');

  const [isConfirmLeaveModalOpen, openConfirmLeaveModal, closeConfirmLeaveModal] = useFlag();
  const [isEndGroupCallModal, setIsEndGroupCallModal] = useState(false);
  const [shouldEndGroupCall, setShouldEndGroupCall] = useState(false);

  const hasVideo = meParticipant?.hasVideoStream;
  const hasPresentation = meParticipant?.hasPresentationStream;
  const hasAudioStream = meParticipant?.hasAudioStream;
  const isConnecting = connectionState !== 'connected';
  const canSelfUnmute = meParticipant?.canSelfUnmute;
  const canRequestToSpeak = !canSelfUnmute && !hasAudioStream;

  useEffect(() => {
    if (connectionState === 'connected') {
      playGroupCallSound({ sound: 'join' });
    } else if (connectionState === 'reconnecting') {
      playGroupCallSound({ sound: 'connecting' });
    }
  }, [connectionState]);

  const handleCloseConfirmLeaveModal = useLastCallback(() => {
    closeConfirmLeaveModal();
    setIsEndGroupCallModal(false);
  });

  const handleToggleFullscreen = useLastCallback(() => {
    if (!containerRef.current || isMobile) return;

    if (isFullscreen) {
      closeFullscreen();
    } else {
      openFullscreen();
    }
  });

  const handleToggleSidebar = useLastCallback(() => {
    if (isSidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  const handleToggleGroupCallPanel = useLastCallback(() => {
    toggleGroupCallPanel();
  });

  const handleInviteMember = useLastCallback(() => {
    createGroupCallInviteLink();
  });

  const handleClickVideo = useLastCallback(() => {
    toggleGroupCallVideo();
  });

  useEffect(() => {
    connectToActiveGroupCall();
  }, [connectToActiveGroupCall, groupCallId]);

  const handleLeaveGroupCall = useLastCallback(() => {
    if (isAdmin && !isConfirmLeaveModalOpen) {
      openConfirmLeaveModal();
      return;
    }
    playGroupCallSound({ sound: 'leave' });
    setIsLeaving(true);
    closeConfirmLeaveModal();
  });

  const handleCloseAnimationEnd = useLastCallback(() => {
    if (!isLeaving) return;

    leaveGroupCall({
      shouldDiscard: shouldEndGroupCall,
    });
  });

  const handleToggleGroupCallPresentation = useLastCallback(() => {
    toggleGroupCallPresentation();
  });

  const canPinVideo = videoParticipants.length > 1 && !isMobile;
  const isLandscapeWithVideos = isLandscapeLayout && hasVideoParticipants;
  const [pinnedVideo, setPinnedVideo] = useState<VideoParticipant | undefined>(undefined);
  const {
    videoLayout,
    panelOffset,
  } = useGroupCallVideoLayout({
    primaryContainerRef: primaryVideoContainerRef,
    secondaryContainerRef: secondaryVideoContainerRef,
    videoParticipants,
    isLandscapeLayout,
    pinnedVideo,
  });

  const handleSetPinnedVideo = useLastCallback((video: VideoParticipant | undefined) => {
    setPinnedVideo(video);
    if (video && !isFullscreen) {
      openFullscreen();
    }
  });

  const handleOpenFirstPresentation = useLastCallback(() => {
    if (!firstPresentation) return;

    setPinnedVideo({
      id: firstPresentation.id,
      type: 'screen',
    });
  });

  useEffect(handleOpenFirstPresentation, [handleOpenFirstPresentation, Boolean(firstPresentation)]);

  useEffect(() => {
    if (!pinnedVideo) return;
    if (!videoParticipants.some((l) => l.type === pinnedVideo.type && l.id === pinnedVideo.id)) {
      setPinnedVideo(undefined);
    }
  }, [pinnedVideo, videoLayout, videoParticipants]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={toggleGroupCallPanel}
      className={buildClassName(
        styles.root,
        (isFullscreen || isMobile) && styles.fullscreen,
        isAppFullscreen && styles.appFullscreen,
        isLandscapeLayout && styles.landscape,
        !hasVideoParticipants && styles.noVideoParticipants,
        !isLandscapeLayout && styles.portrait,
        !isSidebarOpen && isLandscapeWithVideos && styles.noSidebar,
      )}
      dialogRef={containerRef}
      onCloseAnimationEnd={handleCloseAnimationEnd}
    >
      {isLandscapeWithVideos && (
        <div className={styles.videos}>
          <div className={styles.videosHeader}>
            {!isMobile && (
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleToggleFullscreen}
                className={buildClassName(styles.headerButton, styles.firstButton)}
                ariaLabel={lang(isFullscreen ? 'AccExitFullscreen' : 'AccSwitchToFullscreen')}
              >
                <Icon name={isFullscreen ? 'smallscreen' : 'fullscreen'} />
              </Button>
            )}

            <h3 className={buildClassName(styles.title, styles.bigger)}>
              {title || lang('VoipGroupVoiceChat')}
            </h3>

            {isLandscapeWithVideos && !isSidebarOpen && (
              <Button
                round
                size="smaller"
                color="translucent"
                className={buildClassName(styles.headerButton, styles.videosHeaderLastButton)}
                onClick={handleToggleSidebar}
                ariaLabel={lang('AccDescrExpandPanel')}
              >
                <Icon name="sidebar" />
              </Button>
            )}
          </div>

          <div
            className={styles.videosContent}
            ref={primaryVideoContainerRef}
          />
        </div>
      )}

      <div className={styles.panelWrapper} ref={panelRef}>
        <div className={buildClassName(styles.panel, 'custom-scroll')}>
          <div className={styles.panelScrollTrigger} ref={panelScrollTriggerRef} />

          <div className={buildClassName(styles.panelHeader, hasScrolled && styles.scrolled)}>
            {!isLandscapeWithVideos && !isMobile && (
              <Button
                round
                size="smaller"
                color="translucent"
                ripple={!isMobile}
                className={buildClassName(
                  styles.firstButton,
                  styles.headerButton,
                )}
                onClick={handleToggleFullscreen}
                ariaLabel={lang('AccSwitchToFullscreen')}
              >
                <Icon name="fullscreen" />
              </Button>
            )}

            {isMobile && (
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleToggleGroupCallPanel}
                className={buildClassName(styles.headerButton, styles.firstButton)}
                ariaLabel={lang('Close')}
              >
                <Icon name="close" />
              </Button>
            )}

            {isLandscapeWithVideos && (
              <Button
                round
                size="smaller"
                ripple={!isMobile}
                className={buildClassName(
                  styles.firstButton,
                  styles.headerButton,
                )}
                color="translucent"
                onClick={handleToggleSidebar}
                ariaLabel={lang('AccDescrCollapsePanel')}
              >
                <Icon name="sidebar" />
              </Button>
            )}

            <div className={styles.panelHeaderText}>
              <h3 className={buildClassName(styles.title, isLandscapeWithVideos && styles.bigger)}>
                {isLandscapeWithVideos ? membersString : groupCallTitle}
              </h3>
              {!isLandscapeWithVideos && (
                <span className={styles.subtitle}>
                  {membersString}
                </span>
              )}
            </div>

            {!isLandscapeWithVideos && canInvite && (
              <Button
                round
                size="smaller"
                ripple={!isMobile}
                className={buildClassName(
                  styles.lastButton,
                  styles.headerButton,
                )}
                color="translucent"
                onClick={handleInviteMember}
                ariaLabel={lang('VoipGroupInviteMember')}
              >
                <Icon name="add-user" />
              </Button>
            )}
          </div>

          <div className={styles.participants}>
            <div
              className={styles.participantVideos}
              ref={secondaryVideoContainerRef}
              style={`height: ${panelOffset}px;`}
            >
              {videoLayout.map((layout) => {
                const participant = participants[layout.participantId];
                if (!layout.isRemounted || !participant) {
                  return (
                    <div
                      teactOrderKey={layout.orderKey}
                      key={`${layout.participantId}_${layout.type}`}
                    />
                  );
                }

                return (
                  <GroupCallParticipantVideo
                    teactOrderKey={layout.orderKey}
                    key={`${layout.participantId}_${layout.type}`}
                    layout={layout}
                    canPin={canPinVideo}
                    setPinned={handleSetPinnedVideo}
                    pinnedVideo={pinnedVideo}
                    participant={participant}
                  />
                );
              })}
            </div>
            <GroupCallParticipantList
              panelOffset={panelOffset}
              isLandscape={isLandscapeWithVideos}
            />
          </div>
        </div>

        <FloatingActionButton
          key="add-participant"
          isShown={isLandscapeWithVideos && canInvite}
          onClick={handleInviteMember}
          className={styles.addParticipantButton}
          ariaLabel={lang('VoipGroupInviteMember')}
          iconName="add-user-filled"
        />
      </div>

      <div className={styles.mainVideoContainer}>
        {videoLayout.map((layout) => {
          const participant = participants[layout.participantId];
          if (layout.isRemounted || !participant) {
            return (
              <div
                teactOrderKey={layout.orderKey}
                key={`${layout.participantId}_${layout.type}`}
              />
            );
          }
          return (
            <GroupCallParticipantVideo
              teactOrderKey={layout.orderKey}
              key={`${layout.participantId}_${layout.type}`}
              layout={layout}
              canPin={canPinVideo}
              setPinned={handleSetPinnedVideo}
              pinnedVideo={pinnedVideo}
              participant={participant}
              className={styles.video}
            />
          );
        })}
      </div>

      <div className={styles.actions}>
        <Button
          round
          size="default"
          ripple
          className={buildClassName(
            styles.actionButton,
            !hasAudioStream && styles.muted,
            canRequestToSpeak && styles.canRequestToSpeak,
          )}
          onClick={handleClickVideo}
          ariaLabel={lang(hasVideo ? 'VoipStopVideo' : 'VoipStartVideo')}
          disabled={isConnecting}
        >
          <Icon name={!hasVideo ? 'video-stop' : 'video'} />
        </Button>

        <Button
          round
          size="default"
          ripple
          className={buildClassName(
            styles.actionButton,
            !hasAudioStream && styles.muted,
            canRequestToSpeak && styles.canRequestToSpeak,
          )}
          onClick={handleToggleGroupCallPresentation}
          ariaLabel={lang(hasPresentation ? 'lng_group_call_screen_share_stop' : 'lng_group_call_tooltip_screen')}
          disabled={isConnecting || !IS_SCREENSHARE_SUPPORTED}
        >
          <Icon name={!hasPresentation ? 'share-screen-stop' : 'share-screen'} />
        </Button>

        <MicrophoneButton className={styles.actionButton} />

        <Button
          round
          size="default"
          ripple
          className={buildClassName(
            styles.actionButton,
            !hasAudioStream && styles.muted,
            canRequestToSpeak && styles.canRequestToSpeak,
          )}
          ariaLabel={lang('lng_group_call_settings')}
          disabled
        >
          <Icon name="settings-filled" />
        </Button>

        <Button
          round
          size="default"
          ripple
          className={buildClassName(
            styles.actionButton,
            styles.destructive,
          )}
          onClick={handleLeaveGroupCall}
          ariaLabel={lang('lng_group_call_leave')}
        >
          <Icon name="close" />
        </Button>
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
            className="dialog-checkbox"
            label={lang('VoipGroupEndChat')}
            checked={shouldEndGroupCall}
            onCheck={setShouldEndGroupCall}
          />
        )}
        <div className="dialog-buttons">
          <Button isText className="confirm-dialog-button" onClick={handleLeaveGroupCall}>
            {lang(isEndGroupCallModal ? 'VoipGroupEnd' : 'VoipGroupLeave')}
          </Button>
          <Button isText className="confirm-dialog-button" onClick={handleCloseConfirmLeaveModal}>
            {lang('Cancel')}
          </Button>
        </div>
      </Modal>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { groupCallId }): Complete<StateProps> => {
    const {
      connectionState, title, participants, participantsCount, chatId,
    } = selectGroupCall(global, groupCallId) || {};

    const chat = chatId ? selectChat(global, chatId) : undefined;

    return {
      connectionState,
      title: title || chat?.title,
      participantsCount,
      meParticipant: selectGroupCallParticipant(global, groupCallId, global.currentUserId!),
      isCallPanelVisible: Boolean(selectTabState(global).isCallPanelVisible),
      isAdmin: selectIsAdminInActiveGroupCall(global),
      participants,
      canInvite: selectCanInviteToActiveGroupCall(global),
    };
  },
)(GroupCall));
