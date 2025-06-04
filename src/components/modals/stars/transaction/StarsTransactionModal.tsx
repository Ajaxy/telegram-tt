import type { FC } from '../../../../lib/teact/teact';
import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiPeer,
  ApiStarsTransactionPeer, ApiSticker,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import { MediaViewerOrigin } from '../../../../types';

import { getMessageLink } from '../../../../global/helpers';
import {
  buildStarsTransactionCustomPeer,
  formatStarsTransactionAmount,
} from '../../../../global/helpers/payments';
import {
  selectCanPlayAnimatedEmojis,
  selectGiftStickerForStars,
  selectPeer,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import { formatPercent } from '../../../../util/textFormat';
import { getGiftAttributes, getStickerFromGift } from '../../../common/helpers/gifts';
import { getTransactionTitle, isNegativeStarsAmount } from '../helpers/transaction';

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
import UniqueGiftHeader from '../../gift/UniqueGiftHeader';
import PaidMediaThumb from './PaidMediaThumb';

import styles from './StarsTransactionModal.module.scss';

import StarsBackground from '../../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['starsTransactionModal'];
};

type StateProps = {
  peer?: ApiPeer;
  canPlayAnimatedEmojis?: boolean;
  topSticker?: ApiSticker;
  paidMessageCommission?: number;
};

