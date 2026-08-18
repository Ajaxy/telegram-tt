import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { getMediaDimensions, getMessageInvoice } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { formatMediaDuration } from '../../../util/dates/oldDateFormat';
import { formatCurrencyAsString } from '../../../util/formatCurrency';

import useInterval from '../../../hooks/schedulers/useInterval';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';

import styles from './InvoiceMediaPreview.module.scss';
import mediaStyles from './media.module.scss';

type OwnProps = {
  message: ApiMessage;
  isConnected: boolean;
};

const POLLING_INTERVAL = 30000;

const InvoiceMediaPreview = ({
  message,
  isConnected,
}: OwnProps) => {
  const { openInvoice, loadExtendedMedia } = getActions();
  const lang = useOldLang();
  const invoice = getMessageInvoice(message);

  const { chatId, id } = message;

  const refreshExtendedMedia = useLastCallback(() => {
    loadExtendedMedia({ chatId, ids: [id] });
  });

  useInterval(refreshExtendedMedia, isConnected ? POLLING_INTERVAL : undefined);

  const {
    amount,
    currency,
    extendedMedia,
  } = invoice!;

  const { thumbnail, duration } = extendedMedia!;
  const { width, height } = getMediaDimensions(extendedMedia!);

  const handleClick = useLastCallback(() => {
    openInvoice({
      type: 'message',
      chatId,
      messageId: id,
      isExtendedMedia: true,
    });
  });

  return (
    <div
      className={buildClassName(styles.root, mediaStyles.frame, mediaStyles.intrinsic, 'media-inner')}
      style={buildStyle(
        `--media-width: ${width}px`,
        `--media-aspect-ratio: ${width} / ${height}`,
      )}
      onClick={handleClick}
    >
      <MediaSpoiler
        thumbDataUri={thumbnail?.dataUri}
        width={width}
        height={height}
        isVisible
        className={styles.spoiler}
      />
      {Boolean(duration) && <div className={styles.duration}>{formatMediaDuration(duration)}</div>}
      <div className={styles.buy}>
        <Icon name="lock" className={styles.lock} />
        {lang('Checkout.PayPrice', formatCurrencyAsString(amount, currency))}
      </div>
    </div>
  );
};

export default memo(InvoiceMediaPreview);
