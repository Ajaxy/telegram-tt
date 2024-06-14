import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiPeer,
  ApiStarsTransaction,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { CustomPeer } from '../../../types';

import { getSenderTitle } from '../../../global/helpers';
import { buildStarsTransactionCustomPeer, formatStarsTransactionAmount } from '../../../global/helpers/payments';
import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/date/dateFormat';
import { CUSTOM_PEER_PREMIUM } from '../../../util/objects/customPeer';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useSelector from '../../../hooks/useSelector';

import Avatar from '../../common/Avatar';
import StarIcon from '../../common/icons/StarIcon';

import styles from './StarsTransactionItem.module.scss';

type OwnProps = {
  transaction: ApiStarsTransaction;
};

function selectOptionalPeer(peerId?: string) {
  return (global: GlobalState) => (
    peerId ? selectPeer(global, peerId) : undefined
  );
}

const StarsTransactionItem = ({ transaction }: OwnProps) => {
  const { getStarsReceipt } = getActions();
  const {
    date,
    stars,
    photo,
    isRefund,
    peer: transactionPeer,
  } = transaction;
  const lang = useLang();

  const peerId = transactionPeer.type === 'peer' ? transactionPeer.id : undefined;
  const peer = useSelector(selectOptionalPeer(peerId));

  const data = useMemo(() => {
    let title = transaction.title;
    let description;
    let avatarPeer: ApiPeer | CustomPeer | undefined;

    if (transaction.peer.type === 'peer') {
      description = peer && getSenderTitle(lang, peer);
      avatarPeer = peer || CUSTOM_PEER_PREMIUM;
    } else {
      const customPeer = buildStarsTransactionCustomPeer(transaction.peer);
      title = lang(customPeer.titleKey);
      description = lang(customPeer.subtitleKey!);
      avatarPeer = customPeer;
    }

    if (transaction.photo) {
      avatarPeer = undefined;
    }

    return {
      title,
      description,
      avatarPeer,
    };
  }, [lang, peer, transaction]);

  const handleClick = useLastCallback(() => {
    getStarsReceipt({ transaction });
  });

  return (
    <div className={styles.root} onClick={handleClick}>
      <Avatar size="medium" webPhoto={photo} peer={data.avatarPeer} />
      <div className={styles.info}>
        <h3 className={styles.title}>{data.title}</h3>
        <p className={styles.description}>{data.description}</p>
        <p className={styles.date}>
          {formatDateTimeToString(date * 1000, lang.code, true)}
          {isRefund && ` — (${lang('StarsRefunded')})`}
        </p>
      </div>
      <div className={styles.stars}>
        <span className={buildClassName(styles.amount, stars < 0 ? styles.negative : styles.positive)}>
          {formatStarsTransactionAmount(stars)}
        </span>
        <StarIcon type="gold" size="big" />
      </div>
    </div>
  );
};

export default memo(StarsTransactionItem);
