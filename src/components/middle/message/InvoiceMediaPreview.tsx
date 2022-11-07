import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiMessage } from '../../../api/types';

import { getMessageInvoice } from '../../../global/helpers';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { DPR } from '../../../util/environment';

import useLang from '../../../hooks/useLang';
import useCanvasBlur from '../../../hooks/useCanvasBlur';
import useInterval from '../../../hooks/useInterval';

import styles from './InvoiceMediaPreview.module.scss';

type OwnProps = {
  message: ApiMessage;
  lastSyncTime?: number;
};

const POLLING_INTERVAL = 30000;
const BLUR_RADIUS = 25;

const InvoiceMediaPreview: FC<OwnProps> = ({
  message,
  lastSyncTime,
}) => {
  const { openInvoice, loadExtendedMedia } = getActions();
  const lang = useLang();
  const invoice = getMessageInvoice(message);

  const { chatId, id } = message;

  const refreshExtendedMedia = useCallback(() => {
    loadExtendedMedia({ chatId, ids: [id] });
  }, [chatId, id, loadExtendedMedia]);

  useInterval(refreshExtendedMedia, lastSyncTime ? POLLING_INTERVAL : undefined);

  const {
    amount,
    currency,
    extendedMedia,
  } = invoice!;

  const {
    width, height, thumbnail, duration,
  } = extendedMedia!;

  const canvasRef = useCanvasBlur(thumbnail?.dataUri, false, undefined, BLUR_RADIUS, width, height);

  const handleClick = useCallback(() => {
    openInvoice({
      chatId,
      messageId: id,
    });
  }, [chatId, id, openInvoice]);

  return (
    <div
      className={buildClassName(styles.root, 'media-inner')}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className={styles.canvas} width={width} height={height} />
      <div className={buildClassName(styles.dots, DPR > 1 && styles.highres)} />
      {Boolean(duration) && <div className={styles.duration}>{formatMediaDuration(duration)}</div>}
      <div className={styles.buy}>
        <i className={buildClassName('icon-lock', styles.lock)} />
        {lang('Checkout.PayPrice', formatCurrency(amount, currency))}
      </div>
    </div>
  );
};

export default memo(InvoiceMediaPreview);
