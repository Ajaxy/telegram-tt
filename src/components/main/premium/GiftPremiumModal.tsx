import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiPremiumGiftCodeOption,
} from '../../../api/types';

import { BOOST_PER_SENT_GIFT } from '../../../config';
import { getUserFullName } from '../../../global/helpers';
import {
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AvatarList from '../../common/AvatarList';
import Icon from '../../common/Icon';
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import Modal from '../../ui/Modal';
import PremiumSubscriptionOption from './PremiumSubscriptionOption';

import styles from './GiftPremiumModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  isCompleted?: boolean;
  gifts?: ApiPremiumGiftCodeOption[] | undefined;
  forUserIds?: string[];
  boostPerSentGift?: number;
};

const GiftPremiumModal: FC<OwnProps & StateProps> = ({
  isOpen,
  isCompleted,
  gifts,
  boostPerSentGift = BOOST_PER_SENT_GIFT,
  forUserIds,
}) => {
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    openPremiumModal, closeGiftPremiumModal, openInvoice, requestConfetti,
  } = getActions();

  const lang = useLang();
  const [selectedMonthOption, setSelectedMonthOption] = useState<number | undefined>();

  const selectedUserQuantity = forUserIds && forUserIds.length * boostPerSentGift;

  useEffect(() => {
    if (forUserIds?.length) {
      setSelectedMonthOption(gifts?.[0].months);
    }
  }, [gifts, forUserIds]);

  const giftingUserList = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return forUserIds?.map((userId) => usersById[userId]).filter(Boolean);
  }, [forUserIds]);

  const selectedGift = useMemo(() => {
    return gifts?.find((gift) => gift.months === selectedMonthOption && gift.users === forUserIds?.length);
  }, [gifts, selectedMonthOption, forUserIds?.length]);

  const filteredGifts = useMemo(() => {
    return gifts?.filter((gift) => gift.users
      === forUserIds?.length);
  }, [gifts, forUserIds?.length]);

  const fullMonthlyGiftAmount = useMemo(() => {
    if (!filteredGifts?.length) {
      return undefined;
    }

    const basicGift = filteredGifts.reduce((acc, gift) => {
      return gift.amount < acc.amount ? gift : acc;
    });

    return Math.floor(basicGift.amount / basicGift.months);
  }, [filteredGifts]);

  const handleSubmit = useLastCallback(() => {
    if (!selectedGift) {
      return;
    }

    openInvoice({
      type: 'giftcode',
      userIds: forUserIds!,
      currency: selectedGift!.currency,
      amount: selectedGift!.amount,
      option: selectedGift!,
    });
  });

  const handlePremiumClick = useLastCallback(() => {
    openPremiumModal();
  });

  const showConfetti = useLastCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      const {
        top, left, width, height,
      } = dialog.querySelector('.modal-content')!.getBoundingClientRect();
      requestConfetti({
        top,
        left,
        width,
        height,
      });
    }
  });

  useEffect(() => {
    if (isCompleted) {
      showConfetti();
    }
  }, [isCompleted, showConfetti]);

  const userNameList = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return forUserIds?.map((userId) => getUserFullName(usersById[userId])).join(', ');
  }, [forUserIds]);

  function renderGiftTitle() {
    if (isCompleted) {
      return renderText(lang('TelegramPremiumUserGiftedPremiumOutboundDialogTitle',
        [userNameList, selectedGift?.months]), ['simple_markdown']);
    }

    return lang('GiftTelegramPremiumTitle');
  }

  function renderGiftText() {
    if (isCompleted) {
      return renderText(lang('TelegramPremiumUserGiftedPremiumOutboundDialogSubtitle', userNameList),
        ['simple_markdown']);
    }
    return renderText(lang('GiftPremiumUsersGiveAccessManyZero', userNameList), ['simple_markdown']);
  }

  function renderPremiumFeaturesLink() {
    const info = lang('GiftPremiumListFeaturesAndTerms');
    // Translation hack for rendering component inside string
    const parts = info.match(/([^*]*)\*([^*]+)\*(.*)/);

    if (!parts || parts.length < 4) {
      return undefined;
    }

    return (
      <p className={buildClassName(styles.premiumFeatures, styles.center)}>
        {parts[1]}
        <Link isPrimary onClick={handlePremiumClick}>{parts[2]}</Link>
        {parts[3]}
      </p>
    );
  }

  function renderBoostsPluralText() {
    const giftParts = renderText(lang('GiftPremiumWillReceiveBoostsPlural', selectedUserQuantity), ['simple_markdown']);
    return giftParts.map((part) => {
      if (typeof part === 'string') {
        return part.split(/(⚡)/g).map((subpart) => {
          if (subpart === '⚡') {
            return <Icon name="boost" className={styles.boostIcon} />;
          }
          return subpart;
        });
      }
      return part;
    });
  }

  function renderSubscriptionGiftOptions() {
    return (
      <div className={styles.subscriptionOptions}>
        {filteredGifts?.map((gift) => {
          return (
            <PremiumSubscriptionOption
              className={styles.subscriptionOption}
              key={gift.months}
              option={gift}
              fullMonthlyAmount={fullMonthlyGiftAmount}
              checked={gift.months === selectedMonthOption}
              onChange={setSelectedMonthOption}
            />
          );
        })}
      </div>
    );
  }

  return (
    <Modal
      dialogRef={dialogRef}
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
        <div className={styles.avatars}>
          <AvatarList
            size="large"
            peers={giftingUserList}
          />
        </div>
        <h2 className={buildClassName(styles.headerText, styles.center)}>
          {renderGiftTitle()}
        </h2>
        <p className={buildClassName(styles.description, styles.center)}>
          {renderGiftText()}
        </p>
        {!isCompleted && (
          <>
            <p className={styles.description}>
              {renderText(renderBoostsPluralText(), ['simple_markdown', 'emoji'])}
            </p>

            <div className={styles.options}>
              {renderSubscriptionGiftOptions()}
            </div>
          </>
        )}
        {renderPremiumFeaturesLink()}
      </div>

      {!isCompleted && (
        <Button withPremiumGradient className={styles.button} isShiny disabled={!selectedGift} onClick={handleSubmit}>
          {lang(
            'GiftSubscriptionFor', selectedGift
            && formatCurrency(selectedGift!.amount, selectedGift.currency, lang.code),
          )}
        </Button>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    gifts, forUserIds, isCompleted,
  } = selectTabState(global).giftPremiumModal || {};

  return {
    isCompleted,
    gifts,
    boostPerSentGift: global.appConfig?.boostsPerSentGift,
    forUserIds,
  };
})(GiftPremiumModal));
