import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { ANIMATION_END_DELAY } from '../../config';
import { getUserFirstOrLastName } from '../../global/helpers';
import { selectTabState, selectUser } from '../../global/selectors';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Modal, { ANIMATION_DURATION } from '../ui/Modal';
import Separator from '../ui/Separator';
import AnimatedIconWithPreview from './AnimatedIconWithPreview';

import styles from './PrivacySettingsNoticeModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  user?: ApiUser;
  isReadDate?: boolean;
};

const CLOSE_ANIMATION_DURATION = ANIMATION_DURATION + ANIMATION_END_DELAY;

const PrivacySettingsNoticeModal = ({ isOpen, isReadDate, user }: OwnProps & StateProps) => {
  const {
    updateGlobalPrivacySettings,
    openPremiumModal,
    closePrivacySettingsNoticeModal,
    showNotification,
    setPrivacyVisibility,
    loadUser,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const userName = getUserFirstOrLastName(user);

  const handleShowReadTime = useLastCallback(() => {
    updateGlobalPrivacySettings({ shouldHideReadMarks: false });
    closePrivacySettingsNoticeModal();

    setTimeout(() => {
      showNotification({ message: oldLang('PremiumReadSet') });
    }, CLOSE_ANIMATION_DURATION);
  });

  const handleShowLastSeen = useLastCallback(() => {
    setPrivacyVisibility({
      privacyKey: 'lastSeen',
      visibility: 'everybody',
      onSuccess: () => loadUser({ userId: user!.id }),
    });
    closePrivacySettingsNoticeModal();

    setTimeout(() => {
      showNotification({ message: oldLang('PremiumLastSeenSet') });
    }, CLOSE_ANIMATION_DURATION);
  });

  const handleOpenPremium = useLastCallback(() => {
    closePrivacySettingsNoticeModal();

    setTimeout(() => {
      openPremiumModal({ initialSection: 'last_seen' });
    }, CLOSE_ANIMATION_DURATION);
  });

  const handleClose = useLastCallback(() => {
    closePrivacySettingsNoticeModal();
  });

  return (
    <Modal isSlim isOpen={isOpen} onClose={handleClose}>
      <div className={styles.container} dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          className={styles.closeButton}
          color="translucent"
          round
          size="tiny"
          onClick={handleClose}
          ariaLabel="Close"
          iconName="close"
        />
        <AnimatedIconWithPreview
          tgsUrl={isReadDate ? LOCAL_TGS_URLS.ReadTime : LOCAL_TGS_URLS.LastSeen}
          size={84}
          className={styles.icon}
          nonInteractive
          noLoop
        />
        <h2 className={styles.header}>
          {oldLang(isReadDate ? 'PremiumReadHeader1' : 'PremiumLastSeenHeader1')}
        </h2>
        <p className={styles.desc}>
          {renderText(
            oldLang(
              isReadDate ? 'PremiumReadText1' : 'PremiumLastSeenText1Locked',
              userName,
            ),
            ['simple_markdown'],
          )}
        </p>
        <Button
          onClick={isReadDate ? handleShowReadTime : handleShowLastSeen}
          className={styles.button}
        >
          {oldLang(isReadDate ? 'PremiumReadButton1' : 'PremiumLastSeenButton1')}
        </Button>
        <Separator className={styles.separator}>{oldLang('PremiumOr')}</Separator>
        <h2 className={styles.header}>{oldLang('PremiumReadHeader2')}</h2>
        <p className={styles.desc}>
          {renderText(
            oldLang(isReadDate ? 'PremiumReadText2' : 'PremiumLastSeenText2', userName),
            ['simple_markdown'],
          )}
        </p>
        <Button
          withPremiumGradient
          onClick={handleOpenPremium}
          className={styles.button}
        >
          {oldLang('PremiumLastSeenButton2')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(
  withGlobal<OwnProps>((global): Complete<StateProps> => {
    const { chatId, isReadDate } = selectTabState(global).privacySettingsNoticeModal || {};
    const user = chatId ? selectUser(global, chatId) : undefined;

    return { user, isReadDate };
  })(PrivacySettingsNoticeModal),
);
