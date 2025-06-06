import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { getMessageInvoice } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dates/dateFormat';
import { formatCurrencyAsString } from '../../../util/formatCurrency';

import useInterval from '../../../hooks/schedulers/useInterval';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';

import styles from './InvoiceMediaPreview.module.scss';

type OwnProps = {
  message: ApiMessage;
  isConnected: boolean;
};

const POLLING_INTERVAL = 30000;

const InvoiceMediaPreview: FC<OwnProps> = ({
  message,
  isConnected,
}) => {
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

  const {
    width, height, thumbnail, duration,
  } = extendedMedia!;

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
      className={buildClassName(styles.root, 'media-inner')}
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
