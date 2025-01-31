import type { ApiStarsAmount, ApiStarsTransaction } from '../../../../api/types';
import type { OldLangFn } from '../../../../hooks/useOldLang';

import { buildStarsTransactionCustomPeer } from '../../../../global/helpers/payments';
import { formatPercent } from '../../../../util/textFormat';

export function getTransactionTitle(lang: OldLangFn, transaction: ApiStarsTransaction) {
  if (transaction.starRefCommision) {
    return lang('StarTransactionCommission', formatPercent(transaction.starRefCommision));
  }
  if (transaction.isGiftUpgrade) return lang('Gift2TransactionUpgraded');
  if (transaction.extendedMedia) return lang('StarMediaPurchase');
  if (transaction.subscriptionPeriod) return transaction.title || lang('StarSubscriptionPurchase');
  if (transaction.isReaction) return lang('StarsReactionsSent');
  if (transaction.giveawayPostId) return lang('StarsGiveawayPrizeReceived');
  if (transaction.isMyGift) return lang('StarsGiftSent');
  if (transaction.isGift) return lang('StarsGiftReceived');
  if (transaction.starGift) {
    return isNegativeStarsAmount(transaction.stars) ? lang('Gift2TransactionSent') : lang('Gift2ConvertedTitle');
  }

  const customPeer = (transaction.peer && transaction.peer.type !== 'peer'
    && buildStarsTransactionCustomPeer(transaction.peer)) || undefined;

  if (customPeer) return customPeer.title || lang(customPeer.titleKey!);

  return transaction.title;
}

export function isNegativeStarsAmount(starsAmount: ApiStarsAmount) {
  if (starsAmount.amount) return starsAmount.amount < 0;
  return starsAmount.nanos < 0;
}
