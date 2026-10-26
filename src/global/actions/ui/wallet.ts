import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addTabStateResetterAction } from '../../helpers/meta';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';

addActionHandler('openWalletModal', (global, actions, payload): ActionReturnType => {
  const {
    initialRecipient, initialAmount, initialComment, isInitialCommentEncrypted, shouldCloseAfterSend,
    shouldCloseOnBack, initialTransactionId, shouldShowIntro, shouldReleaseKey, shouldOpenTonConnect,
    tabId = getCurrentTabId(),
  } = payload || {};

  // The wallet state is not fetched here: the modal's poll makes its first call on open
  actions.loadCurrencyRates();
  actions.loadExistingWaltBalance();
  actions.loadPasswordInfo();
  actions.loadSavedWallets();
  actions.loadStarStatus();

  return updateTabState(global, {
    walletModal: {
      initialRecipient, initialAmount, initialComment, isInitialCommentEncrypted, shouldCloseAfterSend,
      shouldCloseOnBack, initialTransactionId, shouldShowIntro, shouldReleaseKey, shouldOpenTonConnect,
    },
  }, tabId);
});

addTabStateResetterAction('closeWalletModal', 'walletModal');

addActionHandler('openWalletCardModal', (global, actions, payload): ActionReturnType => {
  const { userId, tabId = getCurrentTabId() } = payload;

  // The card shows the balance in the wallet currency
  actions.loadCurrencyRates();

  // A cached profile keeps the card it was saved with, and the balance changes with every transfer. The own card
  // follows the wallet state instead, and a reload answered after a transfer would bring back the older balance.
  if (userId !== global.currentUserId) {
    actions.loadFullUser({ userId });
  }

  return updateTabState(global, { walletCardModal: { userId } }, tabId);
});

addTabStateResetterAction('closeWalletCardModal', 'walletCardModal');

// The server is told separately, through `dismissSuggestion`
addActionHandler('dismissWalletIntro', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { walletModal } = global.byTabId[tabId];

  if (!walletModal?.shouldShowIntro) return undefined;

  return updateTabState(global, { walletModal: { ...walletModal, shouldShowIntro: undefined } }, tabId);
});

addTabStateResetterAction('clearWalletTransfer', 'walletTransfer');

addTabStateResetterAction('clearWalletTransferFee', 'walletTransferFee');

addTabStateResetterAction('clearWalletMnemonic', 'walletMnemonic');

addTabStateResetterAction('clearWalletBackup', 'walletBackup');

addTabStateResetterAction('clearWalletReplace', 'walletReplace');

addTabStateResetterAction('clearWalletBuy', 'walletBuy');

addTabStateResetterAction('clearWalletCommentDecryption', 'walletCommentDecryption');

addTabStateResetterAction('clearWalletTonConnect', 'walletTonConnect');

addActionHandler('clearWalletTonConnectError', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const flow = global.byTabId[tabId].walletTonConnect;

  // Going back to `ready` would offer to answer an answered request again
  if (!flow || flow.status === 'pending' || flow.status === 'done') return global;

  return updateTabState(global, { walletTonConnect: { ...flow, status: 'ready', error: undefined } }, tabId);
});

addActionHandler('setWalletCurrency', (global, actions, payload): ActionReturnType => {
  const { currency } = payload;

  return {
    ...global,
    walletCurrency: currency,
  };
});
