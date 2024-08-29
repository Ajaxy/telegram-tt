import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiStarTopupOption, ApiUser,
} from '../../../api/types';

import { getSenderTitle } from '../../../global/helpers';
import {
  selectTabState, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import SafeLink from '../../common/SafeLink';
import StarTopupOptionList from '../../modals/stars/StarTopupOptionList';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './StarsGiftModal.module.scss';

import StarLogo from '../../../assets/icons/StarLogo.svg';
import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  isCompleted?: boolean;
  starsGiftOptions?: ApiStarTopupOption[] | undefined;
  forUserId?: string;
  user?: ApiUser;
};

const StarsGiftModal: FC<OwnProps & StateProps> = ({
  isOpen,
  isCompleted,
  starsGiftOptions,
  forUserId,
  user,
}) => {
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    closeStarsGiftModal, openInvoice, requestConfetti,
  } = getActions();

  const oldLang = useOldLang();

  const [selectedOption, setSelectedOption] = useState<ApiStarTopupOption | undefined>();
  const [isHeaderHidden, setHeaderHidden] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setHeaderHidden(true);
    }
  }, [isOpen]);

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
        withStars: true,
      });
    }
  });

  useEffect(() => {
    if (isCompleted) {
      showConfetti();
    }
  }, [isCompleted, showConfetti]);

  const handleClick = useLastCallback((option: ApiStarTopupOption) => {
    setSelectedOption(option);
    if (user) {
      openInvoice({
        type: 'starsgift',
        userId: forUserId!,
        stars: option.stars,
        currency: option.currency,
        amount: option.amount,
      });
    } else {
      openInvoice({
        type: 'stars',
        stars: option.stars,
        currency: option.currency,
        amount: option.amount,
      });
    }
  });

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  function renderGiftTitle() {
    if (isCompleted) {
      return user ? renderText(oldLang('Notification.StarsGift.SentYou',
        formatCurrencyAsString(selectedOption!.amount, selectedOption!.currency, oldLang.code)), ['simple_markdown'])
        : renderText(oldLang('StarsAcquiredInfo', selectedOption?.stars), ['simple_markdown']);
    }

    return user ? oldLang('GiftStarsTitle') : oldLang('Star.List.GetStars');
  }

  function renderStarOptionList() {
    return (
      <StarTopupOptionList
        options={starsGiftOptions}
        onClick={handleClick}
      />
    );
  }

  const bottomText = useMemo(() => {
    if (!isOpen) return undefined;

    const text = oldLang('lng_credits_summary_options_about');
    const parts = text.split('{link}');
    return [
      parts[0],
      <SafeLink url={oldLang('StarsTOSLink')} text={oldLang('lng_credits_summary_options_about_link')} />,
      parts[1],
    ];
  }, [isOpen, oldLang]);

  return (
    <Modal
      dialogRef={dialogRef}
      onClose={closeStarsGiftModal}
      isOpen={isOpen}
      className={buildClassName(styles.modalDialog, styles.root)}
    >
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        <Button
          round
          size="smaller"
          className={styles.closeButton}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => closeStarsGiftModal()}
          ariaLabel={oldLang('Close')}
        >
          <i className="icon icon-close" />
        </Button>
        <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
          <h2 className={styles.starHeaderText}>
            {user ? oldLang('GiftStarsTitle') : oldLang('Star.List.GetStars')}
          </h2>
        </div>
        <div className={styles.headerInfo}>
          {user ? (
            <>
              <Avatar
                size="huge"
                peer={user}
                className={styles.avatar}
              />
              <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />
            </>
          ) : (
            <>
              <img className={styles.logo} src={StarLogo} alt="" draggable={false} />
              <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />
            </>
          )}
        </div>
        <h2 className={buildClassName(styles.headerText, styles.center)}>
          {renderGiftTitle()}
        </h2>
        <p className={styles.description}>
          {user ? renderText(
            oldLang('ActionGiftStarsSubtitle', getSenderTitle(oldLang, user)), ['simple_markdown'],
          ) : oldLang('Stars.Purchase.GetStarsInfo')}
        </p>
        <div className={styles.section}>
          {renderStarOptionList()}
          <div className={styles.secondaryInfo}>
            {bottomText}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    starsGiftOptions, forUserId, isCompleted,
  } = selectTabState(global).starsGiftModal || {};

  const user = forUserId ? selectUser(getGlobal(), forUserId) : undefined;

  return {
    isCompleted,
    starsGiftOptions,
    forUserId,
    user,
  };
})(StarsGiftModal));
