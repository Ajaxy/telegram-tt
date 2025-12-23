import type { ApiStarsTransaction, ApiTypeCurrencyAmount } from '../../../../api/types';
import type { OldLangFn } from '../../../../hooks/useOldLang';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../../config';
import { buildStarsTransactionCustomPeer, shouldUseCustomPeer } from '../../../../global/helpers/payments';
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
    return oldLang('StarTransactionCommission', formatPercent(transaction.starRefCommision));
  }
  if (transaction.isGiftUpgrade) return oldLang('Gift2TransactionUpgraded');
  if (transaction.extendedMedia) return oldLang('StarMediaPurchase');
  if (transaction.subscriptionPeriod) return transaction.title || oldLang('StarSubscriptionPurchase');
  if (transaction.isReaction) return oldLang('StarsReactionsSent');
  if (transaction.giveawayPostId) return oldLang('StarsGiveawayPrizeReceived');
  if (transaction.isMyGift) return oldLang('StarsGiftSent');
  if (transaction.isGift) {
    if (transaction.amount.currency === TON_CURRENCY_CODE) {
      return lang('TonGiftReceived');
    }
    return oldLang('StarsGiftReceived');
  }
  if (transaction.starGift) {
    return isNegativeAmount(transaction.amount) ? oldLang('Gift2TransactionSent') : oldLang('Gift2ConvertedTitle');
  }

  const customPeer = (transaction.peer && shouldUseCustomPeer(transaction)
    && buildStarsTransactionCustomPeer(transaction)) || undefined;

  if (customPeer) return customPeer.title || oldLang(customPeer.titleKey!);

  return transaction.title;
}

export function isNegativeAmount(currencyAmount: ApiTypeCurrencyAmount) {
  if (currencyAmount.currency === STARS_CURRENCY_CODE) {
    if (currencyAmount.amount) return currencyAmount.amount < 0;
    return currencyAmount.nanos < 0;
  }
  return currencyAmount.amount < 0;
}
