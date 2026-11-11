import { memo, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';
import { SettingsScreens } from '../../../../types';

import { selectWalletAddress } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import GiftMoveDestination, { type GiftMoveDestinationStep } from '../../../common/gift/GiftMoveDestination';
import PasswordForm from '../../../common/PasswordForm';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import Modal from '../../../ui/Modal';
import Spinner from '../../../ui/Spinner';
import Transition from '../../../ui/Transition';
import WalletAddressGroups from '../../wallet/WalletAddressGroups';

import styles from './GiftMoveToWalletModal.module.scss';

export type OwnProps = {
  modal: TabState['giftMoveToWalletModal'];
};

const CONFIRM_SLIDE = 0;
const PASSWORD_SLIDE = 1;
const DESTINATION_PATH: GiftMoveDestinationStep[] = [
  { icon: 'hamburger' },
  { icon: 'gram-outline', labelKey: 'WalletMenuItem' },
  { icon: 'gift', labelKey: 'WalletTabCollectibles' },
];

type StateProps = {
  walletAddress?: string;
  hasPassword?: boolean;
  passwordHint?: string;
};

const GiftMoveToWalletModal = ({
  modal, walletAddress, hasPassword, passwordHint,
}: OwnProps & StateProps) => {
  const {
    closeGiftMoveToWalletModal,
    closeGiftMoveToWalletPasswordStep,
    clearGiftMoveToWalletError,
    moveGiftToWallet,
    openSettingsScreen,
    closeGiftInfoModal,
  } = getActions();

  const lang = useLang();

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isKeepOnProfileChecked, setIsKeepOnProfileChecked] = useState(true);

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const isPasswordStep = Boolean(renderingModal?.isPasswordStep);
  const isShownOnProfile = Boolean(renderingModal && !renderingModal.gift.isUnsaved);
  const shouldKeepOnProfile = isShownOnProfile && isKeepOnProfileChecked;

  // Like Android, every opening starts with the gift kept on the profile
  useEffect(() => {
    if (isOpen) setIsKeepOnProfileChecked(true);
  }, [isOpen]);

  const handleMove = useLastCallback(() => {
    moveGiftToWallet({ shouldKeepOnProfile });
  });

  const handlePasswordSubmit = useLastCallback((password: string) => {
    moveGiftToWallet({ shouldKeepOnProfile, password });
  });

  const handleSetUpPassword = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.TwoFaDisabled });
    closeGiftMoveToWalletModal();
    closeGiftInfoModal();
  });

  const handleCancel = useLastCallback(() => {
    closeGiftMoveToWalletModal();
  });

  const handleClose = useLastCallback(() => {
    if (isPasswordStep) {
      closeGiftMoveToWalletPasswordStep();
      return;
    }

    closeGiftMoveToWalletModal();
  });

  function renderConfirm() {
    return (
      <div>
        <p>{lang('GiftMoveToWalletText')}</p>
        {walletAddress && <WalletAddressGroups address={walletAddress} className={styles.address} isCheckered />}
        <GiftMoveDestination path={DESTINATION_PATH} />
        {isShownOnProfile && (
          <Checkbox
            className="dialog-checkbox"
            checked={isKeepOnProfileChecked}
            label={lang('GiftMoveToWalletKeep')}
            onCheck={setIsKeepOnProfileChecked}
          />
        )}
        {renderingModal?.errorKey && (
          <p className={styles.error}>{lang.withRegular(renderingModal.errorKey)}</p>
        )}
        <div className="dialog-buttons mt-2">
          <Button
            className="confirm-dialog-button"
            isText
            inline
            disabled={renderingModal?.isLoading}
            onClick={handleMove}
          >
            {lang('GiftMoveButton')}
            {renderingModal?.isLoading && <Spinner className={styles.moveSpinner} />}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={handleCancel}>
            {lang('Cancel')}
          </Button>
        </div>
      </div>
    );
  }

  function renderPassword() {
    if (!hasPassword) {
      return (
        <div className={styles.passwordSlide}>
          <span className={styles.noPassword}>{lang('ErrorPasswordMissing')}</span>
          <Button className={styles.bottomButton} onClick={handleSetUpPassword}>{lang('SetUp2FA')}</Button>
        </div>
      );
    }

    return (
      <div className={buildClassName(styles.passwordSlide, renderingModal?.errorKey && styles.withError)}>
        <PasswordForm
          className={styles.passwordForm}
          shouldShowSubmit
          placeholder={lang('CheckPasswordPlaceholder')}
          error={renderingModal?.passwordErrorKey && lang.withRegular(renderingModal.passwordErrorKey)}
          description={lang('CheckPasswordDescription')}
          isLoading={renderingModal?.isLoading}
          hint={passwordHint}
          isPasswordVisible={isPasswordVisible}
          shouldResetValue={isOpen}
          submitLabel={lang('GiftMoveButton')}
          onClearError={clearGiftMoveToWalletError}
          onChangePasswordVisibility={setIsPasswordVisible}
          onSubmit={handlePasswordSubmit}
        />
        {renderingModal?.errorKey && (
          <p className={buildClassName(styles.error, styles.passwordError)}>
            {lang.withRegular(renderingModal.errorKey)}
          </p>
        )}
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      title={lang(isPasswordStep ? 'TwoStepVerification' : 'GiftMoveToWallet')}
      isCondensedHeader
      hasCloseButton
      isBackButton={isPasswordStep}
      isSlim
      onClose={handleClose}
    >
      <Transition
        name="slideFade"
        slideClassName={styles.slide}
        activeKey={isPasswordStep ? PASSWORD_SLIDE : CONFIRM_SLIDE}
        shouldRestoreHeight
      >
        {isPasswordStep ? renderPassword() : renderConfirm()}
      </Transition>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      settings: {
        byKey: {
          hasPassword,
        },
      },
      twoFaSettings: {
        hint: passwordHint,
      },
    } = global;

    return {
      walletAddress: selectWalletAddress(global),
      hasPassword,
      passwordHint,
    };
  },
)(GiftMoveToWalletModal));
