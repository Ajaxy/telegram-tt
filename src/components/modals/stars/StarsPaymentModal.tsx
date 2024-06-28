import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectTabState, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import StarIcon from '../../common/icons/StarIcon';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import BalanceBlock from './BalanceBlock';

import styles from './StarsBalanceModal.module.scss';

import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['isStarPaymentModalOpen'];
};

type StateProps = {
  payment?: TabState['payment'];
  starsBalanceState?: GlobalState['stars'];
  bot?: ApiUser;
};

const StarPaymentModal = ({
  modal, bot, starsBalanceState, payment,
}: OwnProps & StateProps) => {
  const { closePaymentModal, openStarsBalanceModal, sendStarPaymentForm } = getActions();
  const [isLoading, markLoading, unmarkLoading] = useFlag();
  const isOpen = Boolean(modal && starsBalanceState);

  const photo = payment?.invoice?.photo;

  const lang = useOldLang();

  useEffect(() => {
    if (!isOpen) {
      unmarkLoading();
    }
  }, [isOpen]);

  const descriptionText = useMemo(() => {
    if (!payment?.invoice) {
      return '';
    }

    const botName = getUserFullName(bot);
    const starsText = lang('Stars.Intro.PurchasedText.Stars', payment.invoice.amount);

    return lang('Stars.Transfer.Info', [payment.invoice.title, botName, starsText]);
  }, [bot, payment, lang]);

  const handlePayment = useLastCallback(() => {
    const price = payment?.invoice?.amount;
    const balance = starsBalanceState?.balance;
    if (price === undefined || balance === undefined) {
      return;
    }

    if (price > balance) {
      openStarsBalanceModal({
        originPayment: payment,
      });
      return;
    }

    sendStarPaymentForm();
    markLoading();
  });

  return (
    <Modal
      contentClassName={styles.paymentContent}
      isOpen={isOpen}
      hasAbsoluteCloseButton
      isSlim
      onClose={closePaymentModal}
    >
      <BalanceBlock balance={starsBalanceState?.balance || 0} className={styles.modalBalance} />
      <div className={styles.paymentImages} dir={lang.isRtl ? 'ltr' : 'rtl'}>
        <Avatar peer={bot} size="giant" />
        {photo && <Avatar className={styles.paymentPhoto} webPhoto={photo} size="giant" />}
        <img className={styles.paymentImageBackground} src={StarsBackground} alt="" draggable={false} />
      </div>
      <h2 className={styles.headerText}>
        {lang('StarsConfirmPurchaseTitle')}
      </h2>
      <div className={buildClassName(styles.description, styles.smallerText)}>
        {renderText(descriptionText, ['simple_markdown', 'emoji'])}
      </div>
      <Button className={styles.paymentButton} size="smaller" onClick={handlePayment} isLoading={isLoading}>
        {lang('Stars.Transfer.Pay')}
        <div className={styles.paymentAmount}>
          {payment?.invoice?.amount}
          <StarIcon className={styles.paymentButtonStar} size="small" />
        </div>
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const payment = selectTabState(global).payment;
    const bot = payment?.botId ? selectUser(global, payment.botId) : undefined;
    return {
      bot,
      starsBalanceState: global.stars,
      payment,
    };
  },
)(StarPaymentModal));
