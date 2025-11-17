import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStealthMode } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { selectIsCurrentUserPremium, selectIsStoryViewerOpen } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getServerTime } from '../../../util/serverTime';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import TextTimer from '../../ui/TextTimer';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './StealthModeModal.module.scss';

export type OwnProps = {
  modal: TabState['storyStealthModal'];
};

type StateProps = {
  isStoryViewerOpen?: boolean;
  stealthMode?: ApiStealthMode;
  isCurrentUserPremium?: boolean;
};

const StealthModeModal = ({
  modal, isStoryViewerOpen, stealthMode, isCurrentUserPremium,
}: OwnProps & StateProps) => {
  const {
    closeStealthModal,
    activateStealthMode,
    showNotification,
    openPremiumModal,
    openStoryViewer,
  } = getActions();

  const lang = useLang();

  const forceUpdate = useForceUpdate();

  const isOnCooldown = Boolean(stealthMode?.cooldownUntil && stealthMode.cooldownUntil > getServerTime());

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const { targetPeerId } = renderingModal || {};

  const handleTimerEnds = useLastCallback(() => {
    forceUpdate();
  });

  const handleClose = useLastCallback(() => {
    closeStealthModal();
  });

  const handleActivate = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      openPremiumModal({ initialSection: 'stories' });
      handleClose();
      return;
    }

    activateStealthMode();
    showNotification({
      title: {
        key: 'StealthModeOnTitle',
      },
      message: {
        key: 'StealthModeOnHintEnabled',
      },
    });
    if (targetPeerId) {
      openStoryViewer({ peerId: targetPeerId });
    }
    handleClose();
  });

  const header = useMemo(() => {
    return (
      <>
        <h3 className={styles.title}>{lang('StealthModeTitle')}</h3>
        <div className={styles.description}>
          {lang(isCurrentUserPremium ? 'StealthModeDescription' : 'StealthModeDescriptionPremium')}
        </div>
      </>
    );
  }, [lang, isCurrentUserPremium]);

  const listItemData = useMemo(() => {
    return [
      ['stealth-past', lang('StealthModeHideRecentTitle'), lang('StealthModeHideRecentDescription')],
      ['stealth-future', lang('StealthModeHideFutureTitle'), lang('StealthModeHideFutureDescription')],
    ] satisfies TableAboutData;
  }, [lang]);

  const buttonText = useMemo(() => {
    if (!isCurrentUserPremium) return lang('StealthModeButtonPremium');
    if (isOnCooldown) {
      return lang('StealthModeButtonRecharge', {
        timer: <TextTimer endsAt={stealthMode!.cooldownUntil!} onEnd={handleTimerEnds} />,
      }, { withNodes: true });
    }
    if (targetPeerId) return lang('StealthModeButtonToStory');
    return lang('StealthModeButton');
  }, [isCurrentUserPremium, isOnCooldown, lang, stealthMode, targetPeerId]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      className={buildClassName(isStoryViewerOpen && 'component-theme-dark')}
      header={header}
      headerIconName="eye-crossed-outline"
      listItemData={listItemData}
      buttonText={buttonText}
      onButtonClick={handleActivate}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal((global): Complete<StateProps> => {
  return {
    isStoryViewerOpen: selectIsStoryViewerOpen(global),
    stealthMode: global.stories.stealthMode,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
  };
})(StealthModeModal));
