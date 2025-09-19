import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStealthMode } from '../../api/types';

import { selectIsCurrentUserPremium, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getServerTime } from '../../util/serverTime';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import TextTimer from '../ui/TextTimer';

import styles from './StealthModeModal.module.scss';

type StateProps = {
  isOpen?: boolean;
  stealthMode?: ApiStealthMode;
  isCurrentUserPremium?: boolean;
};

const StealthModeModal = ({ isOpen, stealthMode, isCurrentUserPremium }: StateProps) => {
  const {
    toggleStealthModal,
    activateStealthMode,
    showNotification,
    openPremiumModal,
  } = getActions();
  const [isOnCooldown, setIsOnCooldown] = useState(false);

  useEffect(() => {
    if (!stealthMode) return;
    const serverTime = getServerTime();
    if (stealthMode.cooldownUntil && stealthMode.cooldownUntil > serverTime) {
      setIsOnCooldown(true);
    }
  }, [stealthMode, isOpen]);

  const lang = useOldLang();

  const handleTimerEnds = useLastCallback(() => {
    setIsOnCooldown(false);
  });

  const handleClose = useLastCallback(() => {
    toggleStealthModal({ isOpen: false });
  });

  const handleActivate = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      openPremiumModal({ initialSection: 'stories' });
      return;
    }

    activateStealthMode();
    showNotification({
      title: lang('StealthModeOn'),
      message: lang('StealthModeOnHint'),
    });
    toggleStealthModal({ isOpen: false });
  });

  return (
    <Modal
      className="component-theme-dark"
      contentClassName={styles.root}
      isOpen={isOpen}
      isSlim
      onClose={handleClose}
    >
      <Button
        round
        color="translucent"
        size="smaller"
        className={styles.closeButton}
        ariaLabel={lang('Close')}
        onClick={handleClose}
      >
        <Icon name="close" />
      </Button>
      <div className={styles.stealthIcon}>
        <Icon name="eye-crossed-outline" />
      </div>
      <div className={styles.title}>{lang('StealthMode')}</div>
      <div className={styles.description}>
        {lang(isCurrentUserPremium ? 'StealthModeHint' : 'StealthModePremiumHint')}
      </div>
      <ListItem
        className={buildClassName(styles.listItem, 'smaller-icon')}
        multiline
        inactive
        leftElement={<Icon name="stealth-past" className={styles.icon} />}
      >
        <span className="title">{lang('HideRecentViews')}</span>
        <span className={buildClassName('subtitle', styles.subtitle)}>{lang('HideRecentViewsDescription')}</span>
      </ListItem>
      <ListItem
        className={buildClassName(styles.listItem, 'smaller-icon')}
        multiline
        inactive
        leftElement={<Icon name="stealth-future" className={styles.icon} aria-hidden />}
      >
        <span className="title">{lang('HideNextViews')}</span>
        <span className={buildClassName('subtitle', styles.subtitle)}>{lang('HideNextViewsDescription')}</span>
      </ListItem>
      <Button
        className={styles.button}
        disabled={isOnCooldown}
        isShiny={!isCurrentUserPremium}
        withPremiumGradient={!isCurrentUserPremium}
        onClick={handleActivate}
      >
        {!isCurrentUserPremium ? lang('UnlockStealthMode')
          : isOnCooldown
            ? (<TextTimer langKey="AvailableIn" endsAt={stealthMode!.cooldownUntil!} onEnd={handleTimerEnds} />)
            : lang('EnableStealthMode')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal((global): Complete<StateProps> => {
  const tabState = selectTabState(global);

  return {
    isOpen: tabState.storyViewer?.isStealthModalOpen,
    stealthMode: global.stories.stealthMode,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
  };
})(StealthModeModal));
