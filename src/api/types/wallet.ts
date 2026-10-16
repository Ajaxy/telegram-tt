import type { ApiWebDocument } from './bots';

export interface ApiTonConnectManifest {
  url: string;
  name: string;
  // Served by Telegram as a web file, so the dApp host never sees the user's IP before they confirm
  icon?: ApiWebDocument;
}

export interface ApiTonConnectSession {
  id: string;
  dappClientId: string;
  clientId?: string;
  nonce: string;
  manifest?: ApiTonConnectManifest;
  manifestError?: number;
  isPending?: boolean;
  isClosing?: boolean;
  isClosed?: boolean;
  date: number;
}

export interface ApiTonConnectRequest {
  sessionId: string;
  msgId: number;
  body: string;
  expires: number;
  topic?: string;
  traceId?: string;
}

export interface ApiTonConnectConnectRequest {
  manifestUrl: string;
  items: { name: string; payload?: string }[];
}

export interface ApiTonConnectAppRequest {
  id: string;
  method: string;
  params: string[];
}

export interface ApiTonConnectTransaction {
  validUntil?: number;
  messages: { address: string; amount: string; payload?: string; stateInit?: string; comment?: string }[];
}

// `bytes` and `cell` are base64; `schema` is the cell's TL-B type
export type ApiTonConnectSignData = { type: 'text'; text: string }
  | { type: 'binary'; bytes: string }
  | { type: 'cell'; schema: string; cell: string };

export type ApiTonConnectError = ExportSecretPhraseError | 'TONCONNECT_FAILED' | 'DAPP_CLIENT_ID_INVALID'
  | 'MANIFEST_URL_INVALID' | 'MANIFEST_TIMEOUT' | 'SESSION_NOT_FOUND' | 'SESSION_CLOSED' | 'SESSION_NOT_ACTIVE'
  | 'REQUEST_NOT_FOUND' | 'REQUEST_EXPIRED' | 'REQUEST_ALREADY_CLAIMED' | 'BAD_REQUEST_ID'
  | 'LOOKUP_INVALID' | 'TONCONNECT_CLIENT_ID_INVALID' | 'TONCONNECT_CLIENT_ID_OCCUPIED' | 'CHALLENGE_INVALID'
  | 'BODY_INVALID' | 'WALLET_UNAVAILABLE' | 'UNSUPPORTED_WALLET' | 'INVALID_REQUEST' | 'INSUFFICIENT_FUNDS'
  | 'INACTIVE_ADDRESS' | 'TRANSFER_PENDING' | 'SEND_FAILED' | 'WALLET_CHANGED'
  // A login through Telegram got a session other than the one it named
  | 'SESSION_CHANGED'
  // The same session or request is being answered already
  | 'TONCONNECT_BUSY';

export type ApiTonConnectResult<T> = T | { error: ApiTonConnectError };

export interface ApiTonConnectRequestPreview {
  request: ApiTonConnectAppRequest;
  transaction?: ApiTonConnectTransaction;
  signData?: ApiTonConnectSignData;
  fee?: bigint;
  expires: number;
  isInvalid?: boolean;
}

export interface ApiWalletUserAddress {
  // Named only to a user who has a contact or a chat with the owner
  userId?: string;
  address: string;
  publicKey?: string;
}

export type ApiWalletStatus = 'provisioning' | 'ready' | 'unavailable';

export interface ApiWalletState {
  // Non-bounceable form, `UQ...`
  address: string;
  publicKey: string;
  // Nanotons
  balance: bigint;
  isBackupEnabled?: boolean;
  canExportPhrase?: boolean;
  canEnableBackup?: boolean;
}

// `state` comes only with the `ready` status
export interface ApiWalletStateResult {
  status: ApiWalletStatus;
  state?: ApiWalletState;
}

export type ApiWalletTransactionPeer =
  | { type: 'user'; userId: string; address: string; domain?: string }
  | { type: 'address'; address: string; domain?: string }
  | { type: 'onramp'; address: string; domain?: string; providerName: string }
  | { type: 'unsupported' };

export interface ApiWalletTransaction {
  id: string;
  // Set for a transfer sent from this device, see `ApiWalletSentTransfer`
  msgHash?: string;
  seqno?: number;
  validUntil?: number;
  isIncoming: boolean;
  isPending?: boolean;
  isFailed?: boolean;
  isGasless?: boolean;
  isKeyChange?: boolean;
  peer: ApiWalletTransactionPeer;
  // Nanotons, always positive; sign is derived from `isIncoming`
  amount: bigint;
  // Nanotons; absent on a local pending entry
  fee?: bigint;
  comment?: string;
  // Base64; `decryptWalletComment` yields the text
  encryptedComment?: string;
  // Absent for a local pending entry
  txHash?: string;
  // Unix seconds
  timestamp: number;
  // Set for a collectible transfer, whose `amount` is 0
  collectible?: ApiWalletCollectible;
}

// A batch a dApp asked for, kept like a pending transfer so a reload does not forget its seqno
export interface ApiTonConnectSentTransfer {
  msgHash: string;
  seqno: number;
  validUntil: number;
  // Nanotons
  amount: bigint;
  // The first recipient stands for the batch in the history
  toAddress: string;
}

export interface ApiWalletSentTransfer {
  // The server finds the transfer by it until the history lists it
  msgHash: string;
  // In flight while the wallet seqno stands and `validUntil` (Unix seconds) has not passed
  seqno: number;
  validUntil: number;
  isGasless?: boolean;
  // Present when the transfer landed on the chain before the server answered
  transaction?: ApiWalletTransaction;
  // Base64; the pending record keeps it instead of the private text
  encryptedComment?: string;
}

