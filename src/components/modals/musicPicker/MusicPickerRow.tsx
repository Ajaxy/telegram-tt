import { memo } from '../../../lib/teact/teact';

import type { ApiAudio } from '../../../api/types';
import type { PlaybackItemRef, PlaybackSource } from '../../../types';

import useLastCallback from '../../../hooks/useLastCallback';

import PlayableAudio from '../../common/PlayableAudio';

import styles from './MusicPickerModal.module.scss';

type OwnProps = {
  audio: ApiAudio;
  item: PlaybackItemRef;
  source: PlaybackSource;
  onSend: (audio: ApiAudio) => void;
};

const PLAYBACK_CONTROLS_SELECTOR = '.toogle-play-wrapper, .media-loading';

const MusicPickerRow = ({
  audio, item, source, onSend,
}: OwnProps) => {
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(PLAYBACK_CONTROLS_SELECTOR)) return;

    onSend(audio);
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;

    e.preventDefault();
    onSend(audio);
  });

  return (
    <div
      className={styles.row}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <PlayableAudio
        audio={audio}
        item={item}
        source={source}
        variant="sharedMedia"
        noProgress
        withPlayingRing
      />
    </div>
  );
};

export default memo(MusicPickerRow);