const StarsTransactionModal: FC<OwnProps & StateProps> = ({
  modal,
  peer,
  canPlayAnimatedEmojis,
  topSticker,
  paidMessageCommission,
}) => {
  const { showNotification, openMediaViewer, closeStarsTransactionModal } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();
  const { transaction } = modal || {};

  const handleOpenMedia = useLastCallback(() => {
    const media = transaction?.extendedMedia;
    if (!media) return;

    openMediaViewer({
      origin: MediaViewerOrigin.StarsTransaction,
      standaloneMedia: media.flatMap((item) => Object.values(item)),
    });
  });

  const starModalData = useMemo(() => {
    if (!transaction) {
      return undefined;
    }

    const {
      giveawayPostId, photo, stars, isGiftUpgrade, starGift, isGiftResale,
    } = transaction;

    const gift = transaction?.starGift;
    const isUniqueGift = gift?.type === 'starGiftUnique';
    const sticker = transaction?.starGift ? getStickerFromGift(transaction.starGift) : topSticker;

    const giftAttributes = isUniqueGift ? getGiftAttributes(gift) : undefined;

    const customPeer = (transaction.peer && transaction.peer.type !== 'peer'
      && buildStarsTransactionCustomPeer(transaction.peer)) || undefined;

    const peerId = transaction.peer?.type === 'peer' ? transaction.peer.id : undefined;
    const toName = transaction.peer && oldLang(getStarsPeerTitleKey(transaction.peer));

    const title = getTransactionTitle(oldLang, lang, transaction);

    const messageLink = peer && transaction.messageId && !isGiftUpgrade
      ? getMessageLink(peer, undefined, transaction.messageId) : undefined;
    const giveawayMessageLink = peer && giveawayPostId ? getMessageLink(peer, undefined, giveawayPostId) : undefined;

    const media = transaction.extendedMedia;

    const mediaAmount = media?.length || 0;
    const areAllPhotos = media?.every((m) => !m.video);
    const areAllVideos = media?.every((m) => !m.photo);

    const mediaText = areAllPhotos ? oldLang('Stars.Transfer.Photos', mediaAmount)
      : areAllVideos ? oldLang('Stars.Transfer.Videos', mediaAmount)
        : oldLang('Media', mediaAmount);

    const description = transaction.description
      || (isGiftUpgrade && starGift?.type === 'starGiftUnique' ? starGift.title : undefined)
      || (media ? mediaText : undefined);

    const shouldDisplayAvatar = !media && !sticker;
    const avatarPeer = !photo ? (peer || customPeer) : undefined;

    const uniqueGiftHeader = isUniqueGift && (
      <div className={buildClassName(styles.header, styles.uniqueGift)}>
        <UniqueGiftHeader
          backdropAttribute={giftAttributes!.backdrop!}
          patternAttribute={giftAttributes!.pattern!}
          modelAttribute={giftAttributes!.model!}
          title={gift.title}
          subtitle={lang('GiftInfoCollectible', { number: gift.number })}
          resellPrice={transaction.stars}
        />
      </div>
    );

    const regularHeader = (
      <div className={styles.header}>
        {media && (
          <PaidMediaThumb
            className={buildClassName(styles.mediaPreview, 'transaction-media-preview')}
            media={media}
            onClick={handleOpenMedia}
          />
        )}
        {!media && sticker && (
          <AnimatedIconFromSticker
            key={transaction.id}
            sticker={sticker}
            play={canPlayAnimatedEmojis}
            noLoop
          />
        )}
        {shouldDisplayAvatar && (
          <Avatar peer={avatarPeer} webPhoto={photo} size="giant" />
        )}
        {!sticker && (
          <img
            className={buildClassName(styles.starsBackground)}
            src={StarsBackground}
            alt=""
            draggable={false}
          />
        )}
        {Boolean(title) && <h1 className={styles.title}>{title}</h1>}
        <p className={styles.description}>{description}</p>
        <p className={styles.amount}>
          <span
            className={buildClassName(styles.amount, isNegativeStarsAmount(stars) ? styles.negative : styles.positive)}
          >
            {formatStarsTransactionAmount(lang, stars)}
          </span>
          <StarIcon type="gold" size="middle" />
          {transaction.isRefund && (
            <p className={styles.refunded}>{lang('Refunded')}</p>
          )}
        </p>
        {Boolean(transaction.paidMessages && transaction.starRefCommision && paidMessageCommission) && (
          <p className={styles.description}>
            {lang(
              'PaidMessageTransactionDescription',
              { percent: formatPercent(paidMessageCommission! / 10) },
              {
                withNodes: true,
                withMarkdown: true,
              },
            )}
          </p>
        )}
      </div>
    );

    const tableData: TableData = [];

    if (transaction && !transaction.paidMessages && !isGiftResale) {
      tableData.push([
        oldLang('StarsTransaction.StarRefReason.Title'),
        oldLang('StarsTransaction.StarRefReason.Program'),
      ]);
    }

    if (isGiftUpgrade) {
      tableData.push([
        oldLang('StarGiftReason'),
        oldLang('StarGiftReasonUpgrade'),
      ]);
    }

    if (isGiftResale) {
      tableData.push([
        oldLang('StarGiftReason'),
        isNegativeStarsAmount(transaction.stars)
          ? lang('StarGiftSaleTransaction')
          : lang('StarGiftPurchaseTransaction'),
      ]);
    }

    let peerLabel;
    if (isGiftUpgrade) {
      peerLabel = oldLang('Stars.Transaction.GiftFrom');
    } else if (isNegativeStarsAmount(stars) || transaction.isMyGift) {
      peerLabel = oldLang('Stars.Transaction.To');
    } else if (transaction.starRefCommision && !transaction.paidMessages && !isGiftResale) {
      peerLabel = oldLang('StarsTransaction.StarRefReason.Miniapp');
    } else if (peerId) {
      peerLabel = oldLang('Star.Transaction.From');
    } else {
      peerLabel = oldLang('Stars.Transaction.Via');
    }

    tableData.push([
      peerLabel,
      peerId ? { chatId: peerId } : toName || '',
    ]);

    if (transaction.starRefCommision && transaction.paidMessages) {
      tableData.push([
        lang('PaidMessageTransactionTotal'),
        formatStarsAsIcon(lang,
          transaction.stars.amount / ((100 - transaction.starRefCommision) / 100),
          { asFont: false, className: styles.starIcon, containerClassName: styles.totalStars }),
      ]);
    }

    if (messageLink) {
      tableData.push([oldLang('Stars.Transaction.Reaction.Post'), <SafeLink url={messageLink} text={messageLink} />]);
    }

    if (giveawayMessageLink) {
      tableData.push([oldLang('BoostReason'), <SafeLink url={giveawayMessageLink} text={oldLang('Giveaway')} />]);
      tableData.push([oldLang('Gift'), oldLang('Stars', transaction.stars, 'i')]);
    }

    if (transaction.id) {
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
      header: isUniqueGift ? uniqueGiftHeader : regularHeader,
      tableData,
      footer,
    };
  }, [transaction, oldLang, lang, peer, canPlayAnimatedEmojis, topSticker, paidMessageCommission]);

  const prevModalData = usePrevious(starModalData);
  const renderingModalData = prevModalData || starModalData;

  return (
    <TableInfoModal
      isOpen={Boolean(transaction)}
      className={styles.modal}
      hasBackdrop={transaction?.starGift?.type === 'starGiftUnique'}
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
    const paidMessageCommission = global.appConfig?.starsPaidMessageCommissionPermille;

    const starCount = modal?.transaction.stars;
    const starsGiftSticker = modal?.transaction.isGift && selectGiftStickerForStars(global, starCount?.amount);

    return {
      peer,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      topSticker: starsGiftSticker,
      paidMessageCommission,
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
    case 'api':
      return 'Stars.Intro.Transaction.TelegramBotApi.Subtitle';
    default:
      return 'Stars.Transaction.Unsupported.Title';
  }
}
