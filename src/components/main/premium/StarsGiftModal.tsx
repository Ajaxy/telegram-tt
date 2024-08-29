import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiStarsGiftOption, ApiStarTopupOption, ApiUser,
} from '../../../api/types';

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

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  isCompleted?: boolean;
  starsGiftOptions?: ApiStarsGiftOption[] | undefined;
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
    openInvoice({
      type: 'starsgift',
      userId: forUserId!,
      stars: option.stars,
      currency: option.currency,
      amount: option.amount,
    });
  });

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  function renderGiftTitle() {
    if (isCompleted) {
      return renderText(oldLang('Notification.StarsGift.SentYou',
        formatCurrencyAsString(selectedOption!.amount, selectedOption!.currency, oldLang.code)), ['simple_markdown']);
    }

    return oldLang('GiftStarsTitle');
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
            {oldLang('GiftStarsTitle')}
          </h2>
        </div>
        <div className={styles.avatars}>
          <Avatar
            size="large"
            peer={user}
          />
        </div>
        <h2 className={buildClassName(styles.headerText, styles.center)}>
          {renderGiftTitle()}
        </h2>
        {!isCompleted && (
          <>
            <div className={buildClassName(styles.section, styles.options)}>
              {renderStarOptionList()}
            </div>
            <div className={styles.secondaryInfo}>
              {bottomText}
            </div>
          </>
        )}
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
