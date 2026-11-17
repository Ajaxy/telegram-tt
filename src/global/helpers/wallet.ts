import type {
  ApiTonConnectError, ApiWalletCardSticker, ApiWalletCollectible, ApiWalletTransaction, ApiWalletTransactionPeer,
  DecryptWalletCommentError, ReplaceWalletError, SendTonTransferError, WalletBackupError,
} from '../../api/types';
import type { RegularLangKey } from '../../types/language';
import type { RegularLangFnParameters } from '../../util/localization';
import type { TabState } from '../types';

import { toNonBounceableAddress } from '../../lib/ton/address';
import { WALLET_CARD_STICKERS_LIMIT } from '../../limits';

export type WalletCardLayout = {
  stickers?: ApiWalletCardSticker[];
  backgroundAddress?: string;
};

// As in the iOS app, positions closer than this are the same, so an edit back to the saved card is not saved again
const CARD_LAYOUT_TOLERANCE = 1e-6;
const CARD_COORDINATE_KEYS = ['x', 'y', 'width', 'height', 'rotation', 'radius'] as const;

export const WALLET_STICKER_LIMIT_MESSAGE = {
  key: 'WalletStickerLimitError',
  variables: { count: WALLET_CARD_STICKERS_LIMIT },
  options: { pluralValue: WALLET_CARD_STICKERS_LIMIT },
} satisfies RegularLangFnParameters;

export type WalletFlowError = SendTonTransferError | WalletBackupError | DecryptWalletCommentError | ReplaceWalletError
  | ApiTonConnectError;

// The amount is left out: the fee hardly depends on it, so one estimate serves every amount, as in the mobile apps
export function buildWalletTransferFeeKey({
  toAddress, comment, shouldEncryptComment, collectibleAddress,
}: {
  toAddress: string;
  comment?: string;
  shouldEncryptComment?: boolean;
  collectibleAddress?: string;
}) {
  return [toAddress, comment ?? '', Boolean(shouldEncryptComment), collectibleAddress ?? ''].join(':');
}

export function getIsWalletTransferSubmitted(walletTransfer?: TabState['walletTransfer']) {
  return walletTransfer?.status === 'pending' || walletTransfer?.status === 'queued';
}

export function getPendingWalletTransfer(transactions: ApiWalletTransaction[] | undefined, localMessageId: number) {
  return transactions?.find((item) => item.isPending && item.localMessageId === localMessageId);
}

// A confirmed transfer takes over the `localId` of its pending row, while a row that expires or goes with the wallet
// leaves nothing behind
export function getIsWalletTransferConfirmed(transactions: ApiWalletTransaction[] | undefined, localId: string) {
  return Boolean(transactions?.some((item) => item.localId === localId && !item.isPending && !item.isFailed));
}

// The collectibles whose transfers were pending in `previous` and are confirmed in `current`. A transfer to the own
// wallet keeps its collectible.
export function getSentCollectibleAddresses(
  previous: ApiWalletTransaction[] | undefined, current: ApiWalletTransaction[] | undefined, ownAddress: string,
) {
  const ownKey = toNonBounceableAddress(ownAddress);

  return (previous || [])
    .filter(({
      isPending, localId, collectible, peer,
    }) => (
      isPending && collectible && localId && getIsWalletTransferConfirmed(current, localId)
      && !('address' in peer && toNonBounceableAddress(peer.address) === ownKey)
    ))
    .map(({ collectible }) => collectible!.address);
}

export function getAreWalletCardLayoutsEqual(first?: WalletCardLayout, second?: WalletCardLayout) {
  if (first?.backgroundAddress !== second?.backgroundAddress) return false;

  const firstStickers = first?.stickers || [];
  const secondStickers = second?.stickers || [];
  if (firstStickers.length !== secondStickers.length) return false;

  return firstStickers.every(({ address, coordinates }, i) => {
    const other = secondStickers[i];

    return address === other.address && CARD_COORDINATE_KEYS.every((key) => (
      Math.abs((coordinates[key] ?? 0) - (other.coordinates[key] ?? 0)) < CARD_LAYOUT_TOLERANCE
    ));
  });
}

// Hides items whose transfer is still pending, so the user cannot send them again. The toncenter list of owners is
// updated with a delay, so a second transfer would pass the ownership check and lose its fees. When the transfer fails
// or its row expires, the item shows again.
export function filterUnsentCollectibles(
  collectibles: ApiWalletCollectible[] | undefined, transactions: ApiWalletTransaction[] | undefined,
) {
  const sendingAddresses = new Set(transactions?.filter(({ isPending }) => isPending)
    .map(({ collectible }) => collectible?.address));

  return collectibles?.filter(({ address }) => !sendingAddresses.has(address));
}

// The server lists a transfer to a user under the user's address, so the user it was sent to is kept, as the Android
// app does
export function keepRecipientUser(
  peer: ApiWalletTransactionPeer, knownPeer?: ApiWalletTransactionPeer,
): ApiWalletTransactionPeer {
  if (knownPeer?.type !== 'user' || peer.type !== 'address') return peer;
  if (toNonBounceableAddress(knownPeer.address) !== toNonBounceableAddress(peer.address)) return peer;

  return { ...knownPeer, domain: peer.domain ?? knownPeer.domain };
}

