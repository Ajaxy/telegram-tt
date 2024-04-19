import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPremiumGiftOption, ApiUser } from '../../../api/types';

import { getUserFirstOrLastName } from '../../../global/helpers';
import {
  selectTabState,
  selectUser,
  selectUserFullInfo,
} from '../../../global/selectors';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import Modal from '../../ui/Modal';
import PremiumSubscriptionOption from './PremiumSubscriptionOption';

import styles from './GiftPremiumModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  user?: ApiUser;
  gifts?: ApiPremiumGiftOption[];
  monthlyCurrency?: string;
  monthlyAmount?: number;
};

const GiftPremiumModal: FC<OwnProps & StateProps> = ({
  isOpen,
  user,
  gifts,
}) => {
  const { openPremiumModal, closeGiftPremiumModal, openUrl } = getActions();

  const lang = useLang();
  const [selectedOption, setSelectedOption] = useState<number | undefined>();
  const fullMonthlyAmount = useMemo(() => {
    if (!gifts?.length) {
      return undefined;
    }

    const basicGift = gifts.reduce((acc, gift) => {
      return gift.months < acc.months ? gift : acc;
    });

    return Math.floor(basicGift.amount / basicGift.months);
  }, [gifts]);

  useEffect(() => {
    if (isOpen && gifts?.length) {
      setSelectedOption(gifts[0].months);
    }
  }, [gifts, isOpen]);

  const selectedGift = useMemo(() => {
    return gifts?.find((gift) => gift.months === selectedOption);
  }, [gifts, selectedOption]);

  const handleSubmit = useCallback(() => {
    if (!selectedGift) {
      return;
    }

    closeGiftPremiumModal();
    openUrl({ url: selectedGift.botUrl });
  }, [closeGiftPremiumModal, openUrl, selectedGift]);

  const handlePremiumClick = useCallback(() => {
    openPremiumModal();
  }, [openPremiumModal]);

  function renderPremiumFeaturesLink() {
    const info = lang('GiftPremiumListFeaturesAndTerms');
    // Translation hack for rendering component inside string
    const parts = info.match(/([^*]*)\*([^*]+)\*(.*)/);

    if (!parts || parts.length < 4) {
      return undefined;
    }

    return (
      <p className={styles.premiumFeatures}>
        {parts[1]}
        <Link isPrimary onClick={handlePremiumClick}>{parts[2]}</Link>
        {parts[3]}
      </p>
    );
  }

  return (
    <Modal
      onClose={closeGiftPremiumModal}
      isOpen={isOpen}
      className={styles.modalDialog}
    >
      <div className="custom-scroll">
        <Button
          round
          size="smaller"
          className={styles.closeButton}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => closeGiftPremiumModal()}
          ariaLabel={lang('Close')}
        >
          <i className="icon icon-close" />
        </Button>
        <Avatar
          peer={user}
          size="jumbo"
          className={styles.avatar}
        />
        <h2 className={styles.headerText}>
          {lang('GiftTelegramPremiumTitle')}
        </h2>
        <p className={styles.description}>
          {renderText(
            lang('GiftTelegramPremiumDescription', getUserFirstOrLastName(user)),
            ['emoji', 'simple_markdown'],
          )}
        </p>

        <div className={styles.options}>
          {gifts?.map((gift) => (
            <PremiumSubscriptionOption
              key={gift.amount}
              option={gift}
              fullMonthlyAmount={fullMonthlyAmount}
              checked={gift.months === selectedOption}
              onChange={setSelectedOption}
            />
          ))}
        </div>

        {renderPremiumFeaturesLink()}
      </div>

      <Button className={styles.button} isShiny disabled={!selectedOption} onClick={handleSubmit}>
        {lang(
          'GiftSubscriptionFor',
          selectedGift && formatCurrency(Number(selectedGift.amount), selectedGift.currency, lang.code),
        )}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { forUserId } = selectTabState(global).giftPremiumModal || {};
  const user = forUserId ? selectUser(global, forUserId) : undefined;
  const gifts = user ? selectUserFullInfo(global, user.id)?.premiumGifts : undefined;

  return {
    user,
    gifts,
  };
})(GiftPremiumModal));
