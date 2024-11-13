import type { ApiStarsTransaction } from '../../../../api/types';
import type { OldLangFn } from '../../../../hooks/useOldLang';

import { buildStarsTransactionCustomPeer } from '../../../../global/helpers/payments';

export function getTransactionTitle(lang: OldLangFn, transaction: ApiStarsTransaction) {
  if (transaction.extendedMedia) return lang('StarMediaPurchase');
  if (transaction.subscriptionPeriod) return lang('StarSubscriptionPurchase');
  if (transaction.isReaction) return lang('StarsReactionsSent');
  if (transaction.giveawayPostId) return lang('StarsGiveawayPrizeReceived');
  if (transaction.isMyGift) return lang('StarsGiftSent');
  if (transaction.isGift) return lang('StarsGiftReceived');
  if (transaction.starGift) {
    return transaction.stars < 0 ? lang('Gift2TransactionSent') : lang('Gift2ConvertedTitle');
  }

  const customPeer = (transaction.peer && transaction.peer.type !== 'peer'
    && buildStarsTransactionCustomPeer(transaction.peer)) || undefined;

  if (customPeer) return customPeer.title || lang(customPeer.titleKey!);

  return transaction.title;
}
