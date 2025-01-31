import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiStarsSubscription,
} from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';

import { getPeerTitle } from '../../../../global/helpers';
import { selectPeer } from '../../../../global/selectors';
import { formatDateToString } from '../../../../util/dates/dateFormat';
import { formatInteger } from '../../../../util/textFormat';
import renderText from '../../../common/helpers/renderText';

import useSelector from '../../../../hooks/data/useSelector';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import Avatar from '../../../common/Avatar';
import StarIcon from '../../../common/icons/StarIcon';

import styles from './StarsSubscriptionItem.module.scss';

type OwnProps = {
  subscription: ApiStarsSubscription;
};

function selectProvidedPeer(peerId: string) {
  return (global: GlobalState) => (
    selectPeer(global, peerId)
  );
}

const StarsSubscriptionItem = ({ subscription }: OwnProps) => {
  const { openStarsSubscriptionModal } = getActions();
  const {
    peerId, pricing, until, isCancelled, title, photo,
  } = subscription;
  const lang = useOldLang();

  const peer = useSelector(selectProvidedPeer(peerId))!;

  const handleClick = useLastCallback(() => {
    openStarsSubscriptionModal({ subscription });
  });

  if (!peer) {
    return undefined;
  }

  const hasExpired = until < Date.now() / 1000;
  const formattedDate = formatDateToString(until * 1000, lang.code, true, 'long');

  return (
    <div className={styles.root} onClick={handleClick}>
      <div className={styles.preview}>
        <Avatar size="medium" peer={peer} />
        <StarIcon className={styles.subscriptionStar} type="gold" size="small" />
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{renderText(getPeerTitle(lang, peer) || '')}</h3>
        {title && (
          <p className={styles.subtitle}>
            {photo && <Avatar webPhoto={photo} size="micro" />}
            {renderText(title)}
          </p>
        )}
        <p className={styles.description}>
          {lang(
            hasExpired ? 'StarsSubscriptionExpired'
              : isCancelled ? 'StarsSubscriptionExpires' : 'StarsSubscriptionRenews',
            formattedDate,
          )}
        </p>
      </div>
      <div className={styles.status}>
        {(isCancelled || hasExpired) ? (
          <div className={styles.statusEnded}>
            {lang(hasExpired ? 'StarsSubscriptionStatusExpired' : 'StarsSubscriptionStatusCancelled')}
          </div>
        ) : (
          <>
            <div className={styles.statusPricing}>
              <StarIcon className={styles.star} type="gold" size="adaptive" />
              <span className={styles.amount}>
                {formatInteger(pricing.amount)}
              </span>
            </div>
            <div className={styles.statusPeriod}>{lang('StarsParticipantSubscriptionPerMonth')}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(StarsSubscriptionItem);
