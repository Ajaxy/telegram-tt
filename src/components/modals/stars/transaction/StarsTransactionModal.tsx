import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiPeer,
  ApiStarsTransactionPeer,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import { MediaViewerOrigin } from '../../../../types';

import { getMessageLink } from '../../../../global/helpers';
import { buildStarsTransactionCustomPeer, formatStarsTransactionAmount } from '../../../../global/helpers/payments';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';

import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import usePrevious from '../../../../hooks/usePrevious';

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
};

const StarsTransactionModal: FC<OwnProps & StateProps> = ({
  modal, peer,
}) => {
  const { showNotification, openMediaViewer, closeStarsTransactionModal } = getActions();
  const lang = useOldLang();
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

    const customPeer = (transaction.peer && transaction.peer.type !== 'peer'
        && buildStarsTransactionCustomPeer(transaction.peer)) || undefined;

    const peerId = transaction.peer?.type === 'peer' ? transaction.peer.id : undefined;
    const toName = transaction.peer && lang(getStarsPeerTitleKey(transaction.peer));

    const title = transaction.title || (customPeer ? lang(customPeer.titleKey) : undefined);

    const messageLink = peer && transaction.messageId
      ? getMessageLink(peer, undefined, transaction.messageId) : undefined;

    const media = transaction.extendedMedia;

    const mediaAmount = media?.length || 0;
    const areAllPhotos = media?.every((m) => !m.video);
    const areAllVideos = media?.every((m) => !m.photo);

    const mediaText = areAllPhotos ? lang('Stars.Transfer.Photos', mediaAmount)
      : areAllVideos ? lang('Stars.Transfer.Videos', mediaAmount)
        : lang('Media', mediaAmount);

    const description = transaction.description || (media ? mediaText : undefined);

    const header = (
      <div className={styles.header}>
        {media && (
          <PaidMediaThumb
            className={buildClassName(styles.mediaPreview, 'transaction-media-preview')}
            media={media}
            onClick={handleOpenMedia}
          />
        )}
        <img
          className={buildClassName(styles.starsBackground, media && styles.mediaShift)}
          src={StarsBackground}
          alt=""
          draggable={false}
        />
        {title && <h1 className={styles.title}>{title}</h1>}
        <p className={styles.description}>{description}</p>
        <p className={styles.amount}>
          <span className={buildClassName(styles.amount, transaction.stars < 0 ? styles.negative : styles.positive)}>
            {formatStarsTransactionAmount(transaction.stars)}
          </span>
          <StarIcon type="gold" size="big" />
        </p>
      </div>
    );

    const tableData: TableData = [];

    tableData.push([
      lang(transaction.stars < 0 || transaction.isMyGift ? 'Stars.Transaction.To'
        : peerId ? 'Star.Transaction.From' : 'Stars.Transaction.Via'),
      peerId ? { chatId: peerId } : toName || '',
    ]);

    if (messageLink) {
      tableData.push([lang('Stars.Transaction.Media'), <SafeLink url={messageLink} text={messageLink} />]);
    }

    if (transaction.id) {
      tableData.push([
        lang('Stars.Transaction.Id'),
        (
          <span
            className={styles.tid}
            onClick={() => {
              copyTextToClipboard(transaction.id!);
              showNotification({
                message: lang('StarsTransactionIDCopied'),
              });
            }}
          >
            {transaction.id}
            <Icon className={styles.copyIcon} name="copy" />
          </span>
        ),
      ]);
    }

    tableData.push([
      lang('Stars.Transaction.Date'),
      formatDateTimeToString(transaction.date * 1000, lang.code, true),
    ]);

    const footerText = lang('lng_credits_box_out_about');
    const footerTextParts = footerText.split('{link}');

    const footer = (
      <span className={styles.footer}>
        {footerTextParts[0]}
        <SafeLink url={lang('StarsTOSLink')} text={lang('lng_credits_summary_options_about_link')} />
        {footerTextParts[1]}
      </span>
    );

    return {
      header,
      tableData,
      footer,
      avatarPeer: !transaction.photo ? (peer || customPeer) : undefined,
    };
  }, [lang, transaction, peer]);

  const prevModalData = usePrevious(starModalData);
  const renderingModalData = prevModalData || starModalData;

  return (
    <TableInfoModal
      isOpen={Boolean(transaction)}
      className={styles.modal}
      header={renderingModalData?.header}
      tableData={renderingModalData?.tableData}
      footer={renderingModalData?.footer}
      noHeaderImage={Boolean(transaction?.extendedMedia)}
      headerAvatarWebPhoto={transaction?.photo}
      headerAvatarPeer={renderingModalData?.avatarPeer}
      buttonText={lang('OK')}
      onClose={closeStarsTransactionModal}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const peerId = modal?.transaction?.peer?.type === 'peer' && modal.transaction.peer.id;
    const peer = peerId ? selectPeer(global, peerId) : undefined;

    return {
      peer,
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
