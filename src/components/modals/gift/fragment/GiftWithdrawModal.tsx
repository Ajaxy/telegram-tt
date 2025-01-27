import React, {
  memo,
  useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftUnique } from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import type { CustomPeer } from '../../../../types';

import { getDays } from '../../../../util/dates/units';
import { getServerTime } from '../../../../util/serverTime';
import { getGiftAttributes } from '../../../common/helpers/gifts';
import { REM } from '../../../common/helpers/mediaDimensions';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import Icon from '../../../common/icons/Icon';
import PasswordForm from '../../../common/PasswordForm';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import Modal from '../../../ui/Modal';

import styles from './GiftWithdrawModal.module.scss';

export type OwnProps = {
  modal: TabState['giftWithdrawModal'];
};

type StateProps = {
  hasPassword?: boolean;
  passwordHint?: string;
};

const FRAGMENT_PEER: CustomPeer = {
  isCustomPeer: true,
  avatarIcon: 'fragment',
  title: '',
  customPeerAvatarColor: '#000000',
};
const GIFT_STICKER_SIZE = 4.5 * REM;

const GiftWithdrawModal = ({ modal, hasPassword, passwordHint }: OwnProps & StateProps) => {
  const { closeGiftWithdrawModal, clearGiftWithdrawError, processStarGiftWithdrawal } = getActions();
  const isOpen = Boolean(modal);

  const [shouldShowPassword, setShouldShowPassword] = useState(false);

  const lang = useLang();

  const renderingModal = useCurrentOrPrev(modal);
  const gift = renderingModal?.gift?.gift as ApiStarGiftUnique;
  const giftAttributes = gift && getGiftAttributes(gift);
  const exportDelay = renderingModal?.gift?.canExportAt
    ? Math.max(renderingModal.gift.canExportAt - getServerTime(), 0) : undefined;

  const handleClose = useLastCallback(() => {
    closeGiftWithdrawModal();
  });

  const handleSubmit = useLastCallback((password: string) => {
    processStarGiftWithdrawal({
      gift: renderingModal!.gift.inputGift!,
      password,
    });
  });

  return (
    <Modal
      isOpen={isOpen}
      title={lang('GiftWithdrawTitle')}
      hasCloseButton
      isSlim
      onClose={handleClose}
    >
      {giftAttributes && (
        <>
          <div className={styles.header}>
            <div className={styles.giftPreview}>
              <RadialPatternBackground
                className={styles.backdrop}
                backgroundColors={[giftAttributes.backdrop!.centerColor, giftAttributes.backdrop!.edgeColor]}
                patternColor={giftAttributes.backdrop?.patternColor}
                patternIcon={giftAttributes.pattern?.sticker}
              />
              <AnimatedIconFromSticker
                className={styles.sticker}
                size={GIFT_STICKER_SIZE}
                sticker={giftAttributes.model?.sticker}
              />
            </div>
            <Icon name="next" className={styles.arrow} />
            <Avatar
              peer={FRAGMENT_PEER}
              size="giant"
              className={styles.avatar}
            />
          </div>
          <p className={styles.description}>
            {lang('GiftWithdrawDescription', {
              gift: `${gift.title} #${gift.number}`,
            }, {
              withNodes: true,
              withMarkdown: true,
              renderTextFilters: ['br'],
            })}
          </p>
        </>
      )}
      {Boolean(exportDelay) && (
        <p className={styles.exportHint}>
          {lang('GiftWithdrawWait', { days: getDays(exportDelay) }, { pluralValue: getDays(exportDelay) })}
        </p>
      )}
      {!hasPassword && <span className={styles.noPassword}>{lang('ErrorPasswordMissing')}</span>}
      {hasPassword && !exportDelay && (
        <PasswordForm
          shouldShowSubmit
          placeholder={lang('CheckPasswordPlaceholder')}
          error={renderingModal?.errorKey && lang.withRegular(renderingModal?.errorKey)}
          description={lang('CheckPasswordDescription')}
          clearError={clearGiftWithdrawError}
          isLoading={renderingModal?.isLoading}
          hint={passwordHint}
          isPasswordVisible={shouldShowPassword}
          shouldResetValue={isOpen}
          onChangePasswordVisibility={setShouldShowPassword}
          submitLabel={lang('GiftWithdrawSubmit')}
          onSubmit={handleSubmit}
        />
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
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
      hasPassword,
      passwordHint,
    };
  },
)(GiftWithdrawModal));