// A wallet whose phrase is encrypted on this device
export interface ApiWalletSavedWallet {
  address: string;
  // Nanotons; absent until the chain answers
  balance?: bigint;
}

export interface ApiWalletGaslessInfo {
  isAvailable?: boolean;
  left: number;
  // Unix seconds
  resetAt: number;
  // Nanotons
  minAmount: bigint;
}

// `type` is what Fragment sells the item as; an item from elsewhere is `other`
export type ApiWalletCollectible = {
  address: string;
  name?: string;
  description?: string;
  attributes?: { traitType: string; value: string }[];
  image?: ApiWebDocument;
  imageSmall?: ApiWebDocument;
  // The item's Fragment page, or the Fragment home page when the metadata names none
  fragmentUrl: string;
} & (
  | { type: 'gift'; model?: string; backdrop?: string }
  | { type: 'username' | 'number' | 'other' }
);

export interface ApiOnrampProvider {
  id: string;
  name: string;
  cryptoCurrencies: string[];
  hasBaseCurrencies?: boolean;
  hasLimits?: boolean;
  hasQuote?: boolean;
}

interface ApiOnrampMethod {
  paymentMethod: string;
  isAvailable?: boolean;
}

export interface ApiOnrampAvailability {
  isAllowed?: boolean;
  isBuyAllowed?: boolean;
  // ISO alpha-2, e.g. `DE`
  countryCode: string;
  state?: string;
  methods: ApiOnrampMethod[];
}

// Amounts are kept as the provider's decimal strings, so no precision is lost
export interface ApiOnrampLimits {
  baseCurrency: string;
  baseMinAmount: string;
  baseMaxAmount: string;
  cryptoMinAmount: string;
  cryptoMaxAmount: string;
  paymentMethod: string;
}

export interface ApiOnrampQuote {
  baseCurrency: string;
  baseAmount: string;
  cryptoCurrency: string;
  cryptoAmount: string;
  cryptoPrice: string;
  feeAmount: string;
  extraFeeAmount: string;
  networkFeeAmount: string;
  totalAmount: string;
  paymentMethod: string;
  // Unix seconds
  expiresDate: number;
}

export interface ApiOnrampSession {
  provider: string;
  sessionId: string;
  url: string;
  // Unix seconds
  expiresDate: number;
}

export type DecryptWalletCommentError = 'DECRYPT_FAILED' | 'UNSUPPORTED_WALLET' | ExportSecretPhraseError;
export type DecryptWalletCommentResult = { comment: string } | { error: DecryptWalletCommentError };

export type ExportSecretPhraseError =
  'PASSWORD_INVALID' | 'PASSWORD_MISSING' | 'BACKUP_DISABLED' | 'BACKUP_PARTS_MISSING' | 'SESSION_TOO_FRESH'
  | 'EXPORT_FAILED' | 'PASSCODE_INVALID' | 'PASSCODE_LOCKED' | 'NO_LOCAL_SECRET';
export type ExportSecretPhraseResult = { words: string[] } | { error: ExportSecretPhraseError };

export type WalletBackupError =
  'SESSION_TOO_FRESH' | 'WRONG_PHRASE' | 'UNSUPPORTED_WALLET' | 'BACKUP_FAILED' | 'WALLET_CHANGED'
  // The phrase matches the address, but the chain already has another key
  | 'PHRASE_OUTDATED'
  // A rotation to the key behind the phrase is still on its way
  | 'ROTATION_PENDING'
  | ExportSecretPhraseError;
export type WalletBackupResult = { state: ApiWalletStateResult } | { error: WalletBackupError };
// `isSent` marks a failure after the request went out, when the new key may already be in force
export type RotateWalletKeyResult = { state: ApiWalletStateResult } | { error: WalletBackupError; isSent?: true };

// `KEEP_FAILED`: the current wallet's phrase was right, but could not be encrypted into the device storage
export type ReplaceWalletError = 'PROOF_INVALID' | 'REPLACE_FAILED' | 'KEEP_FAILED' | 'WALLET_CHANGED'
  | WalletBackupError;
export type ReplaceWalletResult = { state: ApiWalletStateResult } | { error: ReplaceWalletError };

export interface ApiWalletTransferFee {
  // Nanotons
  fee: bigint;
  canEncryptComment?: boolean;
  // A wallet not deployed yet sends its state init in an external message, which the relayer cannot carry
  canUseRelayer: boolean;
}

// `NFT_*`: the item must be deployed, owned by this wallet directly (not by a sale contract) and known to toncenter
export type SendTonTransferError =
  'INVALID_ADDRESS' | 'INSUFFICIENT_FUNDS' | 'UNSUPPORTED_WALLET' | 'SEND_FAILED'
  | 'TRANSFER_PENDING' | 'COMMENT_ENCRYPTION_UNAVAILABLE' | 'WALLET_CHANGED' | 'GASLESS_UNAVAILABLE'
  | 'NFT_NOT_OWNED' | 'NFT_ON_SALE' | 'NFT_NOT_INITIALIZED' | 'NFT_UNAVAILABLE'
  // The key was changed elsewhere since the transfer was signed
  | 'KEY_MISMATCH' | ExportSecretPhraseError;
export type SendTonTransferResult = ApiWalletSentTransfer | { error: SendTonTransferError };
