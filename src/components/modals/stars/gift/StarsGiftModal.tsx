import {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiStarTopupOption, ApiUser,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import {
  selectUser,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatCurrencyAsString } from '../../../../util/formatCurrency';
import renderText from '../../../common/helpers/renderText';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Avatar from '../../../common/Avatar';
import SafeLink from '../../../common/SafeLink';
import Modal from '../../../ui/Modal';
import StarTopupOptionList from '../StarTopupOptionList';

import styles from './StarsGiftModal.module.scss';

import StarLogo from '../../../../assets/icons/star/GoldStar.svg';
import StarsBackground from '../../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['starsGiftModal'];
};

type StateProps = {
  user?: ApiUser;
};

const AVATAR_SIZE = 100;

const StarsGiftModal = ({
  modal,
  user,
}: OwnProps & StateProps) => {
  const {
    closeStarsGiftModal, openInvoice, requestConfetti,
  } = getActions();
  const dialogRef = useRef<HTMLDivElement>();

  const isOpen = Boolean(modal?.isOpen);

  const renderingModal = useCurrentOrPrev(modal);

  const lang = useLang();

  const [selectedOption, setSelectedOption] = useState<ApiStarTopupOption | undefined>();
  const [isHeaderHidden, setIsHeaderHidden] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setIsHeaderHidden(true);
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

    setIsHeaderHidden(scrollTop <= 150);
  }

  const handleClose = useLastCallback(() => {
    closeStarsGiftModal();
  });

  function renderGiftTitle() {
    if (renderingModal?.isCompleted) {
      return user ? renderText(
        lang(
          'NotificationStarsGiftSentYou',
          { amount: formatCurrencyAsString(selectedOption!.amount, selectedOption!.currency, lang.code) },
        ),
        ['simple_markdown'],
      )
        : renderText(
          lang('StarsAcquiredInfo', { count: selectedOption!.stars }, { pluralValue: selectedOption!.stars }),
          ['simple_markdown'],
        );
    }

    return user ? lang('GiftStarsTitle') : lang('StarListGetStars');
  }

  const bottomText = useMemo(() => {
    return lang('CreditsSummaryOptionsAbout', {
      link: <SafeLink url={lang('StarsTOSLink')} text={lang('CreditsSummaryOptionsAboutLink')} />,
    }, { withNodes: true });
  }, [lang]);

  return (
    <Modal
      className={buildClassName(styles.modalDialog)}
      contentClassName={styles.content}
      dialogRef={dialogRef}
      isSlim
      onClose={handleClose}
      isOpen={isOpen}
      hasAbsoluteCloseButton
    >
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
          <h2 className={styles.starHeaderText}>
            {user ? lang('GiftStarsTitle') : lang('StarListGetStars')}
          </h2>
        </div>
        <div className={styles.headerInfo}>
          {user ? (
            <>
              <Avatar
                size={AVATAR_SIZE}
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
            lang('ActionGiftStarsSubtitle', { peer: getPeerTitle(lang, user) }), ['simple_markdown'],
          ) : lang('StarsPurchaseGetStarsInfo')}
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

export default memo(withGlobal<OwnProps>((global, { modal }): Complete<StateProps> => {
  const user = modal?.forUserId ? selectUser(global, modal.forUserId) : undefined;

  return {
    user,
  };
})(StarsGiftModal));
