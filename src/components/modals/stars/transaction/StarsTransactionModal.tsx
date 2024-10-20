import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiPeer,
  ApiStarsTransactionPeer, ApiSticker, ApiUser,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import { MediaViewerOrigin } from '../../../../types';

import { getMessageLink, getUserFullName } from '../../../../global/helpers';
import { buildStarsTransactionCustomPeer, formatStarsTransactionAmount } from '../../../../global/helpers/payments';
import {
  selectCanPlayAnimatedEmojis,
  selectGiftStickerForStars,
  selectPeer, selectUser,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import renderText from '../../../common/helpers/renderText';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import usePrevious from '../../../../hooks/usePrevious';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import Icon from '../../../common/icons/Icon';
import StarIcon from '../../../common/icons/StarIcon';
import SafeLink from '../../../common/SafeLink';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';
import PaidMediaThumb from './PaidMediaThumb';

import styles from './StarsTransactionModal.module.scss';

import StarsBackground from '../../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['starsTransactionModal'];
};

type StateProps = {
  peer?: ApiPeer;
  user?: ApiUser;
  canPlayAnimatedEmojis?: boolean;
  starGiftSticker?: ApiSticker;
};

const StarsTransactionModal: FC<OwnProps & StateProps> = ({
  modal, peer, user, canPlayAnimatedEmojis, starGiftSticker,
}) => {
  const { showNotification, openMediaViewer, closeStarsTransactionModal } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();
  const { transaction } = modal || {};

  const handleOpenMedia = useLastCallback(() => {
    const media = transaction?.extendedMedia;
    if (!media) return;

    openMediaViewer({
      origin: MediaViewerOrigin.StarsTransaction,
      standaloneMedia: media.flatMap((item) => Object.values(item)),
    });
  });

  const giftEntryAboutText = useMemo(() => {
    const subtitleText = oldLang('lng_credits_box_history_entry_gift_in_about');
    const subtitleTextParts = subtitleText.split('{link}');

    return (
      <>
        {subtitleTextParts[0]}
        <SafeLink
          url={oldLang('lng_credits_box_history_entry_gift_about_url')}
          text={oldLang('GiftStarsSubtitleLinkName')}
        >
          {renderText(oldLang('GiftStarsSubtitleLinkName'), ['simple_markdown'])}
        </SafeLink>
        {subtitleTextParts[1]}
      </>
    );
  }, [oldLang]);

  const giftOutAboutText = useMemo(() => {
    return lang(
      'CreditsBoxHistoryEntryGiftOutAbout',
      {
        user: <strong>{user ? getUserFullName(user) : ''}</strong>,
        link: (
          <SafeLink
            url={oldLang('lng_credits_box_history_entry_gift_about_url')}
            text={oldLang('GiftStarsSubtitleLinkName')}
          >
            {renderText(oldLang('GiftStarsSubtitleLinkName'), ['simple_markdown'])}
          </SafeLink>
        ),
      },
      {
        withNodes: true,
      },
    );
  }, [lang, user, oldLang]);

  const starModalData = useMemo(() => {
    if (!transaction) {
      return undefined;
    }

    const { isGift, isPrizeStars, photo } = transaction;

    const customPeer = (transaction.peer && transaction.peer.type !== 'peer'
        && buildStarsTransactionCustomPeer(transaction.peer)) || undefined;

    const peerId = transaction.peer?.type === 'peer' ? transaction.peer.id : undefined;
    const toName = transaction.peer && oldLang(getStarsPeerTitleKey(transaction.peer));

    const title = (() => {
      if (transaction.extendedMedia) return oldLang('StarMediaPurchase');
      if (transaction.subscriptionPeriod) return oldLang('StarSubscriptionPurchase');
      if (transaction.isReaction) return oldLang('StarsReactionsSent');

      if (customPeer) return customPeer.title || oldLang(customPeer.titleKey!);

      return transaction.title;
    })();

    const messageLink = peer && transaction.messageId
      ? getMessageLink(peer, undefined, transaction.messageId) : undefined;

    const media = transaction.extendedMedia;

    const mediaAmount = media?.length || 0;
    const areAllPhotos = media?.every((m) => !m.video);
    const areAllVideos = media?.every((m) => !m.photo);

    const mediaText = areAllPhotos ? oldLang('Stars.Transfer.Photos', mediaAmount)
      : areAllVideos ? oldLang('Stars.Transfer.Videos', mediaAmount)
        : oldLang('Media', mediaAmount);

    const description = transaction.description || (media ? mediaText : undefined);

    const shouldDisplayAvatar = !media && !isGift && !isPrizeStars;
    const avatarPeer = !photo ? (peer || customPeer) : undefined;

    const header = (
      <div className={buildClassName(styles.header, styles.starsHeader)}>
        {media && (
          <PaidMediaThumb
            className={buildClassName(styles.mediaPreview, 'transaction-media-preview')}
            media={media}
            onClick={handleOpenMedia}
          />
        )}
        {(isGift || isPrizeStars) && starGiftSticker && (
          <AnimatedIconFromSticker
            key={transaction.id}
            sticker={starGiftSticker}
            play={canPlayAnimatedEmojis}
            noLoop
            nonInteractive
          />
        )}
        {shouldDisplayAvatar && (
          <Avatar peer={avatarPeer} webPhoto={photo} size="jumbo" />
        )}
        <img
          className={buildClassName(styles.starsBackground)}
          src={StarsBackground}
          alt=""
          draggable={false}
        />
        {title && <h1 className={styles.title}>{title}</h1>}
        {(isGift || isPrizeStars) && (
          <h1 className={buildClassName(styles.title, styles.starTitle)}>
            {isPrizeStars ? oldLang('StarsGiveawayPrizeReceived')
              : transaction?.isMyGift ? oldLang('StarsGiftSent') : oldLang('StarsGiftReceived')}
          </h1>
        )}
        <p className={styles.description}>{description}</p>
        <p className={styles.amount}>
          <span className={buildClassName(styles.amount, transaction.stars < 0 ? styles.negative : styles.positive)}>
            {formatStarsTransactionAmount(transaction.stars)}
          </span>
          <StarIcon type="gold" size="middle" />
        </p>
        {isGift && (
          <span className={styles.subtitle}>
            {transaction?.isMyGift ? giftOutAboutText : giftEntryAboutText}
          </span>
        )}
      </div>
    );

    const tableData: TableData = [];

    tableData.push([
      oldLang(transaction.stars < 0 || transaction.isMyGift ? 'Stars.Transaction.To'
        : peerId ? 'Star.Transaction.From' : 'Stars.Transaction.Via'),
      peerId ? { chatId: peerId } : toName || '',
    ]);

    if (messageLink) {
      tableData.push([oldLang('Stars.Transaction.Reaction.Post'), <SafeLink url={messageLink} text={messageLink} />]);
    }

    if (isPrizeStars) {
      tableData.push(
        [oldLang('BoostReason'), oldLang('Giveaway')],
        [oldLang('Gift'), oldLang('Stars', transaction.stars, 'i')],
      );
    }

    if (transaction.id && !isPrizeStars) {
      tableData.push([
        oldLang('Stars.Transaction.Id'),
        (
          <>
            <div
              className={styles.tid}
              onClick={() => {
                copyTextToClipboard(transaction.id!);
                showNotification({
                  message: oldLang('StarsTransactionIDCopied'),
                });
              }}
            >
              {transaction.id}
            </div>
            <Icon className={styles.copyIcon} name="copy" />
          </>
        ),
      ]);
    }

    tableData.push([
      oldLang('Stars.Transaction.Date'),
      formatDateTimeToString(transaction.date * 1000, oldLang.code, true),
    ]);

    const footerText = oldLang('lng_credits_box_out_about');
    const footerTextParts = footerText.split('{link}');

    const footer = (
      <span className={styles.footer}>
        {footerTextParts[0]}
        <SafeLink url={oldLang('StarsTOSLink')} text={oldLang('lng_credits_summary_options_about_link')} />
        {footerTextParts[1]}
      </span>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [
    transaction, oldLang, peer, giftOutAboutText, giftEntryAboutText, canPlayAnimatedEmojis, starGiftSticker,
  ]);

  const prevModalData = usePrevious(starModalData);
  const renderingModalData = prevModalData || starModalData;

  return (
    <TableInfoModal
      isOpen={Boolean(transaction)}
      className={styles.modal}
      header={renderingModalData?.header}
      tableData={renderingModalData?.tableData}
      footer={renderingModalData?.footer}
      buttonText={oldLang('OK')}
      onClose={closeStarsTransactionModal}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const peerId = modal?.transaction?.peer?.type === 'peer' && modal.transaction.peer.id;
    const peer = peerId ? selectPeer(global, peerId) : undefined;
    const user = peerId ? selectUser(global, peerId) : undefined;

    const starCount = modal?.transaction.stars;
    const starGiftSticker = selectGiftStickerForStars(global, starCount);

    return {
      peer,
      user,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      starGiftSticker,
    };
  },
)(StarsTransactionModal));

function getStarsPeerTitleKey(peer: ApiStarsTransactionPeer) {
  switch (peer.type) {
    case 'appStore':
      return 'AppStore';
    case 'playMarket':
      return 'PlayMarket';
    case 'fragment':
      return 'Fragment';
    case 'premiumBot':
      return 'StarsTransactionBot';
    case 'ads':
      return 'StarsTransactionAds';
    default:
      return 'Stars.Transaction.Unsupported.Title';
  }
}
