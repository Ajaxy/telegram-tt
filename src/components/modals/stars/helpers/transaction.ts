import type { ApiStarsTransaction, ApiTypeCurrencyAmount } from '../../../../api/types';
import type { LangFn } from '../../../../util/localization';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../../config';
import { buildStarsTransactionCustomPeer, shouldUseCustomPeer } from '../../../../global/helpers/payments';
import { formatPercent } from '../../../../util/textFormat';

export function getTransactionTitle(lang: LangFn, transaction: ApiStarsTransaction) {
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

  if (transaction.isGiftResale) {
    return isNegativeAmount(transaction.amount)
      ? lang('StarGiftSaleTransaction')
      : lang('StarGiftPurchaseTransaction');
  }
  if (transaction.isPostsSearch) {
    return lang('PostsSearchTransaction');
  }

  if (transaction.isDropOriginalDetails) {
    return lang('DropOriginalDetailsTransaction');
  }

  if (transaction.isPrepaidUpgrade) {
    return lang('GiftPrepaidUpgradeTransactionTitle');
  }

  if (transaction.isStarGiftAuctionBid) {
    return isNegativeAmount(transaction.amount)
      ? lang('StarGiftAuctionBidTransaction')
      : lang('StarGiftAuctionBidRefundedTransaction');
  }

  if (transaction.starRefCommision) {
    return lang('StarTransactionCommission', { percent: formatPercent(transaction.starRefCommision) });
  }
  if (transaction.isGiftUpgrade) return lang('Gift2TransactionUpgraded');
  if (transaction.extendedMedia) return lang('StarMediaPurchase');
  if (transaction.subscriptionPeriod) return transaction.title || lang('StarSubscriptionPurchase');
  if (transaction.isReaction) return lang('StarsReactionsSent');
  if (transaction.giveawayPostId) return lang('StarsGiveawayPrizeReceived');
  if (transaction.isMyGift) return lang('SentGift');
  if (transaction.isGift) {
    if (transaction.amount.currency === TON_CURRENCY_CODE) {
      return lang('GramGiftReceived');
    }
    return lang('StarsGiftReceived');
  }
  if (transaction.starGift) {
    return isNegativeAmount(transaction.amount) ? lang('Gift2TransactionSent') : lang('Gift2ConvertedTitle');
  }

  const customPeer = (transaction.peer && shouldUseCustomPeer(transaction)
    && buildStarsTransactionCustomPeer(transaction)) || undefined;

  if (customPeer) return customPeer.title || lang(customPeer.titleKey!);

  return transaction.title;
}

export function isNegativeAmount(currencyAmount: ApiTypeCurrencyAmount) {
  if (currencyAmount.currency === STARS_CURRENCY_CODE) {
    if (currencyAmount.amount) return currencyAmount.amount < 0;
    return currencyAmount.nanos < 0;
  }
  return currencyAmount.amount < 0;
}
