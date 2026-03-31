import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './DisableSharingAboutModal.module.scss';

const ICON_SIZE = 100;

export type OwnProps = {
  modal: TabState['disableSharingAboutModal'];
};

type StateProps = {
  isCurrentUserPremium?: boolean;
};

const DisableSharingAboutModal = ({
  modal,
  isCurrentUserPremium,
}: OwnProps & StateProps) => {
  const {
    closeDisableSharingAboutModal,
    toggleNoForwards,
    openPremiumModal,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const userId = renderingModal?.userId;

  const handleClose = useLastCallback(() => {
    closeDisableSharingAboutModal();
  });

  const handleDisableSharing = useLastCallback(() => {
    if (userId) {
      toggleNoForwards({ userId, isEnabled: true });
    }
    closeDisableSharingAboutModal();
  });

  const handleOpenPremium = useLastCallback(() => {
    closeDisableSharingAboutModal();
    openPremiumModal({ initialSection: 'pm_noforwards' });
  });

  const header = useMemo(() => {
    return (
      <div className={styles.header}>
        <AnimatedIconWithPreview
          size={ICON_SIZE}
          tgsUrl={LOCAL_TGS_URLS.HandStop}
          previewUrl={LOCAL_TGS_PREVIEW_URLS.HandStop}
          noLoop
        />
        <h3 className={styles.title}>{lang('DisableSharing')}</h3>
      </div>
    );
  }, [lang]);

  const listItemData = useMemo(() => {
    return [
      ['no-share', lang('NoForwardingTitle'), lang('NoForwardingDescription')],
      ['no-download', lang('NoSavingTitle'), lang('NoSavingDescription')],
    ] satisfies TableAboutData;
  }, [lang]);

  const footer = useMemo(() => {
    if (isCurrentUserPremium) {
      return (
        <div className={styles.footer}>
          <Button
            onClick={handleDisableSharing}
            noForcedUpperCase
          >
            {lang('DisableSharing')}
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.footer}>
        <Button
          onClick={handleOpenPremium}
          iconName="unlock-badge"
          iconClassName={styles.unlockIcon}
          noForcedUpperCase
        >
          {lang('UnlockButtonTitle')}
        </Button>
      </div>
    );
  }, [isCurrentUserPremium, lang, handleDisableSharing, handleOpenPremium]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      header={header}
      listItemData={listItemData}
      footer={footer}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(DisableSharingAboutModal));
