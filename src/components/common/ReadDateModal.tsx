import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { ANIMATION_END_DELAY } from '../../config';
import { getUserFirstOrLastName } from '../../global/helpers';
import { selectTabState, selectUser } from '../../global/selectors';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Modal, { ANIMATION_DURATION } from '../ui/Modal';
import Separator from '../ui/Separator';
import AnimatedIconWithPreview from './AnimatedIconWithPreview';
import Icon from './Icon';

import styles from './ReadDateModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  user?: ApiUser;
};

const CLOSE_ANIMATION_DURATION = ANIMATION_DURATION + ANIMATION_END_DELAY;

const ReadDateModal = ({ isOpen, user }: OwnProps & StateProps) => {
  const lang = useLang();
  const {
    updateGlobalPrivacySettings, openPremiumModal, closeGetReadDateModal, showNotification,
  } = getActions();
  const userName = getUserFirstOrLastName(user);

  const handleShowReadTime = useLastCallback(() => {
    updateGlobalPrivacySettings({ shouldHideReadMarks: false });
    closeGetReadDateModal();

    setTimeout(() => {
      showNotification({ message: lang('PremiumReadSet') });
    }, CLOSE_ANIMATION_DURATION);
  });

  const handleOpenPremium = useLastCallback(() => {
    closeGetReadDateModal();

    setTimeout(() => {
      openPremiumModal();
    }, CLOSE_ANIMATION_DURATION);
  });

  const handleClose = useLastCallback(() => {
    closeGetReadDateModal();
  });

  return (
    <Modal isSlim isOpen={isOpen} onClose={handleClose}>
      <div className={styles.container} dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          className={styles.closeButton}
          color="translucent"
          round
          size="smaller"
          onClick={handleClose}
          ariaLabel="Close"
        >
          <Icon name="close" />
        </Button>
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.ReadTime}
          size={84}
          className={styles.icon}
          nonInteractive
          noLoop
        />
        <h2 className={styles.header}>{lang('PremiumReadHeader1')}</h2>
        <p className={styles.desc}>{renderText(lang('PremiumReadText1', userName), ['simple_markdown'])}</p>
        <Button
          size="smaller"
          onClick={handleShowReadTime}
          className={styles.button}
        >
          {lang('PremiumReadButton1')}
        </Button>
        <Separator className={styles.separator}>{lang('PremiumOr')}</Separator>
        <h2 className={styles.header}>{lang('PremiumReadHeader2')}</h2>
        <p className={styles.desc}>{renderText(lang('PremiumReadText2', userName), ['simple_markdown'])}</p>
        <Button withPremiumGradient size="smaller" onClick={handleOpenPremium} className={styles.button}>
          {lang('PremiumLastSeenButton2')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectTabState(global).readDateModal || {};
    const user = chatId ? selectUser(global, chatId) : undefined;

    return { user };
  },
)(ReadDateModal));
