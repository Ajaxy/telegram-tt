import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiPeer,
  ApiStarsTransaction,
} from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import type { CustomPeer } from '../../../../types';

import { getSenderTitle } from '../../../../global/helpers';
import { buildStarsTransactionCustomPeer, formatStarsTransactionAmount } from '../../../../global/helpers/payments';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { CUSTOM_PEER_PREMIUM } from '../../../../util/objects/customPeer';
import { getTransactionTitle } from '../helpers/transaction';

import useSelector from '../../../../hooks/data/useSelector';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import Avatar from '../../../common/Avatar';
import StarIcon from '../../../common/icons/StarIcon';
import PaidMediaThumb from './PaidMediaThumb';

import styles from './StarsTransactionItem.module.scss';

type OwnProps = {
  transaction: ApiStarsTransaction;
  className?: string;
};

function selectOptionalPeer(peerId?: string) {
  return (global: GlobalState) => (
    peerId ? selectPeer(global, peerId) : undefined
  );
}

const StarsTransactionItem = ({ transaction, className }: OwnProps) => {
  const { openStarsTransactionModal } = getActions();
  const {
    date,
    stars,
    photo,
    peer: transactionPeer,
    extendedMedia,
    subscriptionPeriod,
  } = transaction;
  const lang = useOldLang();

  const peerId = transactionPeer.type === 'peer' ? transactionPeer.id : undefined;
  const peer = useSelector(selectOptionalPeer(peerId));

  const data = useMemo(() => {
    let title = getTransactionTitle(lang, transaction);
    let description;
    let status: string | undefined;
    let avatarPeer: ApiPeer | CustomPeer | undefined;

    if (transaction.peer.type === 'peer') {
      description = peer && getSenderTitle(lang, peer);
      avatarPeer = peer || CUSTOM_PEER_PREMIUM;
    } else {
      const customPeer = buildStarsTransactionCustomPeer(transaction.peer);
      title = customPeer.title || lang(customPeer.titleKey!);
      description = lang(customPeer.subtitleKey!);
      avatarPeer = customPeer;
    }

    if (transaction.photo) {
      avatarPeer = undefined;
    }

    if (transaction.isRefund) {
      status = lang('StarsRefunded');
    }

    if (transaction.hasFailed) {
      status = lang('StarsFailed');
    }

    if (transaction.isPending) {
      status = lang('StarsPending');
    }

    return {
      title,
      description,
      avatarPeer,
      status,
    };
  }, [lang, peer, transaction]);

  const handleClick = useLastCallback(() => {
    openStarsTransactionModal({ transaction });
  });

  return (
    <div className={buildClassName(styles.root, className)} onClick={handleClick}>
      <div className={styles.preview}>
        {extendedMedia ? <PaidMediaThumb media={extendedMedia} isTransactionPreview />
          : <Avatar size="medium" webPhoto={photo} peer={data.avatarPeer} />}
        {Boolean(subscriptionPeriod) && (
          <StarIcon className={styles.subscriptionStar} type="gold" size="small" />
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{data.title}</h3>
        <p className={styles.description}>{data.description}</p>
        <p className={styles.date}>
          {formatDateTimeToString(date * 1000, lang.code, true)}
          {data.status && ` — (${data.status})`}
        </p>
      </div>
      <div className={styles.stars}>
        <span className={buildClassName(styles.amount, stars < 0 ? styles.negative : styles.positive)}>
          {formatStarsTransactionAmount(stars)}
        </span>
        <StarIcon className={styles.star} type="gold" size="adaptive" />
      </div>
    </div>
  );
};

export default memo(StarsTransactionItem);
