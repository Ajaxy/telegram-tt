import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiMessage } from '../../../api/types';

import { getMessageInvoice } from '../../../global/helpers';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';
import useLang from '../../../hooks/useLang';
import useInterval from '../../../hooks/useInterval';

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
  const lang = useLang();
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
        <i className={buildClassName('icon', 'icon-lock', styles.lock)} />
        {lang('Checkout.PayPrice', formatCurrency(amount, currency))}
      </div>
    </div>
  );
};

export default memo(InvoiceMediaPreview);
