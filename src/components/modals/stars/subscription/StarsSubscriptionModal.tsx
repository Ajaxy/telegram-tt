import { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiPeer,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { STARS_ICON_PLACEHOLDER } from '../../../../config';
import { isApiPeerUser } from '../../../../global/helpers/peers';
import {
  selectPeer,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatDateTime, secondsToDate } from '../../../../util/localization/dateFormat';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePrevious from '../../../../hooks/usePrevious';

import Avatar from '../../../common/Avatar';
import StarIcon from '../../../common/icons/StarIcon';
import InteractiveSparkles from '../../../common/InteractiveSparkles';
import SafeLink from '../../../common/SafeLink';
import Button from '../../../ui/Button';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';

import styles from './StarsSubscriptionModal.module.scss';

export type OwnProps = {
  modal: TabState['starsSubscriptionModal'];
};

type StateProps = {
  peer?: ApiPeer;
};

const AVATAR_SPARKLES_CENTER_SHIFT = [0, -50] as const;

const StarsSubscriptionModal = ({
  modal, peer,
}: OwnProps & StateProps) => {
  const {
    closeStarsSubscriptionModal,
    fulfillStarsSubscription,
    changeStarsSubscription,
    checkChatInvite,
    loadStarStatus,
    openInvoice,
  } = getActions();

  const lang = useLang();
  const { subscription } = modal || {};
  const triggerSparklesRef = useRef<(() => void) | undefined>();

  const handleAvatarMouseMove = useLastCallback(() => {
    triggerSparklesRef.current?.();
  });

  const handleRequestAnimation = useLastCallback((animate: NoneToVoidFunction) => {
    triggerSparklesRef.current = animate;
  });

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

    const canRestart = subscription.chatInviteHash || subscription.invoiceSlug;
    if (!isActive && canRestart) {
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
        if (subscription.chatInviteHash) {
          checkChatInvite({ hash: subscription.chatInviteHash });
        } else if (subscription.invoiceSlug) {
          openInvoice({
            type: 'slug',
            slug: subscription.invoiceSlug,
          });
        }
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
      pricing, until, isCancelled, canRefulfill, photo, title, hasBotCancelled,
    } = subscription;

    const isBotSubscription = isApiPeerUser(peer);

    const header = (
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          <Avatar
            peer={!photo ? peer : undefined}
            webPhoto={photo}
            size="giant"
            onMouseMove={handleAvatarMouseMove}
          />
          <StarIcon className={styles.subscriptionStar} type="gold" size="adaptive" />
        </div>
        <InteractiveSparkles
          className={buildClassName(styles.starsBackground)}
          color="gold"
          onRequestAnimation={handleRequestAnimation}
          centerShift={AVATAR_SPARKLES_CENTER_SHIFT}
        />
        <h1 className={styles.title}>{title || lang('StarsSubscriptionTitle')}</h1>
        <span className={styles.amount}>
          {lang('StarsPerMonth', {
            amount: pricing.amount,
          }, {
            withNodes: true,
            specialReplacement: {
              [STARS_ICON_PLACEHOLDER]: <StarIcon size="adaptive" type="gold" />,
            },
          })}
        </span>
      </div>
    );

    const tableData: TableData = [];

    tableData.push([
      lang(isBotSubscription ? 'Bot' : 'StarsSubscriptionChannel'),
      { chatId: peer.id },
    ]);

    if (title) {
      tableData.push([
        lang('StarsSubscriptionBotProduct'),
        title,
      ]);
    }

    const hasExpired = until < Date.now() / 1000;
    tableData.push([
      lang(hasExpired
        ? 'InviteLinkExpired'
        : isCancelled ? 'StarsSubscriptionUntilExpires' : 'StarsSubscriptionUntilRenews'),
      formatDateTime(lang, secondsToDate(until), { date: 'short', time: 'short' }),
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
          <p className={styles.danger}>
            {lang(hasBotCancelled ? 'StarsSubscriptionBotCancelledText' : 'StarsSubscriptionCancelledText')}
          </p>
        )}
        {canRefulfill && (
          <p className={styles.secondary}>
            {lang(
              'StarsSubscriptionRefulfillInfo',
              { date: formatDateTime(lang, secondsToDate(until), { date: 'short', time: 'short' }) },
            )}
          </p>
        )}
        {!isCancelled && !canRefulfill && hasExpired && (
          <p className={styles.secondary}>
            {lang(
              'StarsSubscriptionExpiredInfo',
              { date: formatDateTime(lang, secondsToDate(until), { date: 'short', time: 'short' }) },
            )}
          </p>
        )}
        {!isCancelled && !canRefulfill && !hasExpired && (
          <p className={styles.secondary}>
            {lang(
              'StarsSubscriptionCancelInfo',
              { date: formatDateTime(lang, secondsToDate(until), { date: 'short', time: 'short' }) },
            )}
          </p>
        )}
        {buttonState !== 'hidden' && (
          <Button
            color={buttonState === 'cancel' ? 'danger' : 'primary'}
            isText={buttonState === 'cancel'}
            onClick={handleButtonClick}
          >
            {lang(buttonState === 'cancel'
              ? 'StarsSubscriptionCancel'
              : buttonState === 'refulfill'
                ? 'ProfileJoinChannel'
                : buttonState === 'restart'
                  ? 'StarsSubscriptionAgain'
                  : buttonState === 'renew' ? 'StarsSubscriptionRenew' : 'OK')}
          </Button>
        )}
      </span>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [buttonState, lang, peer, subscription]);

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
  (global, { modal }): Complete<StateProps> => {
    const peerId = modal?.subscription.peerId;
    const peer = peerId ? selectPeer(global, peerId) : undefined;

    return {
      peer,
    };
  },
)(StarsSubscriptionModal));
