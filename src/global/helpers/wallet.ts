import type {
  ApiTonConnectError, DecryptWalletCommentError, ReplaceWalletError, SendTonTransferError, WalletBackupError,
} from '../../api/types';
import type { RegularLangKey } from '../../types/language';

export type WalletFlowError = SendTonTransferError | WalletBackupError | DecryptWalletCommentError | ReplaceWalletError
  | ApiTonConnectError;

export function buildWalletTransferFeeKey({
  toAddress, amount, comment, shouldEncryptComment, shouldSendAll, collectibleAddress,
}: {
  toAddress: string;
  amount: bigint;
  comment?: string;
  shouldEncryptComment?: boolean;
  shouldSendAll?: boolean;
  collectibleAddress?: string;
}) {
  return [
    toAddress, amount, comment ?? '', Boolean(shouldEncryptComment), Boolean(shouldSendAll), collectibleAddress ?? '',
  ].join(':');
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
  MANIFEST_URL_INVALID: 'WalletConnectManifestError',
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
