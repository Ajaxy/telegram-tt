import { memo, useState } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiAudio } from '../../../api/types';

import { getMediaFormat, getMediaHash } from '../../../global/helpers';
import {
  getPlaybackCapabilities, selectPlaybackItem, selectPlaybackSource,
} from '../../../global/selectors/audioPlayer';
import { ensureAudioContext } from '../../../util/audioPlayback/audioAnalyser';
import { makeSavedMusicTrackKey } from '../../../util/audioPlayback/mediaPool';
import * as playbackController from '../../../util/audioPlayback/playbackController';
import buildClassName from '../../../util/buildClassName';
import renderText from '../helpers/renderText';

import useAudioPlayback from '../../../hooks/useAudioPlayback';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';

import Icon from '../icons/Icon';

import styles from './ProfileMusicStrip.module.scss';

type OwnProps = {
  audio: ApiAudio;
  peerId: string;
  className?: string;
  style?: string;
};

const SAVED_MUSIC_CAPABILITIES = getPlaybackCapabilities('savedMusic');

const ProfileMusicStrip = ({
  audio, peerId, className, style,
}: OwnProps) => {
  const { openAudioPlayer, openAudioPlaylistModal } = getActions();

  const [activatedAudioId, setActivatedAudioId] = useState<string>();
  const isActivated = activatedAudioId === audio.id;

  const trackKey = makeSavedMusicTrackKey(peerId, audio.id);
  const mediaData = useMedia(getMediaHash(audio, 'inline'), !isActivated, getMediaFormat(audio, 'inline'));

  const handleTrackChange = useLastCallback(() => {
    setActivatedAudioId(undefined);
  });

  const { playPause } = useAudioPlayback({
    trackKey,
    mediaType: 'audio',
    capabilities: SAVED_MUSIC_CAPABILITIES,
    src: mediaData,
    originalDuration: audio.duration,
    shouldPlay: isActivated,
    noProgressUpdates: true,
    onTrackChange: handleTrackChange,
  });

  const handleClick = useLastCallback(() => {
    const global = getGlobal();
    const source = selectPlaybackSource(global);
    // Closing the player keeps the source, so an active playlist is only the one that still has a track
    const isPeerPlaylistActive = source?.type === 'savedMusic' && source.peerId === peerId
      && selectPlaybackItem(global)?.type === 'savedMusic';

    if (!isPeerPlaylistActive) {
      ensureAudioContext();
      playbackController.prepareTrackSwitch(trackKey);
      openAudioPlayer({
        item: { type: 'savedMusic', peerId, audioId: audio.id },
        source: { type: 'savedMusic', peerId },
      });
      if (isActivated) {
        playPause();
      } else {
        setActivatedAudioId(audio.id);
      }
    }

    openAudioPlaylistModal();
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    e.preventDefault();
    handleClick();
  });

  const title = renderText(audio.title || audio.fileName);

  return (
    <div className={buildClassName(styles.root, className)} style={style}>
      <div
        className={styles.strip}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Icon name="music-note" className={styles.icon} />
        {audio.performer && (
          <span className={styles.performer}>{renderText(audio.performer)}</span>
        )}
        {audio.performer && <span className={styles.separator}>-</span>}
        <span className={styles.title}>{title}</span>
        <Icon name="next" className={styles.icon} />
      </div>
    </div>
  );
};

export default memo(ProfileMusicStrip);
