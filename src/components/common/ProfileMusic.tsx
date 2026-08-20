import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiAudio } from '../../api/types';
import type { MenuItemContextAction } from '../ui/ListItem';
import { ApiMediaFormat } from '../../api/types';

import { getIsDownloading, getMediaFormat, getMediaHash, getMediaTransferState } from '../../global/helpers';
import { selectActiveDownloads } from '../../global/selectors';
import { makeSavedMusicTrackId } from '../../util/audioPlayer';
import buildClassName from '../../util/buildClassName';
import { captureEvents } from '../../util/captureEvents';

import useAppLayout from '../../hooks/useAppLayout';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import useBuffering from '../../hooks/useBuffering';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import ProgressSpinner from '../ui/ProgressSpinner';
import { renderAudio } from './Audio';
import Icon from './icons/Icon';

import './Audio.scss';

type OwnProps = {
  audio: ApiAudio;
  className?: string;
};

type StateProps = {
  isDownloading: boolean;
  isSaved?: boolean;
  isSavedMusicLoading?: boolean;
};

const ProfileMusic = ({
  audio,
  className,
  isDownloading,
  isSaved,
  isSavedMusicLoading,
}: OwnProps & StateProps) => {
  const { cancelMediaDownload, downloadMedia, toggleMusicInProfile } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();
  const seekerRef = useRef<HTMLDivElement>();
  const isSeekingRef = useRef<boolean>(false);

  const lang = useLang();
  const oldLang = useOldLang();
  const { isMobile } = useAppLayout();

  const [isActivated, setIsActivated] = useState(false);

  const coverBlobUrl = useMedia(getMediaHash(audio, 'pictogram'), false, ApiMediaFormat.BlobUrl);
  const mediaData = useMedia(getMediaHash(audio, 'inline'), false, getMediaFormat(audio, 'inline'));

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMediaHash(audio, 'download'),
    !isDownloading,
    getMediaFormat(audio, 'download'),
  );

  const {
    isBuffered, bufferedRanges, bufferingHandlers, checkBuffering,
  } = useBuffering();

  const handleForcePlay = useLastCallback(() => {
    setIsActivated(true);
  });

  const handleTrackChange = useLastCallback(() => {
    setIsActivated(false);
  });

  const {
    isPlaying, playProgress, playPause, setCurrentTime, duration,
  } = useAudioPlayer(
    makeSavedMusicTrackId(audio),
    audio.duration,
    'savedMusic',
    mediaData,
    bufferingHandlers,
    undefined,
    checkBuffering,
    isActivated,
    handleForcePlay,
    handleTrackChange,
    // Drop the track from the playlist on unmount, so it only ever holds the tracks currently listed
    true,
  );

  useEffect(() => {
    setIsActivated(isPlaying);
  }, [isPlaying]);

  const isLoadingForPlaying = isActivated && !isBuffered;

  const { isTransferring, transferProgress } = getMediaTransferState(
    downloadProgress,
    isLoadingForPlaying || isDownloading,
  );

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransitionDeprecated(isTransferring);

  const shouldRenderCross = shouldRenderSpinner && isLoadingForPlaying;

  const handleButtonClick = useLastCallback(() => {
    setIsActivated(!isActivated);
    playPause();
  });

  const handleToggleInProfile = useLastCallback(() => {
    toggleMusicInProfile({ audio });
  });

  const handleDownloadClick = useLastCallback(() => {
    if (isDownloading) {
      cancelMediaDownload({ media: audio });
    } else {
      downloadMedia({ media: audio });
    }
  });

  const contextActions: MenuItemContextAction[] = [{
    title: isDownloading ? lang('ContextCancelDownload') : lang('MediaDownload'),
    icon: isDownloading ? 'stop' : 'download',
    handler: handleDownloadClick,
  }, {
    isSeparator: true,
  }, {
    title: lang(isSaved ? 'AudioRemoveFromProfile' : 'AudioAddToProfile'),
    icon: isSaved ? 'remove-music' : 'add-music',
    destructive: isSaved,
    handler: isSavedMusicLoading ? undefined : handleToggleInProfile,
  }];

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(containerRef);

  const getTriggerElement = useLastCallback(() => containerRef.current);
  const getRootElement = useLastCallback(() => containerRef.current!.closest('.custom-scroll') || document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleSeek = useLastCallback((e: MouseEvent | TouchEvent) => {
    if (!isSeekingRef.current || !seekerRef.current) return;
    const { width, left } = seekerRef.current.getBoundingClientRect();
    const clientX = e instanceof MouseEvent ? e.clientX : e.targetTouches[0].clientX;
    // Prevent track skipping while seeking near end
    setCurrentTime(Math.max(Math.min(duration * ((clientX - left) / width), duration - 0.1), 0.001));
  });

  const handleStartSeek = useLastCallback((e: MouseEvent | TouchEvent) => {
    if (e instanceof MouseEvent && e.button === 2) return;
    isSeekingRef.current = true;
    handleSeek(e);
  });

  const handleStopSeek = useLastCallback(() => {
    isSeekingRef.current = false;
  });

  const withSeekline = isPlaying || (playProgress > 0 && playProgress < 1);

  useEffect(() => {
    if (!seekerRef.current || !withSeekline) return undefined;

    return captureEvents(seekerRef.current, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });
  }, [withSeekline, handleStartSeek, handleSeek, handleStopSeek]);

  return (
    <div
      ref={containerRef}
      className={buildClassName('Audio', 'bigger', className, contextMenuAnchor && 'has-menu-open')}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={handleContextMenu}
    >
      <div
        className={buildClassName('toogle-play-wrapper', shouldRenderCross ? 'loading' : isPlaying ? 'pause' : 'play')}
      >
        <Button
          round
          ripple={!isMobile}
          size="smaller"
          className="toggle-play"
          color={coverBlobUrl ? 'translucent-white' : 'primary'}
          ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
          onClick={handleButtonClick}
          isRtl={lang.isRtl}
          backgroundImage={coverBlobUrl}
        >
          <Icon name="play" />
          <Icon name="pause" />
        </Button>
      </div>
      {shouldRenderSpinner && (
        <div className={buildClassName('media-loading', spinnerClassNames, shouldRenderCross && 'interactive')}>
          <ProgressSpinner
            progress={transferProgress}
            transparent
            withColor
            size="m"
            onClick={shouldRenderCross ? handleButtonClick : undefined}
            noCross={!shouldRenderCross}
          />
        </div>
      )}
      {renderAudio(
        lang,
        oldLang,
        audio,
        duration,
        isPlaying,
        playProgress,
        bufferedRanges,
        seekerRef,
      )}
      {contextMenuAnchor !== undefined && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="shared-media-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { audio }): Complete<StateProps> => {
    return {
      isDownloading: getIsDownloading(selectActiveDownloads(global), audio),
      isSaved: global.users.savedMusicById?.[audio.id],
      isSavedMusicLoading: global.users.isSavedMusicLoading,
    };
  },
)(ProfileMusic));
