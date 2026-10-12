import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiAudio } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';

import styles from './StoryViewer.module.scss';

type OwnProps = {
  audio: ApiAudio;
  isProtected?: boolean;
  className?: string;
  onMenuOpen: NoneToVoidFunction;
  onMenuClose: NoneToVoidFunction;
};

type StateProps = {
  savedMusicById?: Record<string, true>;
  isSavedMusicLoading?: boolean;
};

function StoryMusic({
  audio,
  isProtected,
  className,
  savedMusicById,
  isSavedMusicLoading,
  onMenuOpen,
  onMenuClose,
}: OwnProps & StateProps) {
  const { loadSavedMusicIds, toggleMusicInProfile, sendAudioToSavedMessages } = getActions();
  const lang = useLang();

  const isMusicSaved = Boolean(savedMusicById?.[audio.id]);

  const handleMenuOpen = useLastCallback(() => {
    loadSavedMusicIds();
    onMenuOpen();
  });

  const handleSendToSavedMessages = useLastCallback(() => {
    sendAudioToSavedMessages({ audio });
  });

  const handleToggleInProfile = useLastCallback(() => {
    toggleMusicInProfile({ audio });
  });

  const MusicButton = useMemo(() => {
    const title = audio.title || audio.fileName;

    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <button
        type="button"
        className={buildClassName(styles.music, isOpen && styles.musicActive)}
        onClick={onTrigger}
      >
        <Icon name="music-note" className={styles.musicIcon} />
        <span className={styles.musicTitle} dir="auto">{renderText(title)}</span>
        {audio.performer && (
          <span className={styles.musicPerformer} dir="auto">
            {'· '}
            {renderText(audio.performer)}
          </span>
        )}
      </button>
    );
  }, [audio]);

  return (
    <div className={buildClassName(styles.musicMenu, className)}>
      <DropdownMenu
        trigger={MusicButton}
        positionY="bottom"
        onOpen={handleMenuOpen}
        onClose={onMenuClose}
      >
        {!isProtected && (
          <MenuItem icon="saved-messages" onClick={handleSendToSavedMessages}>
            {lang('AudioAddToSaved')}
          </MenuItem>
        )}
        <MenuItem
          icon={isMusicSaved ? 'delete' : 'profile-music'}
          disabled={!savedMusicById || isSavedMusicLoading}
          onClick={handleToggleInProfile}
        >
          {lang(isMusicSaved ? 'AudioRemoveFromProfile' : 'AudioAddToProfile')}
        </MenuItem>
      </DropdownMenu>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  return {
    savedMusicById: global.users.savedMusicById,
    isSavedMusicLoading: global.users.isSavedMusicLoading,
  };
})(StoryMusic));
