import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  ApiStarTopupOption, ApiUser,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getSenderTitle } from '../../../../global/helpers';
import {
  selectUser,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatCurrencyAsString } from '../../../../util/formatCurrency';
import renderText from '../../../common/helpers/renderText';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import Avatar from '../../../common/Avatar';
import SafeLink from '../../../common/SafeLink';
import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import StarTopupOptionList from '../StarTopupOptionList';

import styles from './StarsGiftModal.module.scss';

import StarLogo from '../../../../assets/icons/StarLogo.svg';
import StarsBackground from '../../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['starsGiftModal'];
};

type StateProps = {
  user?: ApiUser;
};

const StarsGiftModal: FC<OwnProps & StateProps> = ({
  modal,
  user,
}) => {
  const {
    closeStarsGiftModal, openInvoice, requestConfetti,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);

  const isOpen = Boolean(modal?.isOpen);

  const renderingModal = useCurrentOrPrev(modal);

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
    if (renderingModal?.isCompleted) {
      showConfetti();
    }
  }, [renderingModal, showConfetti]);

  const handleClick = useLastCallback((option: ApiStarTopupOption) => {
    if (!renderingModal) return;

    setSelectedOption(option);
    if (user) {
      openInvoice({
        type: 'starsgift',
        userId: user.id,
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

  const handleClose = useLastCallback(() => {
    closeStarsGiftModal();
  });

  function renderGiftTitle() {
    if (renderingModal?.isCompleted) {
      return user ? renderText(oldLang('Notification.StarsGift.SentYou',
        formatCurrencyAsString(selectedOption!.amount, selectedOption!.currency, oldLang.code)), ['simple_markdown'])
        : renderText(oldLang('StarsAcquiredInfo', selectedOption?.stars), ['simple_markdown']);
    }

    return user ? oldLang('GiftStarsTitle') : oldLang('Star.List.GetStars');
  }

  const bottomText = useMemo(() => {
    const text = oldLang('lng_credits_summary_options_about');
    const parts = text.split('{link}');
    return [
      parts[0],
      <SafeLink url={oldLang('StarsTOSLink')} text={oldLang('lng_credits_summary_options_about_link')} />,
      parts[1],
    ];
  }, [oldLang]);

  return (
    <Modal
      className={buildClassName(styles.modalDialog, styles.root)}
      dialogRef={dialogRef}
      isSlim
      onClose={handleClose}
      isOpen={isOpen}
    >
      <div className={styles.main} onScroll={handleScroll}>
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
          <StarTopupOptionList
            options={renderingModal?.starsGiftOptions}
            onClick={handleClick}
          />
          <div className={styles.secondaryInfo}>
            {bottomText}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global, { modal }): StateProps => {
  const user = modal?.forUserId ? selectUser(getGlobal(), modal.forUserId) : undefined;

  return {
    user,
  };
})(StarsGiftModal));
