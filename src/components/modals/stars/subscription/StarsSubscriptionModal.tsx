import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiPeer,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { STARS_ICON_PLACEHOLDER } from '../../../../config';
import {
  selectPeer,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import usePrevious from '../../../../hooks/usePrevious';

import Avatar from '../../../common/Avatar';
import StarIcon from '../../../common/icons/StarIcon';
import SafeLink from '../../../common/SafeLink';
import Button from '../../../ui/Button';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';

import styles from './StarsSubscriptionModal.module.scss';

import StarsBackground from '../../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['starsSubscriptionModal'];
};

type StateProps = {
  peer?: ApiPeer;
};

const StarsSubscriptionModal: FC<OwnProps & StateProps> = ({
  modal, peer,
}) => {
  const {
    closeStarsSubscriptionModal,
    fulfillStarsSubscription,
    changeStarsSubscription,
    checkChatInvite,
    loadStarStatus,
  } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();
  const { subscription } = modal || {};

  const buttonState = useMemo(() => {
    if (!subscription) {
      return 'hidden';
    }

    if (subscription.canRefulfill) {
      return 'refulfill';
    }

    const isActive = subscription.until > Date.now() / 1000;
    if (isActive && !subscription.isCancelled) {
      return 'cancel';
    }

    if (isActive && subscription.isCancelled) {
      return 'renew';
    }

    if (!isActive) {
      return 'restart';
    }

    return 'ok';
  }, [subscription]);

  const handleButtonClick = useLastCallback(() => {
    if (!subscription) {
      return;
    }

    switch (buttonState) {
      case 'refulfill': {
        fulfillStarsSubscription({ id: subscription.id });
        break;
      }
      case 'restart': {
        checkChatInvite({ hash: subscription.chatInviteHash! });
        loadStarStatus();
        break;
      }
      case 'renew': {
        changeStarsSubscription({ id: subscription.id, isCancelled: false });
        break;
      }
      case 'cancel': {
        changeStarsSubscription({ id: subscription.id, isCancelled: true });
        break;
      }
    }
    closeStarsSubscriptionModal();
  });

  const starModalData = useMemo(() => {
    if (!subscription || !peer) {
      return undefined;
    }

    const {
      pricing, until, isCancelled, canRefulfill,
    } = subscription;

    const header = (
      <div className={buildClassName(styles.header, styles.starsHeader)}>
        <div className={styles.avatarWrapper}>
          <Avatar peer={peer} size="jumbo" />
          <StarIcon className={styles.subscriptionStar} type="gold" size="adaptive" />
        </div>
        <img
          className={buildClassName(styles.starsBackground)}
          src={StarsBackground}
          alt=""
          draggable={false}
        />
        <h1 className={styles.title}>{oldLang('StarsSubscriptionTitle')}</h1>
        <p className={styles.amount}>
          {lang('StarsPerMonth', {
            amount: pricing.amount,
          }, {
            withNodes: true,
            specialReplacement: {
              [STARS_ICON_PLACEHOLDER]: <StarIcon className={styles.amountStar} size="adaptive" type="gold" />,
            },
          })}
        </p>
      </div>
    );

    const tableData: TableData = [];

    tableData.push([
      oldLang('StarsSubscriptionChannel'),
      { chatId: peer.id },
    ]);

    const hasExpired = until < Date.now() / 1000;
    tableData.push([
      oldLang(hasExpired ? 'StarsSubscriptionUntilExpired'
        : isCancelled ? 'StarsSubscriptionUntilExpires' : 'StarsSubscriptionUntilRenews'),
      formatDateTimeToString(until * 1000, oldLang.code, true),
    ]);

    const footerTos = lang('StarsTransactionTOS', {
      link: <SafeLink url={lang('StarsTransactionTOSLink')} text={lang('StarsTransactionTOSLinkText')} />,
    }, {
      withNodes: true,
    });

    const footer = (
      <span className={styles.footer}>
        <p className={styles.secondary}>{footerTos}</p>
        {isCancelled && (
          <p className={styles.danger}>{oldLang('StarsSubscriptionCancelledText')}</p>
        )}
        {canRefulfill && (
          <p className={styles.secondary}>
            {oldLang('StarsSubscriptionRefulfillInfo', formatDateTimeToString(until * 1000, oldLang.code, true))}
          </p>
        )}
        {!isCancelled && !canRefulfill && hasExpired && (
          <p className={styles.secondary}>
            {oldLang('StarsSubscriptionExpiredInfo', formatDateTimeToString(until * 1000, oldLang.code, true))}
          </p>
        )}
        {!isCancelled && !canRefulfill && !hasExpired && (
          <p className={styles.secondary}>
            {oldLang('StarsSubscriptionCancelInfo', formatDateTimeToString(until * 1000, oldLang.code, true))}
          </p>
        )}
        {buttonState !== 'hidden' && (
          <Button
            size="smaller"
            color={buttonState === 'cancel' ? 'danger' : 'primary'}
            isText={buttonState === 'cancel'}
            onClick={handleButtonClick}
          >
            {oldLang(
              buttonState === 'cancel' ? 'StarsSubscriptionCancel'
                : buttonState === 'refulfill' ? 'StarsSubscriptionRefulfill'
                  : buttonState === 'restart' ? 'StarsSubscriptionAgain'
                    : buttonState === 'renew' ? 'StarsSubscriptionRenew' : 'OK',
            )}
          </Button>
        )}
      </span>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [buttonState, lang, oldLang, peer, subscription]);

  const prevModalData = usePrevious(starModalData);
  const renderingModalData = prevModalData || starModalData;

  return (
    <TableInfoModal
      isOpen={Boolean(subscription)}
      className={styles.modal}
      header={renderingModalData?.header}
      tableData={renderingModalData?.tableData}
      footer={renderingModalData?.footer}
      onClose={closeStarsSubscriptionModal}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const peerId = modal?.subscription.peerId;
    const peer = peerId ? selectPeer(global, peerId) : undefined;

    return {
      peer,
    };
  },
)(StarsSubscriptionModal));