export function getWalletPeerId(peer: ApiWalletTransactionPeer) {
  if (peer.type === 'user') return peer.userId;
  if (peer.type === 'channel') return peer.channelId;

  return undefined;
}

export function getWalletGiftMoveKey({ peer, isIncoming }: ApiWalletTransaction): RegularLangKey | undefined {
  if (peer.type !== 'telegramGift' || !peer.isOwnProfile) return undefined;

  return isIncoming ? 'WalletTransactionMovedFromProfile' : 'WalletTransactionMovedToProfile';
}

export function getIsWalletGiftDepositConfirmed({ peer, isIncoming, isPending, isFailed }: ApiWalletTransaction) {
  return !isIncoming && !isPending && !isFailed && peer.type === 'telegramGift' && Boolean(peer.isOwnProfile);
}

export const WALLET_ERROR_LANG_KEYS: Record<WalletFlowError, RegularLangKey> = {
  PASSWORD_INVALID: 'ErrorIncorrectPassword',
  PASSCODE_INVALID: 'WalletPasscodeInvalid',
  PASSCODE_LOCKED: 'PasscodeTooManyAttempts',
  PASSWORD_MISSING: 'ErrorPasswordMissing',
  SESSION_TOO_FRESH: 'WalletSessionTooFreshError',
  BACKUP_DISABLED: 'WalletBackupDisabledError',
  BACKUP_PARTS_MISSING: 'WalletBackupPartsMissingError',
  WRONG_PHRASE: 'WalletWrongPhraseError',
  BACKUP_FAILED: 'WalletBackupFailedError',
  PHRASE_OUTDATED: 'WalletPhraseOutdatedError',
  ROTATION_PENDING: 'WalletRotationPendingError',
  EXPORT_FAILED: 'WalletExportError',
  NO_LOCAL_SECRET: 'WalletNoLocalSecretError',
  INVALID_ADDRESS: 'WalletSendInvalidAddress',
  INACTIVE_ADDRESS: 'WalletSendInactiveAddress',
  INSUFFICIENT_FUNDS: 'WalletSendInsufficientFunds',
  UNSUPPORTED_WALLET: 'WalletUnsupportedWallet',
  SEND_FAILED: 'WalletSendError',
  SEND_UNCERTAIN: 'WalletSendPending',
  WALLET_CHANGED: 'WalletSendWalletChanged',
  NFT_NOT_OWNED: 'WalletCollectibleNotOwned',
  NFT_ON_SALE: 'WalletCollectibleOnSale',
  NFT_NOT_INITIALIZED: 'WalletCollectibleNotReady',
  NFT_UNAVAILABLE: 'WalletCollectibleUnavailable',
  KEY_MISMATCH: 'WalletKeyMismatchError',
  TRANSFER_PENDING: 'WalletSendPendingError',
  GASLESS_UNAVAILABLE: 'WalletSendGaslessUnavailable',
  COMMENT_ENCRYPTION_UNAVAILABLE: 'WalletCommentEncryptionUnavailable',
  DECRYPT_FAILED: 'WalletDecryptError',
  PROOF_INVALID: 'WalletProofInvalidError',
  REPLACE_FAILED: 'WalletReplaceError',
  KEEP_FAILED: 'WalletPhraseKeepError',
  TONCONNECT_FAILED: 'WalletConnectError',
  TONCONNECT_BUSY: 'WalletConnectBusyError',
  DAPP_CLIENT_ID_INVALID: 'WalletConnectInvalid',
  MANIFEST_URL_INVALID: 'WalletConnectManifestInvalid',
  MANIFEST_TIMEOUT: 'WalletConnectManifestError',
  SESSION_NOT_FOUND: 'WalletConnectSessionClosed',
  SESSION_CLOSED: 'WalletConnectSessionClosed',
  SESSION_CHANGED: 'WalletConnectSessionChanged',
  SESSION_NOT_ACTIVE: 'WalletConnectSessionClosed',
  REQUEST_NOT_FOUND: 'WalletConnectRequestMissing',
  REQUEST_EXPIRED: 'WalletConnectExpired',
  REQUEST_ALREADY_CLAIMED: 'WalletConnectHandled',
  BAD_REQUEST_ID: 'WalletConnectStale',
  LOOKUP_INVALID: 'WalletConnectInvalid',
  TONCONNECT_CLIENT_ID_INVALID: 'WalletConnectInvalid',
  TONCONNECT_CLIENT_ID_OCCUPIED: 'WalletConnectInvalid',
  CHALLENGE_INVALID: 'WalletConnectInvalid',
  BODY_INVALID: 'WalletConnectInvalid',
  WALLET_UNAVAILABLE: 'WalletConnectUnavailable',
  INVALID_REQUEST: 'WalletConnectInvalid',
};
