import type { ApiStarsAmount, ApiStarsTransaction } from '../../../../api/types';
import type { OldLangFn } from '../../../../hooks/useOldLang';

import { buildStarsTransactionCustomPeer } from '../../../../global/helpers/payments';
import {
  type LangFn,
} from '../../../../util/localization';
import { formatPercent } from '../../../../util/textFormat';

export function getTransactionTitle(oldLang: OldLangFn, lang: LangFn, transaction: ApiStarsTransaction) {
  if (transaction.paidMessages) {
    return lang(
      'PaidMessageTransaction',
      { count: transaction.paidMessages },
      {
        withNodes: true,
        pluralValue: transaction.paidMessages,
      },
    );
  }
  if (transaction.starRefCommision) {
    return oldLang('StarTransactionCommission', formatPercent(transaction.starRefCommision));
  }
  if (transaction.isGiftUpgrade) return oldLang('Gift2TransactionUpgraded');
  if (transaction.extendedMedia) return oldLang('StarMediaPurchase');
  if (transaction.subscriptionPeriod) return transaction.title || oldLang('StarSubscriptionPurchase');
  if (transaction.isReaction) return oldLang('StarsReactionsSent');
  if (transaction.giveawayPostId) return oldLang('StarsGiveawayPrizeReceived');
  if (transaction.isMyGift) return oldLang('StarsGiftSent');
  if (transaction.isGift) return oldLang('StarsGiftReceived');
  if (transaction.starGift) {
    return isNegativeStarsAmount(transaction.stars) ? oldLang('Gift2TransactionSent') : oldLang('Gift2ConvertedTitle');
  }

  const customPeer = (transaction.peer && transaction.peer.type !== 'peer'
    && buildStarsTransactionCustomPeer(transaction.peer)) || undefined;

  if (customPeer) return customPeer.title || oldLang(customPeer.titleKey!);

  return transaction.title;
}

export function isNegativeStarsAmount(starsAmount: ApiStarsAmount) {
  if (starsAmount.amount) return starsAmount.amount < 0;
  return starsAmount.nanos < 0;
}
