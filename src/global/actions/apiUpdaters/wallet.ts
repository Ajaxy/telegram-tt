import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { throttle } from '../../../util/schedulers';
import { addActionHandler, getActions } from '../../index';
import {
  clearWalletRecords,
  markWalletTonConnectSessionsClosing,
  replacePendingWalletTransaction,
  updateWallet,
  updateWalletServerState,
  updateWalletTonConnectSession,
} from '../../reducers/wallet';

// The server reports each step of a transfer, and a burst of them is one history change
const HISTORY_REFRESH_THROTTLE_MS = 2000;

const refreshState = throttle(() => {
  getActions().loadWalletState();
}, HISTORY_REFRESH_THROTTLE_MS, false);

const refreshTransactions = throttle(() => {
  getActions().loadWalletTransactions({ shouldRefresh: true });
}, HISTORY_REFRESH_THROTTLE_MS, false);

const refreshCollectibles = throttle(() => {
  getActions().loadWalletCollectibles({ shouldRefresh: true });
}, HISTORY_REFRESH_THROTTLE_MS, false);

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateWalletState': {
      const { status, state } = update.wallet;

      // A swap made here reports its own state first, so while its request is out the update is its echo
      const previousAddress = global.wallet?.state?.address;
      const isGone = Boolean(previousAddress) && state?.address !== previousAddress;
      const isSwappedElsewhere = isGone && Boolean(state?.address) && !global.wallet?.isReplacing;

      if (isGone) {
        global = clearWalletRecords(global);
        // The local key belonged to the address that went away; the state request settles it for the next one
        actions.loadWalletState();
      }

      if (isSwappedElsewhere) {
        global = updateWallet(global, { hasLocalSecret: false });
        actions.showNotification({ message: { key: 'WalletReplacedElsewhere' }, tabId: getCurrentTabId() });

        // The new wallet may be one of the saved ones, which must not be offered for deletion
        actions.loadSavedWallets();
      } else {
        // A transfer may have taken a collectible with it
        if (global.wallet?.transactions) {
          refreshTransactions();
        }

        if (global.wallet?.collectibles) {
          refreshCollectibles();
        }
      }

      // A key rotated on another device keeps the address, but the stored phrase no longer signs
      const previousPublicKey = global.wallet?.state?.publicKey;

      if (!isGone && previousPublicKey && state?.publicKey && state.publicKey !== previousPublicKey) {
        actions.loadWalletState();
      }

      return updateWalletServerState(global, status, state);
    }

    case 'updateWalletActivity': {
      refreshState();

      if (global.wallet?.transactions) {
        refreshTransactions();
      }

      if (global.wallet?.collectibles) {
        refreshCollectibles();
      }
      break;
    }

    // The update does not name the sending wallet, so only a local record it confirms is replaced
    case 'updateWalletSentTransaction': {
      const { msgHash, transaction } = update;
      const isPendingHere = global.wallet?.transactions?.some(({ id, isPending }) => id === msgHash && isPending);
      if (!transaction || !isPendingHere) break;

      return replacePendingWalletTransaction(global, msgHash, { ...transaction, msgHash });
    }

    case 'updateWalletGaslessInfo':
      return updateWallet(global, { gaslessInfo: update.gaslessInfo });

    case 'updateWalletTonConnectSession': {
      const { session } = update;
      const isConnectPrompt = session.isPending && session.manifest && !session.manifestError
        && !session.isClosed && !session.isClosing;

      if (isConnectPrompt) {
        actions.openWalletTonConnectSession({ session, tabId: getCurrentTabId() });
      }

      return updateWalletTonConnectSession(global, session);
    }

    case 'updateWalletTonConnectPendingDisconnect': {
      actions.finishWalletTonConnectDisconnects({ sessionIds: update.sessionIds });

      return markWalletTonConnectSessionsClosing(global, update.sessionIds);
    }
  }
});
