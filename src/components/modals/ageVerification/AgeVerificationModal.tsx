import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { VERIFY_AGE_MIN_DEFAULT } from '../../../config';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './AgeVerificationModal.module.scss';

export type OwnProps = {
  modal: TabState['isAgeVerificationModalOpen'];
};

type StateProps = {
  verifyAgeBotUsername?: string;
  verifyAgeMin: number;
};

const AgeVerificationModal: FC<OwnProps & StateProps> = ({
  modal,
  verifyAgeBotUsername,
  verifyAgeMin,
}) => {
  const { closeAgeVerificationModal, openChatByUsername } = getActions();
  const lang = useLang();
  const isOpen = Boolean(modal);

  const handleVerifyAge = useLastCallback(() => {
    if (verifyAgeBotUsername) {
      openChatByUsername({
        shouldStartMainApp: true,
        username: verifyAgeBotUsername,
      });
    }
    closeAgeVerificationModal();
  });

  const handleClose = useLastCallback(() => {
    closeAgeVerificationModal();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={styles.root}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Icon name="user" className={styles.icon} />
          </div>
        </div>
        <h2 className={styles.title}>
          {lang('TitleAgeVerificationModal')}
        </h2>
        <p className={styles.mainText}>
          {lang('TextAgeVerificationModal', { count: verifyAgeMin }, {
            withMarkdown: true,
            withNodes: true,
            pluralValue: verifyAgeMin,
          })}
        </p>
        <p className={styles.description}>
          {lang('DescriptionAgeVerificationModal')}
        </p>
      </div>
      <div className="dialog-buttons mt-2">
        <Button
          onClick={handleVerifyAge}
        >
          {lang('ButtonAgeVerification')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal((global): Complete<StateProps> => {
  const appConfig = global.appConfig;
  const verifyAgeBotUsername = appConfig.verifyAgeBotUsername;
  const verifyAgeMin = appConfig.verifyAgeMin || VERIFY_AGE_MIN_DEFAULT;

  return {
    verifyAgeBotUsername,
    verifyAgeMin,
  };
})(AgeVerificationModal));
