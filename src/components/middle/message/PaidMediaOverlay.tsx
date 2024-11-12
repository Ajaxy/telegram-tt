import React, { memo, type TeactNode, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPaidMedia } from '../../../api/types';

import { STARS_CURRENCY_CODE, STARS_ICON_PLACEHOLDER } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';
import { replaceWithTeact } from '../../../util/replaceWithTeact';
import stopEvent from '../../../util/stopEvent';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import Button from '../../ui/Button';

import styles from './PaidMediaOverlay.module.scss';

type OwnProps = {
  paidMedia: ApiPaidMedia;
  chatId: string;
  messageId: number;
  isOutgoing?: boolean;
  children?: TeactNode;
};

const PaidMediaOverlay = ({
  paidMedia,
  chatId,
  messageId,
  isOutgoing,
  children,
}: OwnProps) => {
  const { openInvoice } = getActions();
  const lang = useOldLang();

  const isClickable = !paidMedia.isBought;

  const buttonText = useMemo(() => {
    const value = lang('UnlockPaidContent', paidMedia.starsAmount);

    return replaceWithTeact(
      value, STARS_ICON_PLACEHOLDER, <StarIcon className={styles.star} type="gold" size="adaptive" />,
    );
  }, [lang, paidMedia]);

  const handleClick = useLastCallback((e: React.MouseEvent) => {
    openInvoice({
      type: 'message',
      chatId,
      messageId,
    });
    stopEvent(e);
  });

  return (
    <div
      className={styles.root}
      onClick={isClickable ? handleClick : undefined}
    >
      {children}
      {isClickable && (
        <Button
          className={styles.buyButton}
          color="dark"
          size="tiny"
          fluid
          pill
        >
          <span className={styles.buttonText}>{buttonText}</span>
        </Button>
      )}
      {paidMedia.isBought && (
        <div className={buildClassName('message-paid-media-status', styles.boughtStatus)}>
          {isOutgoing ? formatCurrency(paidMedia.starsAmount, STARS_CURRENCY_CODE) : lang('Chat.PaidMedia.Purchased')}
        </div>
      )}
    </div>
  );
};

export default memo(PaidMediaOverlay);
