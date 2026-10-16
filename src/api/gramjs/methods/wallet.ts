import { Api as GramJs } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';
import { generateRandomBigInt } from '../../../lib/gramjs/Helpers';

import type { WalletSeeds } from '../../../lib/ton/bip39';
import type {
  ApiChat,
  ApiMessage,
  ApiUser,
  ApiWalletStateResult,
  ApiWalletTransferFee,
  ApiWalletUserAddress,
  DecryptWalletCommentResult,
  ExportSecretPhraseResult,
  ReplaceWalletResult,
  RotateWalletKeyResult,
  SendTonTransferError,
  SendTonTransferResult,
  WalletBackupError,
  WalletBackupResult,
} from '../../types';

import {
  DEBUG, GRAM_TRANSFER_FEE_RESERVE, NFT_TRANSFER_ATTACHED_NANOS, NFT_TRANSFER_FORWARD_NANOS,
} from '../../../config';
import { unwatchAddressActivity, watchAddressActivity } from '../../../lib/ton/activityStream';
import {
  formatAddress, parseAddress, toNonBounceableAddress, toRawAddress,
} from '../../../lib/ton/address';
import {
  COMPOSITE_WORD_COUNT, deriveBip39MnemonicSeeds, deriveImportedWalletSeeds, deriveTonMnemonicSeeds,
  deriveWholeBip39MnemonicSeeds, isBip39Mnemonic,
} from '../../../lib/ton/bip39';
import { MAX_COINS } from '../../../lib/ton/cell';
import { decryptE2eBlob, encryptE2eBlob, generateE2eSeed } from '../../../lib/ton/e2e';
import { getEd25519PublicKey } from '../../../lib/ton/ed25519';
import {
  decryptMessageComment, encryptMessageComment, getEncryptedCommentLength,
} from '../../../lib/ton/encryption';
import { signOwnershipProof } from '../../../lib/ton/proof';
import {
  buildNftTransferPayload,
  buildSignedGaslessTransfer,
  buildSignedKeyRotation,
  buildSignedTransfer,
  buildUnsignedKeyRotationBodyBoc,
  buildUnsignedTransferBodyBoc,
  buildWalletInitBocs,
  deriveWalletAddress,
  encryptPreviousSigningSeed,
  TRANSFER_TTL_SECONDS,
} from '../../../lib/ton/wallet';
import { WALLET_IDB_STORE } from '../../../util/browser/idb';
import {
  bufferFromBase64, bufferFromHex, buffersEqual, bufferToBase64, bufferToHex,
} from '../../../util/encoding/buffer';
import { getBigIntMax } from '../../../util/numbers';
import { pause } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { parseTonTransferAddress } from '../../../util/tonAddress';
import { buildLocalMessage } from '../apiBuilders/messages';
import { buildApiPeerId } from '../apiBuilders/peers';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildApiOnrampAvailability,
  buildApiOnrampLimits,
  buildApiOnrampProvider,
  buildApiOnrampQuote,
  buildApiOnrampSession,
  buildApiWalletCollectible,
  buildApiWalletSentTransfer,
  buildApiWalletStateResult,
  buildApiWalletTransaction,
} from '../apiBuilders/wallet';
import { buildInputUser, buildInputUserFromLocalDb } from '../gramjsBuilders';
import { deserializeBytes, serializeBytes } from '../helpers/misc';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { getClient, invokeRequest } from './client';
import { handleLocalMessageUpdate } from './messages';
import { getPassword } from './twoFaSettings';

type ToncenterError = { error?: string };
type AccountStatesResponse = ToncenterError & {
  accounts?: { address?: string; status?: string; balance?: string; code_hash?: string }[];
};
type RunGetMethodResponse = ToncenterError & {
  exit_code?: number;
  stack?: { type?: string; value?: string }[];
};
// An item under a sale or auction contract names that contract as its owner
type NftItemsResponse = ToncenterError & {
  nft_items?: {
    address: string;
    init?: boolean;
    owner_address?: string;
    on_sale?: boolean;
    sale_contract_address?: string;
    auction_contract_address?: string;
  }[];
};

// `encrypted_old_private_key` is absent when the rotating client did not publish the previous key
type WalletKeyChangesResponse = ToncenterError & {
  actions?: {
    details?: {
      new_public_key?: string;
      encrypted_old_private_key?: string;
    };
  }[];
};

type DnsRecordsResponse = ToncenterError & {
  records?: { domain?: string; dns_wallet?: string }[];
};

type WalletKeys = { seed: Uint8Array; publicKey: Uint8Array };

type WalletKeyChange = {
  newPublicKey: Uint8Array;
  encryptedOldSeed?: Uint8Array;
};

type EstimateFeeResponse = ToncenterError & {
  source_fees?: {
    in_fwd_fee?: number;
    storage_fee?: number;
    gas_fee?: number;
    fwd_fee?: number;
  };
};

const TRANSACTIONS_PAGE_LIMIT = 50;
const COLLECTIBLES_FIRST_PAGE_LIMIT = 5;
const COLLECTIBLES_PAGE_LIMIT = 20;
// MoonPay rejects an uppercase coin code
const ONRAMP_CRYPTO_CURRENCY = 'gram';
// Representation hash of the `WalletTg` trampoline code cell, as toncenter reports it
const WALLET_TG_CODE_HASH = 'kUmuUcHkaJcQzr94MCl7Fqz7rbNjqSClN4k+f/7sp2g=';
// TL constructor id of `mnemonic.decryptedKeyPart`
const DECRYPTED_KEY_PART_ID = 0x8b90dd08;
const TL_ID_LENGTH = 4;
const TL_LONG_STRING_MARKER = 0xfe;
const BACKUP_HOLDER_COUNT = 3;
const PUBLIC_KEY_LENGTH = 32;
// Nanotons: below this balance the chain bounces the rotation for the fee
const KEY_ROTATION_MIN_BALANCE = 10_000_000n;
const KEY_ROTATION_POLL_INTERVAL = 3000;
// Seconds past the request's expiry during which a block may still carry it
const KEY_ROTATION_EXPIRY_MARGIN = 30;
const KEY_CHANGES_PAGE_SIZE = 100;
// Derived from the phrase and the published history, so kept only while the worker lives
const previousSigningKeysCache = new Map<string, WalletKeys[]>();
// The last transfer broadcast per wallet, until its seqno moves on or it expires. Kept on disk as well:
// a transfer sent right before a reload is not in the history yet.
type SentTransfer = { seqno: number; validUntil: number };
const sentTransfers = new Map<string, SentTransfer>();
let sentTransfersRestored: Promise<void> | undefined;
const SEND_LOCK_PREFIX = 'wallet-send:';
const SENT_TRANSFER_KEY_PREFIX = 'sent:';
// The width the server pads the phrase (words joined by single spaces) to before splitting it
const MNEMONIC_PADDED_LENGTH = 215;
const MNEMONIC_PADDING_BYTE = 0x20;

export async function fetchWalletState(): Promise<ApiWalletStateResult | undefined> {
  try {
    const result = await invokeRequest(new GramJs.wallet.GetState(), { shouldThrow: true });

    return result && buildApiWalletStateResult(result);
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'WALLET_UNAVAILABLE') {
      return { status: 'unavailable' };
    }

    return undefined;
  }
}

export async function fetchWalletTransactions({
  offset = '', limit = TRANSACTIONS_PAGE_LIMIT,
}: {
  offset?: string;
  limit?: number;
}) {
  const result = await invokeRequest(new GramJs.wallet.GetTransactions({
    inbound: true,
    outbound: true,
    offset,
    limit,
  }));

  if (!result) {
    return undefined;
  }

  return {
    transactions: result.transactions.map(buildApiWalletTransaction),
    nextOffset: result.nextOffset,
    users: result.users.map(buildApiUser).filter(Boolean),
  };
}

export async function fetchWalletTransactionsByIds({ ids }: { ids: string[] }) {
  const result = await invokeRequest(new GramJs.wallet.GetTransactionsByIDs({ id: ids }));

  if (!result) {
    return undefined;
  }

  return buildWalletTransactionList(result);
}

export async function fetchWalletTransactionsByMsgHash({ msgHashes }: { msgHashes: string[] }) {
  const result = await invokeRequest(new GramJs.wallet.GetTransactionsByMsgHash({ msgHash: msgHashes }));

  if (!result) {
    return undefined;
  }

  return buildWalletTransactionList(result);
}

function buildWalletTransactionList(result: GramJs.wallet.Transactions) {
  return {
    transactions: result.transactions.map(buildApiWalletTransaction),
    users: result.users.map(buildApiUser).filter(Boolean),
  };
}

export async function fetchExistingWaltBalance() {
  const result = await invokeRequest(new GramJs.wallet.GetExistingWaltBalance());

  if (!result) {
    return undefined;
  }

  return { hasBalance: Boolean(result.hasBalance), url: result.url };
}

// An empty address means the user has no wallet. With `isForced` the server creates one, or answers
// `USER_UNAVAILABLE` for a user the rollout has not reached and shows its own popup about it.
export async function fetchWalletUserAddresses({ userIds = [], addresses = [], isForced }: {
  userIds?: string[];
  addresses?: string[];
  isForced?: boolean;
}) {
  const askedIds = userIds.filter((userId) => buildInputUserFromLocalDb(userId));
  let result: GramJs.wallet.UserAddresses | undefined;

  try {
    result = await invokeRequest(new GramJs.wallet.GetUserAddresses({
      id: askedIds.map(buildInputUserFromLocalDb).filter(Boolean),
      addresses,
      force: isForced || undefined,
    }), { shouldThrow: true });
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'WALLET_USER_UNAVAILABLE') {
      return { error: 'USER_UNAVAILABLE' as const };
    }

    return undefined;
  }

  if (!result) {
    return undefined;
  }

  const byUserId: Record<string, string> = Object.fromEntries(askedIds.map((userId) => [userId, '']));
  const byAddress: Record<string, ApiWalletUserAddress | false> = Object.fromEntries(
    addresses.map((address) => [toNonBounceableAddress(address), false]),
  );

  result.addresses.forEach(({ userId, address, publicKey }) => {
    if (!parseTonTransferAddress(address)) return;

    const normalizedAddress = toNonBounceableAddress(address);
    const id = userId !== undefined ? buildApiPeerId(userId, 'user') : undefined;
    if (id) byUserId[id] = normalizedAddress;

    byAddress[normalizedAddress] = {
      userId: id,
      address: normalizedAddress,
      publicKey: publicKey.length === PUBLIC_KEY_LENGTH ? serializeBytes(publicKey) : undefined,
    };
  });

  return { byUserId, byAddress, users: result.users.map(buildApiUser).filter(Boolean) };
}

// The quota arrives as `updateWalletGaslessInfo`
export async function fetchWalletGaslessInfo() {
  await invokeRequest(new GramJs.wallet.GetGaslessInfo());
}

export async function fetchWalletCollectibles({ offset }: { offset?: string }) {
  const result = await invokeRequest(new GramJs.wallet.GetNfts({
    offset: offset ?? '',
    limit: offset ? COLLECTIBLES_PAGE_LIMIT : COLLECTIBLES_FIRST_PAGE_LIMIT,
  }));

  if (!result) {
    return undefined;
  }

  return {
    collectibles: result.items.map(buildApiWalletCollectible),
    nextOffset: result.nextOffset,
  };
}

// `false` for a domain that points to no wallet; an answer with several records or another domain is not trusted
export async function fetchWalletDomainAddress({ domain }: { domain: string }) {
  const result = await invokeTonApiRequest<DnsRecordsResponse>({
    endpoint: '/api/v3/dns/records',
    query: `domain=${encodeURIComponent(domain)}&limit=2`,
  });

  if (!result?.records || result.error) {
    return undefined;
  }

  const record = result.records.length === 1 ? result.records[0] : undefined;
  const wallet = record?.domain === domain ? record.dns_wallet : undefined;

  return wallet && parseTonTransferAddress(wallet) ? toNonBounceableAddress(wallet) : false;
}

export async function fetchOnrampProviders() {
  const result = await invokeRequest(new GramJs.payments.GetOnrampProviders({
    cryptoCurrency: ONRAMP_CRYPTO_CURRENCY,
  }));

  if (!result) {
    return undefined;
  }

  return result.map(buildApiOnrampProvider);
}

export async function fetchOnrampBaseCurrencies({ provider }: { provider: string }) {
  return invokeRequest(new GramJs.payments.GetOnrampBaseCurrencies({
    provider,
    cryptoCurrency: ONRAMP_CRYPTO_CURRENCY,
  }));
}

export async function fetchOnrampAvailability({
  provider, baseCurrency,
}: {
  provider: string;
  baseCurrency?: string;
}) {
  const result = await invokeRequest(new GramJs.payments.GetOnrampAvailability({
    provider,
    cryptoCurrency: ONRAMP_CRYPTO_CURRENCY,
    baseCurrency,
  }));

  return result && buildApiOnrampAvailability(result);
}

export async function fetchOnrampLimits({
  provider, baseCurrency, paymentMethod,
}: {
  provider: string;
  baseCurrency: string;
  paymentMethod?: string;
}) {
  const result = await invokeRequest(new GramJs.payments.GetOnrampLimits({
    provider,
    cryptoCurrency: ONRAMP_CRYPTO_CURRENCY,
    baseCurrency,
    paymentMethod,
  }));

  return result && buildApiOnrampLimits(result);
}

// Exactly one of `baseAmount` and `cryptoAmount` must be set
export async function fetchOnrampQuote({
  provider, baseCurrency, baseAmount, cryptoAmount, paymentMethod,
}: {
  provider: string;
  baseCurrency: string;
  baseAmount?: string;
  cryptoAmount?: string;
  paymentMethod?: string;
}) {
  const result = await invokeRequest(new GramJs.payments.GetOnrampQuote({
    provider,
    cryptoCurrency: ONRAMP_CRYPTO_CURRENCY,
    baseCurrency,
    baseAmount,
    cryptoAmount,
    paymentMethod,
  }));

  return result && buildApiOnrampQuote(result);
}

export async function createOnrampSession({
  provider, ownAddress, baseCurrency, baseAmount, paymentMethod, memo, theme, successReturnUrl, failReturnUrl,
}: {
  provider: string;
  ownAddress: string;
  baseCurrency?: string;
  baseAmount?: string;
  paymentMethod?: string;
  memo?: string;
  // `dark` or `light`
  theme?: string;
  successReturnUrl?: string;
  failReturnUrl?: string;
}) {
  const result = await invokeRequest(new GramJs.payments.CreateOnrampSession({
    provider,
    cryptoCurrency: ONRAMP_CRYPTO_CURRENCY,
    address: ownAddress,
    baseCurrency,
    baseAmount,
    paymentMethod,
    memo,
    theme,
    successReturnUrl,
    failReturnUrl,
  }));

  return result && buildApiOnrampSession(result);
}

// The body is signed with zeros and `ignore_chksig` lets the node price it before the key is unlocked
export async function estimateWalletTransferFee({
  ownAddress, publicKey, toAddress, amount, comment, shouldEncryptComment, shouldSendAll, collectibleAddress,
}: {
  ownAddress: string;
  publicKey: string;
  toAddress: string;
  // Nanotons
  amount: bigint;
  comment?: string;
  shouldEncryptComment?: boolean;
  shouldSendAll?: boolean;
  collectibleAddress?: string;
}): Promise<ApiWalletTransferFee | undefined> {
  const to = parseTonTransferAddress(toAddress);
  const own = parseTonTransferAddress(ownAddress);
  const collectible = collectibleAddress ? parseTonTransferAddress(collectibleAddress) : undefined;

  if (!to || !own || (collectibleAddress && !collectible) || amount >= MAX_COINS) {
    return undefined;
  }

  const state = await fetchToncenterWalletState(ownAddress);

  if (!state?.isSupportedContract) {
    return undefined;
  }

  const shouldEncrypt = Boolean(comment && shouldEncryptComment && !collectible);
  const canEncryptComment = shouldEncrypt ? Boolean(await fetchRecipientPublicKey(toAddress)) : undefined;

  // The bounce flags are those of `sendWalletTransfer`
  const body = await buildUnsignedTransferBodyBoc(collectible ? {
    to: { ...collectible, isBounceable: true },
    amount: NFT_TRANSFER_ATTACHED_NANOS,
    seqno: state.seqno,
    now: getServerTime(),
    payload: await buildNftTransferPayload({
      newOwner: to, responseDestination: own, forwardAmount: NFT_TRANSFER_FORWARD_NANOS, comment,
    }),
  } : {
    to: { ...to, isBounceable: false },
    amount,
    seqno: state.seqno,
    now: getServerTime(),
    comment: shouldEncrypt ? undefined : comment,
    encryptedComment: shouldEncrypt
      ? new Uint8Array(getEncryptedCommentLength(new TextEncoder().encode(comment).length))
      : undefined,
    shouldSendAll,
  });

  const init = state.isDeployed ? undefined : await buildWalletInitBocs(deserializeBytes(publicKey));
  const fee = await estimateFee(ownAddress, body, init);

  return fee === undefined ? undefined : { fee, canEncryptComment, canUseRelayer: state.isDeployed };
}

// Nanotons, for a body with blank signatures
export async function estimateFee(
  ownAddress: string, body: string, init?: { code: string; data: string },
): Promise<bigint | undefined> {
  const result = await invokeTonApiRequest<EstimateFeeResponse>({
    endpoint: '/api/v3/estimateFee',
    payload: JSON.stringify({
      address: ownAddress,
      body,
      init_code: init?.code,
      init_data: init?.data,
      ignore_chksig: true,
    }),
    isPost: true,
  });

  const fees = result?.source_fees;

  if (!fees || result?.error) {
    return undefined;
  }

  return BigInt((fees.in_fwd_fee || 0) + (fees.storage_fee || 0) + (fees.gas_fee || 0) + (fees.fwd_fee || 0));
}

// Each holder DC keeps one XOR share and re-encrypts it to a key that lives only for this call
export async function exportWalletSecretPhrase({
  ownAddress, ownPublicKey, words, password,
}: {
  ownAddress: string;
  // Absent for a wallet only kept on this device
  ownPublicKey?: string;
  words?: string[];
  password?: string;
}): Promise<ExportSecretPhraseResult> {
  if (words) {
    return (await deriveKeysForWallet(words, ownAddress, ownPublicKey)) ? { words } : { error: 'NO_LOCAL_SECRET' };
  }

  try {
    const parts = await invokeWithPassword(password, (srp) => new GramJs.wallet.ExportSecretPhrase({ password: srp }));

    if (!parts?.dcs.length) {
      return { error: 'EXPORT_FAILED' };
    }

    const ephemeralSeed = generateE2eSeed();
    const publicKey = await getEd25519PublicKey(ephemeralSeed);

    const shares = await Promise.all(parts.dcs.map(async (dcId) => {
      const part = await invokeRequest(
        new GramJs.wallet.FetchEncryptedSecretPhrasePart({ token: parts.token, publicKey }),
        { dcId, shouldThrow: true },
      );
      const payload = await decryptE2eBlob(part!.data, ephemeralSeed);

      return parseDecryptedKeyPart(payload);
    }));

    const combined = xorBytes(shares);

    // Padded with blanks to a fixed width, which hides the word count from the share sizes
    const recombinedWords = new TextDecoder().decode(combined).trim().split(/\s+/);

    if (!(await deriveKeysForWallet(recombinedWords, ownAddress, ownPublicKey))) {
      return { error: 'EXPORT_FAILED' };
    }

    return { words: recombinedWords };
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'WALLET_BACKUP_DISABLED') {
      return { error: 'BACKUP_DISABLED' };
    }

    // A wallet from before the split-parts scheme: the server has no shares to serve, and no retry can help
    if (err instanceof RPCError && err.errorMessage === 'WALLET_BACKUP_PARTS_MISSING') {
      return { error: 'BACKUP_PARTS_MISSING' };
    }

    return { error: mapWalletRpcError(err, 'EXPORT_FAILED') };
  }
}

// The reverse of the export: the words are split into XOR shares, each encrypted to a holder DC's key.
// The server also records the key of a rotation it has not seen yet, since it checks the chain.
export async function enableWalletBackup({
  words, ownAddress,
}: {
  words: string[];
  ownAddress: string;
}): Promise<WalletBackupResult> {
  const seeds = await deriveWalletSeeds(words, ownAddress);

  if (!seeds) {
    return { error: 'WRONG_PHRASE' };
  }

  try {
    const holders = await invokeRequest(new GramJs.wallet.GetBackupHolderDcs(), { shouldThrow: true });

    // Always three shares, as the server splits them. A key of the wrong size would encrypt a share no one can open.
    if (!holders || holders.length !== BACKUP_HOLDER_COUNT
      || holders.some((holder) => holder.publicKey.length !== PUBLIC_KEY_LENGTH)) {
      return { error: 'BACKUP_FAILED' };
    }

    const phraseBytes = padMnemonicBytes(new TextEncoder().encode(words.join(' ')));

    if (!phraseBytes) {
      return { error: 'BACKUP_FAILED' };
    }

    const ephemeralSeed = generateE2eSeed();
    const shares = splitIntoShares(phraseBytes, holders.length);
    const plainParts = shares.map(buildDecryptedKeyPart);
    const parts = await Promise.all(holders.map((holder, index) => (
      encryptE2eBlob(plainParts[index], holder.publicKey, ephemeralSeed)
    )));

    // The challenge is short-lived, so a proof that expired on its way earns one fresh challenge
    const result = await invokeEnableBackup(parts, ownAddress, seeds.signing).catch((err: unknown) => {
      if (err instanceof RPCError && err.errorMessage === 'WALLET_PROOF_EXPIRED') {
        return invokeEnableBackup(parts, ownAddress, seeds.signing);
      }
      throw err;
    });

    if (!result) {
      return { error: 'BACKUP_FAILED' };
    }

    return { state: buildApiWalletStateResult(result) };
  } catch (err: unknown) {
    if (err instanceof RPCError) {
      // The chain holds another key: the phrase is from before a rotation
      if (err.errorMessage === 'WALLET_PROOF_INVALID') return { error: 'PHRASE_OUTDATED' };

      // The chain does not hold this key yet, or the wallet is not deployed
      if (err.errorMessage === 'WALLET_ROTATION_NOT_FOUND') return { error: 'ROTATION_PENDING' };
    }

    return { error: mapWalletRpcError(err, 'BACKUP_FAILED') };
  }
}

async function invokeEnableBackup(parts: Uint8Array<ArrayBuffer>[], ownAddress: string, seed: Uint8Array) {
  return invokeRequest(new GramJs.wallet.EnableBackup({
    parts,
    newPublicKey: await getEd25519PublicKey(seed),
    proof: await buildOwnershipProof(ownAddress, seed),
  }), { shouldThrow: true });
}

// A single-use challenge signed as a TonConnect `ton-proof`; a repeated proof is refused with `WALLET_PROOF_EXPIRED`
async function buildOwnershipProof(address: string, seed: Uint8Array) {
  const challenge = (await invokeRequest(new GramJs.wallet.GetProofChallenge(), { shouldThrow: true }))!;
  const timestamp = getServerTime();
  const signature = await signOwnershipProof({
    address: parseAddress(address)!,
    domain: challenge.domain,
    payload: challenge.payload,
    timestamp,
    seed,
  });

  return new GramJs.WalletOwnershipProof({ timestamp, signature });
}

// The caller keeps the phrase on the device first, or the wallet degrades to watch-only
export async function disableWalletBackup({
  ownAddress, ownPublicKey, words, password,
}: {
  ownAddress: string;
  ownPublicKey: string;
  words: string[];
  password?: string;
}): Promise<WalletBackupResult> {
  const keys = await deriveKeysForWallet(words, ownAddress, ownPublicKey);

  if (!keys) {
    return { error: 'WRONG_PHRASE' };
  }

  try {
    const result = await invokeDisableBackup(ownAddress, keys.seed, password);

    if (!result) {
      return { error: 'BACKUP_FAILED' };
    }

    return { state: buildApiWalletStateResult(result) };
  } catch (err: unknown) {
    return { error: mapWalletRpcError(err, 'BACKUP_FAILED') };
  }
}

// `isSent` tells a failure after the rotation went out from one before it. A rotation that landed earlier
// leaves only the backup to turn off, for which `words` are not needed.
export async function rotateWalletKey({
  ownAddress, words, newWords, pendingSeqno, pendingValidUntil,
}: {
  ownAddress: string;
  words: string[];
  newWords: string[];
  // See `ApiWalletSentTransfer`
  pendingSeqno?: number;
  pendingValidUntil?: number;
}): Promise<RotateWalletKeyResult> {
  // A rotation keeps the anchor key, which only the two-part BIP-39 phrase expresses
  const newSeeds = await deriveWalletSeeds(newWords, ownAddress);

  if (!newSeeds) {
    return { error: 'UNSUPPORTED_WALLET' };
  }

  const newPublicKey = await getEd25519PublicKey(newSeeds.signing);

  const currentPublicKey = await fetchWalletPublicKey(ownAddress);

  if (!currentPublicKey) {
    return { error: 'BACKUP_FAILED' };
  }

  if (!buffersEqual(currentPublicKey, newPublicKey)) {
    // The phrase has to be the one the contract takes now, whatever key the server reports meanwhile
    const keys = await deriveKeysForWallet(words, ownAddress);

    if (!keys || !buffersEqual(keys.publicKey, currentPublicKey)) {
      return { error: 'WRONG_PHRASE' };
    }

    const sent = await sendKeyRotation({
      ownAddress, secretSeed: keys.seed, newSecretSeed: newSeeds.signing, newPublicKey, pendingSeqno, pendingValidUntil,
    });

    if ('error' in sent) {
      return sent;
    }

    // From here on the new key may be the only one the contract accepts
    const isRotated = await waitForWalletPublicKey(ownAddress, newPublicKey, sent.now + TRANSFER_TTL_SECONDS);

    if (!isRotated) {
      return { error: 'BACKUP_FAILED', isSent: true };
    }
  }

  try {
    const result = await invokeDisableBackup(ownAddress, newSeeds.signing);

    return result ? { state: buildApiWalletStateResult(result) } : { error: 'BACKUP_FAILED', isSent: true };
  } catch (err: unknown) {
    return { error: mapWalletRpcError(err, 'BACKUP_FAILED'), isSent: true };
  }
}

// The request takes the wallet's seqno like a transfer does, so it goes out under the same lock
async function sendKeyRotation({
  ownAddress, secretSeed, newSecretSeed, newPublicKey, pendingSeqno, pendingValidUntil,
}: {
  ownAddress: string;
  secretSeed: Uint8Array;
  newSecretSeed: Uint8Array;
  newPublicKey: Uint8Array;
  pendingSeqno?: number;
  pendingValidUntil?: number;
}): Promise<{ now: number } | { error: WalletBackupError }> {
  return runWalletSend(ownAddress, async () => {
    const state = await fetchToncenterWalletState(ownAddress);

    if (!state?.isDeployed || !state.isSupportedContract || state.balance < KEY_ROTATION_MIN_BALANCE) {
      return { error: 'BACKUP_FAILED' };
    }

    if (isTransferPending(ownAddress, state.seqno, pendingSeqno, pendingValidUntil)) {
      return { error: 'BACKUP_FAILED' };
    }

    const now = getServerTime();
    const dataNormal = await buildSignedKeyRotation({
      ownAddress: parseAddress(ownAddress)!,
      seqno: state.seqno,
      now,
      newPublicKey,
      secretSeed,
      newSecretSeed,
    });

    await rememberSentTransfer(ownAddress, state.seqno, now + TRANSFER_TTL_SECONDS);

    try {
      await invokeRequest(new GramJs.wallet.SendTransfer({
        dataNormal, userId: new GramJs.InputUserEmpty(), randomId: generateRandomBigInt(),
      }), {
        shouldThrow: true,
      });
    } catch (err: unknown) {
      // A lost connection leaves the outcome unknown, so the new phrase must stay on the device
      forgetRefusedTransfer(ownAddress, state.seqno, err);

      return { error: mapWalletRpcError(err, 'BACKUP_FAILED'), isSent: err instanceof RPCError ? undefined : true };
    }

    return { now };
  });
}

export async function fetchWalletChainPublicKey({ ownAddress }: { ownAddress: string }): Promise<string | undefined> {
  const publicKey = await fetchWalletPublicKey(ownAddress);

  return publicKey && serializeBytes(publicKey);
}

// Nanotons
export async function estimateWalletKeyRotationFee({
  ownAddress,
}: { ownAddress: string }): Promise<bigint | undefined> {
  const state = await fetchToncenterWalletState(ownAddress);

  if (!state?.isDeployed || !state.isSupportedContract) {
    return undefined;
  }

  const body = await buildUnsignedKeyRotationBodyBoc({
    ownAddress: parseAddress(ownAddress)!,
    seqno: state.seqno,
    now: getServerTime(),
    newPublicKey: new Uint8Array(PUBLIC_KEY_LENGTH),
  });

  return estimateFee(ownAddress, body);
}

async function invokeDisableBackup(ownAddress: string, seed: Uint8Array, password?: string) {
  const newPublicKey = await getEd25519PublicKey(seed);

  return invokeWithPassword(password, async (srp) => new GramJs.wallet.DisableBackup({
    password: srp,
    newPublicKey,
    proof: await buildOwnershipProof(ownAddress, seed),
  }));
}

async function waitForWalletPublicKey(address: string, publicKey: Uint8Array, until: number): Promise<boolean> {
  while (getServerTime() < until + KEY_ROTATION_EXPIRY_MARGIN) {
    await pause(KEY_ROTATION_POLL_INTERVAL);

    const current = await fetchWalletPublicKey(address);

    if (current && buffersEqual(current, publicKey)) {
      return true;
    }
  }

  return false;
}

export async function replaceWallet({
  words, password,
}: {
  words?: string[];
  password?: string;
}): Promise<ReplaceWalletResult> {
  try {
    const seeds = words ? await resolveImportedWalletSeeds(words) : undefined;

    if (words && !seeds) {
      return { error: 'PROOF_INVALID' };
    }

    // The challenge is short-lived, so a proof that expired on its way earns one fresh challenge
    const result = await invokeReplaceWallet(seeds, password).catch((err: unknown) => {
      if (err instanceof RPCError && err.errorMessage === 'WALLET_PROOF_EXPIRED') {
        return invokeReplaceWallet(seeds, password);
      }
      throw err;
    });

    if (!result) {
      return { error: 'REPLACE_FAILED' };
    }

    return { state: buildApiWalletStateResult(result) };
  } catch (err: unknown) {
    return { error: mapWalletRpcError(err, 'REPLACE_FAILED') };
  }
}

// Without `seeds` the server generates a new wallet in place of the current one
function invokeReplaceWallet(seeds: WalletSeeds | undefined, password: string | undefined) {
  return invokeWithPassword(password, async (srp) => new GramJs.wallet.ReplaceWallet({
    wallet: seeds ? await buildInputWalletImported(seeds) : new GramJs.InputWalletNew(),
    password: srp,
  }));
}

async function buildInputWalletImported(seeds: WalletSeeds): Promise<GramJs.InputWalletImported> {
  const publicKey = await getEd25519PublicKey(seeds.signing);
  const anchorPublicKey = await getEd25519PublicKey(seeds.anchor);

  // After a rotation the address still comes from the anchor key, so the server needs both to check the proof
  const isRotated = !buffersEqual(anchorPublicKey, publicKey);

  return new GramJs.InputWalletImported({
    publicKey,
    anchorPublicKey: isRotated ? anchorPublicKey : undefined,
    proof: await buildOwnershipProof(await deriveWalletAddress(anchorPublicKey), seeds.signing),
  });
}

// About one 24-word phrase in 256 reads both as one BIP-39 mnemonic and as the two 12-word halves of a key
// rotation. The chain tells which wallet the phrase was used with; when it cannot, Telegram's format wins.
async function resolveImportedWalletSeeds(words: string[]): Promise<WalletSeeds | undefined> {
  const seeds = await deriveImportedWalletSeeds(words);

  if (!seeds || words.length !== COMPOSITE_WORD_COUNT || !(await isBip39Mnemonic(words))) {
    return seeds;
  }

  const wholeSeeds = await deriveWholeBip39MnemonicSeeds(words);

  if (buffersEqual(wholeSeeds.anchor, seeds.anchor)) {
    return seeds;
  }

  const [compositeState, wholeState] = await Promise.all([seeds, wholeSeeds].map(async (candidate) => (
    fetchToncenterWalletState(await deriveWalletAddress(await getEd25519PublicKey(candidate.anchor)))
  )));

  const [isCompositeUsed, isWholeUsed] = [compositeState, wholeState].map((state) => (
    Boolean(state && (state.isDeployed || state.balance > 0n))
  ));

  return isWholeUsed && !isCompositeUsed ? wholeSeeds : seeds;
}

// The server asks for the password with `PASSWORD_MISSING`, and the first check after that comes back
// `SRP_ID_INVALID` even with the right password, so a fresh id earns one more try, as in TDLib. The request
// is built anew for the retry, so a single-use ownership proof inside it is fresh as well.
async function invokeWithPassword<R extends GramJs.AnyRequest>(
  password: string | undefined,
  buildRequest: (srp?: GramJs.TypeInputCheckPasswordSRP) => R | Promise<R>,
): Promise<R['__response'] | undefined> {
  try {
    return await invokeRequest(await buildRequest(await buildCheckedSrp(password)), { shouldThrow: true });
  } catch (err: unknown) {
    if (!password || !(err instanceof RPCError && err.errorMessage === 'SRP_ID_INVALID')) {
      throw err;
    }
  }

  return invokeRequest(await buildRequest(await buildCheckedSrp(password)), { shouldThrow: true });
}

async function buildCheckedSrp(password: string | undefined) {
  if (!password) {
    return undefined;
  }

  const srp = await getPassword(password);

  if (!srp || 'error' in srp) {
    throw new Error('Password check unavailable');
  }

  return srp;
}

// Without 2FA the destructive wallet methods demand a day-old session, which `SESSION_TOO_FRESH_N` reports
function mapWalletRpcError<T extends string>(
  err: unknown, fallback: T,
): 'PASSWORD_INVALID' | 'PASSWORD_MISSING' | 'SESSION_TOO_FRESH' | T {
  if (err instanceof RPCError) {
    if (err.errorMessage === 'PASSWORD_HASH_INVALID') return 'PASSWORD_INVALID';

    if (err.errorMessage === 'PASSWORD_MISSING') return 'PASSWORD_MISSING';

    if (err.errorMessage.startsWith('SESSION_TOO_FRESH')) return 'SESSION_TOO_FRESH';
  }

  return fallback;
}

export async function decryptWalletComment({
  encryptedComment, saltAddress, ownAddress, ownPublicKey, words, password,
}: {
  // Base64
  encryptedComment: string;
  saltAddress: string;
  ownAddress: string;
  ownPublicKey: string;
  words?: string[];
  password?: string;
}): Promise<DecryptWalletCommentResult> {
  const sender = parseAddress(saltAddress);

  if (!sender) {
    return { error: 'DECRYPT_FAILED' };
  }

  const exported = await exportWalletSecretPhrase({
    ownAddress, ownPublicKey, words, password,
  });

  if ('error' in exported) {
    return exported;
  }

  const keys = await deriveKeysForWallet(exported.words, ownAddress, ownPublicKey);

  if (!keys) {
    return { error: 'UNSUPPORTED_WALLET' };
  }

  // Salted with the sender's bounceable address
  const salt = new TextEncoder().encode(formatAddress(sender.workchain, sender.hash, true));
  const payload = bufferFromBase64(encryptedComment);

  const comment = await tryDecryptComment(payload, keys, salt);

  if (comment !== undefined) {
    return { comment };
  }

  // The comment may be sealed to a key this wallet has rotated away from since
  for (const previousKeys of await loadPreviousSigningKeys(ownAddress, keys)) {
    const previousComment = await tryDecryptComment(payload, previousKeys, salt);

    if (previousComment !== undefined) {
      return { comment: previousComment };
    }
  }

  return { error: 'DECRYPT_FAILED' };
}

async function tryDecryptComment(payload: Uint8Array, keys: WalletKeys, salt: Uint8Array<ArrayBuffer>) {
  try {
    return await decryptMessageComment(payload, keys.publicKey, keys.seed, salt);
  } catch {
    return undefined;
  }
}

async function loadPreviousSigningKeys(ownAddress: string, currentKeys: WalletKeys): Promise<WalletKeys[]> {
  const cacheKey = `${toRawAddress(ownAddress)!}:${bufferToHex(currentKeys.publicKey)}`;
  const cached = previousSigningKeysCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const changes = await fetchWalletKeyChanges(ownAddress);
  const keys = changes ? await recoverPreviousSigningKeys(currentKeys, changes) : [];

  // A failed or not yet indexed history is tried again on the next comment, so nothing stale is cached
  if (keys.length) {
    previousSigningKeysCache.set(cacheKey, keys);
  }

  return keys;
}

// Walks the history back from the current key; returns nothing when the history does not list it yet
async function recoverPreviousSigningKeys(
  currentKeys: WalletKeys, changes: WalletKeyChange[],
): Promise<WalletKeys[]> {
  if (!changes.length || !buffersEqual(changes[0].newPublicKey, currentKeys.publicKey)) {
    return [];
  }

  const keys: WalletKeys[] = [];
  let seed = currentKeys.seed;
  let change: WalletKeyChange | undefined = changes[0];

  // The history's length bounds the walk even when two records name the same key
  for (let step = 0; step < changes.length && change?.encryptedOldSeed; step++) {
    seed = await encryptPreviousSigningSeed(change.encryptedOldSeed, seed);

    const publicKey = await getEd25519PublicKey(seed);
    keys.push({ seed, publicKey });
    change = changes.find((item) => buffersEqual(item.newPublicKey, publicKey));
  }

  return keys;
}

// `undefined` when a page fails to load, since a partial history would cut the chain short
async function fetchWalletKeyChanges(ownAddress: string): Promise<WalletKeyChange[] | undefined> {
  const changes: WalletKeyChange[] = [];

  for (let offset = 0; ; offset += KEY_CHANGES_PAGE_SIZE) {
    const result = await invokeTonApiRequest<WalletKeyChangesResponse>({
      endpoint: '/api/v3/actions',
      query: `account=${encodeURIComponent(ownAddress)}&action_type=change_wallet_key`
        + `&limit=${KEY_CHANGES_PAGE_SIZE}&offset=${offset}`,
    });

    if (!result || result.error) {
      return undefined;
    }

    const actions = result.actions;

    if (!actions?.length) {
      break;
    }

    for (const { details } of actions) {
      if (!details?.new_public_key) continue;

      changes.push({
        newPublicKey: bufferFromHex(details.new_public_key),
        encryptedOldSeed: details.encrypted_old_private_key
          ? bufferFromHex(details.encrypted_old_private_key)
          : undefined,
      });
    }

    if (actions.length < KEY_CHANGES_PAGE_SIZE) {
      break;
    }
  }

  return changes;
}

export async function sendTonTransfer({
  toAddress, toUser, chat, lastMessageId, amount, comment, shouldEncryptComment, shouldSendAll, collectibleAddress,
  isGasless, ownAddress, ownPublicKey, pendingSeqno, pendingValidUntil, words, password,
}: {
  toAddress: string;
  // Once the chain shows the transfer reached them, the server names each side to the other
  toUser?: ApiUser;
  chat?: ApiChat;
  lastMessageId?: number;
  // Nanotons; ignored for a collectible, which always carries `NFT_TRANSFER_ATTACHED_NANOS`
  amount: bigint;
  comment?: string;
  shouldEncryptComment?: boolean;
  shouldSendAll?: boolean;
  // A collectible's comment cannot be encrypted and goes as plain text
  collectibleAddress?: string;
  // A transfer the relayer turns down is not sent at the user's expense instead
  isGasless?: boolean;
  ownAddress: string;
  ownPublicKey: string;
  // See `ApiWalletSentTransfer`
  pendingSeqno?: number;
  pendingValidUntil?: number;
  words?: string[];
  password?: string;
}, onLocalMessage?: NoneToVoidFunction): Promise<SendTonTransferResult | undefined> {
  const collectible = collectibleAddress ? parseTonTransferAddress(collectibleAddress) : undefined;

  if (collectible) {
    amount = NFT_TRANSFER_ATTACHED_NANOS;
  }

  if (amount <= 0n || amount >= MAX_COINS) {
    return { error: 'SEND_FAILED' };
  }

  const own = parseTonTransferAddress(ownAddress);
  const to = parseTonTransferAddress(toAddress);

  if (!own || !to || (collectibleAddress && !collectible)) {
    return { error: 'INVALID_ADDRESS' };
  }

  const exported = await exportWalletSecretPhrase({
    ownAddress, ownPublicKey, words, password,
  });

  if ('error' in exported) {
    return exported;
  }

  const seeds = await deriveWalletSeeds(exported.words, ownAddress, ownPublicKey);

  if (!seeds) {
    return { error: 'UNSUPPORTED_WALLET' };
  }

  const keys = { seed: seeds.signing, publicKey: await getEd25519PublicKey(seeds.signing) };

  // The address, and so the state init of a wallet not deployed yet, comes from the anchor key
  const anchorPublicKey = await getEd25519PublicKey(seeds.anchor);

  let encryptedComment: Uint8Array<ArrayBuffer> | undefined;

  if (comment && shouldEncryptComment && !collectible) {
    const theirPublicKey = await fetchRecipientPublicKey(toAddress);

    if (!theirPublicKey) {
      return { error: 'COMMENT_ENCRYPTION_UNAVAILABLE' };
    }

    // The receiver checks the salt as the bounceable address, see `decryptWalletComment`
    const salt = new TextEncoder().encode(formatAddress(own.workchain, own.hash, true));
    encryptedComment = await encryptMessageComment(comment, keys.publicKey, keys.seed, theirPublicKey, salt);
  }

  const encryptedCommentBase64 = encryptedComment && bufferToBase64(encryptedComment);
  const randomId = generateRandomBigInt();
  const localMessage = chat && buildLocalMessage({
    chat,
    lastMessageId,
    action: {
      mediaType: 'action',
      type: 'gramTransfer',
      amount,
      peerAddress: toAddress,
      transactionId: '',
      comment: encryptedComment ? undefined : comment,
      encryptedComment: encryptedCommentBase64,
    },
    isPending: true,
  }).message;

  if (localMessage) {
    sendApiUpdate({
      '@type': 'newMessage', id: localMessage.id, chatId: localMessage.chatId, message: localMessage,
    });
    onLocalMessage?.();
  }

  const sending = runWalletSend<SendTonTransferResult | undefined>(ownAddress, async () => {
    const state = await fetchToncenterWalletState(ownAddress);

    if (!state) {
      return undefined;
    }

    if (!state.isSupportedContract) {
      return { error: 'UNSUPPORTED_WALLET' };
    }

    if (isTransferPending(ownAddress, state.seqno, pendingSeqno, pendingValidUntil)) {
      return { error: 'TRANSFER_PENDING' };
    }

    // Checked under the lock: another tab may have handed the item over meanwhile
    if (collectibleAddress) {
      const itemError = await checkCollectibleTransferable(collectibleAddress, ownAddress);

      if (itemError) {
        return { error: itemError };
      }
    }

    // Sending everything takes the fees out of the value, so no reserve is needed. It only applies to the
    // balance the user confirmed: a balance grown since sends exactly the shown amount the ordinary way.
    const isSendingAll = Boolean(shouldSendAll) && !collectible && state.balance === amount;

    // The relayer cannot carry the state init, so a wallet not deployed yet pays for its own deployment
    if (isGasless && !state.isDeployed) {
      return { error: 'GASLESS_UNAVAILABLE' };
    }

    // A bounceable message to an account with no code comes straight back with the fees spent, so a plain
    // transfer never bounces and a wallet not deployed yet gets its first coins. The item contract must
    // return the value if it refuses the call.
    const transfer = collectible ? {
      to: { ...collectible, isBounceable: true },
      amount,
      seqno: state.seqno,
      now: getServerTime(),
      secretSeed: keys.seed,
      payload: await buildNftTransferPayload({
        newOwner: to, responseDestination: own, forwardAmount: NFT_TRANSFER_FORWARD_NANOS, comment,
      }),
    } : {
      to: { ...to, isBounceable: false },
      amount,
      seqno: state.seqno,
      now: getServerTime(),
      secretSeed: keys.seed,
      comment: encryptedComment ? undefined : comment,
      encryptedComment,
      shouldSendAll: isSendingAll,
    };

    // A comment or a collectible payload can cost more than the fixed reserve, which stays as the floor
    const fee = isSendingAll ? undefined : await estimateFee(
      ownAddress,
      await buildUnsignedTransferBodyBoc(transfer),
      state.isDeployed ? undefined : await buildWalletInitBocs(anchorPublicKey),
    );
    const reserve = getBigIntMax(fee ?? 0n, GRAM_TRANSFER_FEE_RESERVE);

    if (state.balance < (isSendingAll ? amount : amount + reserve)) {
      return { error: 'INSUFFICIENT_FUNDS' };
    }

    const dataNormal = await buildSignedTransfer({
      ...transfer, ownAddress: own, publicKey: anchorPublicKey, shouldDeploy: !state.isDeployed,
    });

    // The server broadcasts whichever of the two it chooses, and the shared seqno lets only one execute.
    // The relayer takes no state init, collectible transfers or transfers to the wallet itself.
    const isSelfTransfer = toRawAddress(toAddress) === toRawAddress(ownAddress);
    const dataGasless = state.isDeployed && !collectible && !isSelfTransfer
      ? await buildSignedGaslessTransfer({ ...transfer, ownAddress: own })
      : undefined;

    const validUntil = transfer.now + TRANSFER_TTL_SECONDS;
    await rememberSentTransfer(ownAddress, transfer.seqno, validUntil);

    try {
      const result = await sendTransferData(dataNormal, dataGasless, randomId, toUser, localMessage);
      const sent = buildApiWalletSentTransfer(result, { seqno: transfer.seqno, validUntil });

      return sent ? { ...sent, encryptedComment: encryptedCommentBase64 } : { error: 'SEND_FAILED' };
    } catch (err: unknown) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error(`[wallet] The transfer was refused: ${err instanceof RPCError ? err.errorMessage : String(err)}`);
      }

      forgetRefusedTransfer(ownAddress, transfer.seqno, err);

      if (isGasless && isRelayerRefusal(err, dataGasless)) {
        return { error: 'GASLESS_UNAVAILABLE' };
      }

      // The wallet key was changed outside this app, so the phrase no longer signs for it
      if (err instanceof RPCError && err.errorMessage === 'WALLET_KEY_MISMATCH') {
        return { error: 'KEY_MISMATCH' };
      }

      return { error: 'SEND_FAILED' };
    }
  });

  let outcome: SendTonTransferResult | undefined;

  try {
    outcome = await sending;
  } finally {
    if (localMessage && (!outcome || 'error' in outcome)) {
      sendApiUpdate({
        '@type': 'updateMessageSendFailed',
        chatId: localMessage.chatId,
        localId: localMessage.id,
        error: outcome?.error ?? 'SEND_FAILED',
      });
    }
  }

  return outcome;
}

async function checkCollectibleTransferable(
  collectibleAddress: string, ownAddress: string,
): Promise<SendTonTransferError | undefined> {
  const result = await invokeTonApiRequest<NftItemsResponse>({
    endpoint: '/api/v3/nft/items',
    query: `address=${encodeURIComponent(collectibleAddress)}&limit=1`,
  });
  const item = result?.nft_items?.[0];

  if (!item || result?.error || toRawAddress(item.address) !== toRawAddress(collectibleAddress)) {
    return 'NFT_UNAVAILABLE';
  }

  if (item.init === false) {
    return 'NFT_NOT_INITIALIZED';
  }

  if (item.on_sale || item.sale_contract_address || item.auction_contract_address) {
    return 'NFT_ON_SALE';
  }

  if (!item.owner_address || toRawAddress(item.owner_address) !== toRawAddress(ownAddress)) {
    return 'NFT_NOT_OWNED';
  }

  return undefined;
}

// Two transfers prepared side by side would both pass the seqno check and go out on the same seqno, of
// which the contract executes only one. The lock is shared by the workers of every tab.
export async function runWalletSend<T>(ownAddress: string, send: () => Promise<T>): Promise<T> {
  const rawAddress = toRawAddress(ownAddress)!;
  await restoreSentTransfers();

  return navigator.locks.request(`${SEND_LOCK_PREFIX}${rawAddress}`, async () => {
    await syncSentTransfer(rawAddress);

    return send();
  });
}

// Each tab's worker keeps its own copy; only IndexedDB is shared, so it is read once the lock is held
async function syncSentTransfer(rawAddress: string) {
  try {
    const sent = await WALLET_IDB_STORE.get<SentTransfer>(`${SENT_TRANSFER_KEY_PREFIX}${rawAddress}`);

    if (sent && sent.validUntil > getServerTime()) {
      sentTransfers.set(rawAddress, sent);
    } else {
      sentTransfers.delete(rawAddress);
    }
  } catch {
    // The copy on hand is the best there is
  }
}

function restoreSentTransfers(): Promise<void> {
  sentTransfersRestored ||= (async () => {
    const now = getServerTime();
    const entries = await WALLET_IDB_STORE.entries().catch(() => []) as [string, SentTransfer][];

    for (const [key, sent] of entries) {
      if (!key.startsWith(SENT_TRANSFER_KEY_PREFIX)) continue;

      if (sent.validUntil > now) {
        sentTransfers.set(key.slice(SENT_TRANSFER_KEY_PREFIX.length), sent);
      } else {
        void WALLET_IDB_STORE.del(key).catch(() => undefined);
      }
    }
  })();

  return sentTransfersRestored;
}

// Written before the broadcast: a request whose answer got lost may still have gone out
export async function rememberSentTransfer(ownAddress: string, seqno: number, validUntil: number) {
  const rawAddress = toRawAddress(ownAddress)!;
  sentTransfers.set(rawAddress, { seqno, validUntil });
  await WALLET_IDB_STORE.set(`${SENT_TRANSFER_KEY_PREFIX}${rawAddress}`, { seqno, validUntil }).catch(() => undefined);
}

// Only the server's own refusal means the message never went out; a timeout or a lost connection
// leaves it unknown, and the record stays until it expires
export function forgetRefusedTransfer(ownAddress: string, seqno: number, err: unknown) {
  if (!(err instanceof RPCError)) return;

  const rawAddress = toRawAddress(ownAddress)!;
  if (sentTransfers.get(rawAddress)?.seqno !== seqno) return;

  sentTransfers.delete(rawAddress);
  void WALLET_IDB_STORE.del(`${SENT_TRANSFER_KEY_PREFIX}${rawAddress}`).catch(() => undefined);
}

// A second message now would go out on the next seqno and spend twice once the first executes
export function isTransferPending(
  ownAddress: string, seqno: number, pendingSeqno?: number, pendingValidUntil?: number,
) {
  const now = getServerTime();
  const sent = sentTransfers.get(toRawAddress(ownAddress)!);

  return (seqno === pendingSeqno && pendingValidUntil !== undefined && now < pendingValidUntil)
    || (seqno === sent?.seqno && now < sent.validUntil);
}

// The server broadcasts whichever message of the pair it chooses
export async function sendTransferData(
  dataNormal: Uint8Array<ArrayBuffer>, dataGasless: Uint8Array<ArrayBuffer> | undefined, randomId: bigint,
  toUser?: ApiUser, localMessage?: ApiMessage,
): Promise<GramJs.TypeUpdates> {
  const result = await invokeRequest(new GramJs.wallet.SendTransfer({
    dataNormal,
    dataGasless,
    userId: toUser ? buildInputUser(toUser.id, toUser.accessHash) : new GramJs.InputUserEmpty(),
    randomId,
  }), {
    shouldThrow: true,
    // The answer carries the server's copy of the local message, so the chat would show the transfer twice
    // if it were applied before the local message takes the server's id
    shouldIgnoreUpdates: Boolean(localMessage),
  });

  if (!result) {
    throw new Error('SEND_FAILED');
  }

  if (localMessage) {
    const hasMessageId = 'updates' in result
      && result.updates.some((update) => update instanceof GramJs.UpdateMessageID);

    // Without `UpdateMessageID` nothing replaces the local message, and it would stay in the sending state
    if (!hasMessageId) {
      sendApiUpdate({ '@type': 'deleteMessages', ids: [localMessage.id], chatId: localMessage.chatId });
    }

    handleLocalMessageUpdate(localMessage, result);
  }

  return result;
}

function isRelayerRefusal(err: unknown, dataGasless: Uint8Array | undefined) {
  return Boolean(dataGasless) && err instanceof RPCError && err.errorMessage === 'WALLET_TRANSFER_SEND_FAILED';
}

// The phrase must derive to the account's `WalletTg` address and, when the server's key is known, sign
// with it: a phrase left behind by a rotation on another device lands on the address but cannot sign
async function deriveKeysForWallet(
  words: string[], ownAddress: string, ownPublicKey?: string,
): Promise<WalletKeys | undefined> {
  const seeds = await deriveWalletSeeds(words, ownAddress, ownPublicKey);

  return seeds && { seed: seeds.signing, publicKey: await getEd25519PublicKey(seeds.signing) };
}

export async function validateWalletPhrase({ words, ownAddress, ownPublicKey }: {
  words: string[];
  ownAddress?: string;
  ownPublicKey?: string;
}): Promise<boolean> {
  return Boolean(ownAddress
    ? await deriveWalletSeeds(words, ownAddress, ownPublicKey)
    : await deriveImportedWalletSeeds(words));
}

export async function derivePhraseWalletAddress({ words }: { words: string[] }): Promise<string | undefined> {
  const seeds = await deriveImportedWalletSeeds(words);

  return seeds && deriveWalletAddress(await getEd25519PublicKey(seeds.anchor));
}

export async function deriveWalletSeeds(
  words: string[], ownAddress: string, ownPublicKey?: string,
): Promise<WalletSeeds | undefined> {
  const own = parseAddress(ownAddress);

  if (!own) {
    return undefined;
  }

  // A wallet brought from outside has either a BIP-39 or a tonlib phrase; the address check picks the scheme
  const schemes = [deriveBip39MnemonicSeeds, deriveTonMnemonicSeeds];
  if (words.length === COMPOSITE_WORD_COUNT) schemes.push(deriveWholeBip39MnemonicSeeds);

  for (const deriveSeeds of schemes) {
    const seeds = await deriveSeeds(words);
    const derived = parseAddress(await deriveWalletAddress(await getEd25519PublicKey(seeds.anchor)));

    if (!derived || derived.workchain !== own.workchain || !buffersEqual(derived.hash, own.hash)) {
      continue;
    }

    const publicKey = await getEd25519PublicKey(seeds.signing);

    if (ownPublicKey && !buffersEqual(publicKey, deserializeBytes(ownPublicKey))) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('[wallet] The phrase lands on the address, but its signing key is not the one the server reports');
      }

      return undefined;
    }

    return seeds;
  }

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.warn(
      `[wallet] The exported phrase (${words.length} words) derives to a different address than the server reports`,
    );
  }

  return undefined;
}

// GramJS reads TL strings as UTF-8 text, which mangles random bytes, so the share is read by hand
function parseDecryptedKeyPart(payload: Uint8Array): Uint8Array {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

  if (payload.length <= TL_ID_LENGTH || view.getUint32(0, true) !== DECRYPTED_KEY_PART_ID) {
    throw new Error('Unexpected secret phrase part payload');
  }

  let offset = TL_ID_LENGTH;
  let length = payload[offset];
  offset += 1;

  if (length === TL_LONG_STRING_MARKER) {
    if (payload.length < offset + 3) {
      throw new Error('Unexpected secret phrase part payload');
    }

    length = payload[offset] + (payload[offset + 1] << 8) + (payload[offset + 2] << 16);
    offset += 3;
  }

  if (offset + length > payload.length) {
    throw new Error('Unexpected secret phrase part payload');
  }

  return payload.slice(offset, offset + length);
}

// A phrase longer than the server's fixed width cannot be the server's, so there is nothing to back up
function padMnemonicBytes(phraseBytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (phraseBytes.length > MNEMONIC_PADDED_LENGTH) {
    return undefined;
  }

  const padded = new Uint8Array(MNEMONIC_PADDED_LENGTH).fill(MNEMONIC_PADDING_BYTE);
  padded.set(phraseBytes);

  return padded;
}

// Any subset short of the full set reveals nothing
function splitIntoShares(secret: Uint8Array, count: number): Uint8Array[] {
  const shares = Array.from({ length: count - 1 }, () => crypto.getRandomValues(new Uint8Array(secret.length)));
  const last = secret.map((byte, index) => shares.reduce((sum, share) => sum ^ share[index], byte));

  return [...shares, last];
}

function buildDecryptedKeyPart(share: Uint8Array): Uint8Array<ArrayBuffer> {
  const isLong = share.length >= TL_LONG_STRING_MARKER;
  const headerLength = TL_ID_LENGTH + (isLong ? 4 : 1);
  const result = new Uint8Array(Math.ceil((headerLength + share.length) / 4) * 4);
  new DataView(result.buffer).setUint32(0, DECRYPTED_KEY_PART_ID, true);

  if (isLong) {
    result[TL_ID_LENGTH] = TL_LONG_STRING_MARKER;
    result[TL_ID_LENGTH + 1] = share.length & 0xff;
    result[TL_ID_LENGTH + 2] = (share.length >> 8) & 0xff;
    result[TL_ID_LENGTH + 3] = (share.length >> 16) & 0xff;
  } else {
    result[TL_ID_LENGTH] = share.length;
  }

  result.set(share, headerLength);

  return result;
}

function xorBytes(parts: Uint8Array[]): Uint8Array {
  const [first, ...rest] = parts;

  if (rest.some((part) => part.length !== first.length)) {
    throw new Error('Mismatched secret phrase parts');
  }

  return first.map((byte, index) => rest.reduce((sum, part) => sum ^ part[index], byte));
}

// Nanotons by raw address; toncenter leaves out the addresses the chain has never seen
export async function fetchWalletBalances({ addresses }: { addresses: string[] }) {
  const result = await invokeTonApiRequest<AccountStatesResponse>({
    endpoint: '/api/v3/accountStates',
    query: addresses.map((address) => `address=${encodeURIComponent(address)}`).join('&'),
  });

  if (!result || result.error) {
    return undefined;
  }

  const balancesByRaw = Object.fromEntries((result.accounts || []).map((account) => (
    [account.address?.toLowerCase(), BigInt(account.balance || 0)]
  )));

  return Object.fromEntries(addresses.map((address) => [address, balancesByRaw[toRawAddress(address)!] ?? 0n]));
}

// A wallet that is not deployed has no getter to ask and is left out
export async function fetchWalletPublicKeys({ addresses }: { addresses: string[] }) {
  const keys = await Promise.all(addresses.map(fetchWalletPublicKey));

  return Object.fromEntries(addresses.flatMap((address, index) => (
    keys[index] ? [[address, serializeBytes(keys[index])]] : []
  )));
}

// Toncenter does not recognize `WalletTg` as a wallet, so the state comes from the raw account and
// the seqno from the contract's getter
export async function fetchToncenterWalletState(address: string) {
  const result = await invokeTonApiRequest<AccountStatesResponse>({
    endpoint: '/api/v3/accountStates',
    query: `address=${encodeURIComponent(address)}`,
  });

  if (!result || result.error) {
    return undefined;
  }

  const account = result.accounts?.[0];

  // Toncenter omits accounts the chain has never seen: a fresh wallet
  if (!account) {
    return {
      isDeployed: false, seqno: 0, balance: 0n, isSupportedContract: true,
    };
  }

  const isDeployed = account.status === 'active';
  const isSupportedContract = !isDeployed || account.code_hash === WALLET_TG_CODE_HASH;

  // A foreign contract has no `seqno` getter
  const seqno = isDeployed && isSupportedContract ? await fetchWalletSeqno(address) : 0;

  if (seqno === undefined) {
    return undefined;
  }

  // `number` would round a balance past `Number.MAX_SAFE_INTEGER` nanotons
  return {
    isDeployed,
    seqno,
    balance: BigInt(account.balance || 0),
    isSupportedContract,
  };
}

async function fetchWalletSeqno(address: string): Promise<number | undefined> {
  const value = await runWalletGetter(address, 'seqno');

  return value === undefined ? undefined : Number(value);
}

// The server also knows the key of a wallet not deployed yet
async function fetchRecipientPublicKey(address: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const result = await fetchWalletUserAddresses({ addresses: [address] });
  const recipient = result && !('error' in result) ? result.byAddress[toNonBounceableAddress(address)] : undefined;

  if (recipient && recipient.publicKey) {
    return deserializeBytes(recipient.publicKey);
  }

  return fetchWalletPublicKey(address);
}

async function fetchWalletPublicKey(address: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const value = await runWalletGetter(address, 'get_public_key');

  if (value === undefined) {
    return undefined;
  }

  return bufferFromHex(BigInt(value).toString(16).padStart(PUBLIC_KEY_LENGTH * 2, '0'));
}

async function runWalletGetter(address: string, method: string): Promise<string | undefined> {
  const result = await invokeTonApiRequest<RunGetMethodResponse>({
    endpoint: '/api/v3/runGetMethod',
    payload: JSON.stringify({ address, method, stack: [] }),
    isPost: true,
  });

  const value = result?.stack?.[0]?.value;

  return result?.error || result?.exit_code !== 0 ? undefined : value;
}

// Toncenter answers with no row at all for an address never used; `undefined` means it could not be asked
export async function checkIsAddressActive(address: string): Promise<boolean | undefined> {
  const result = await invokeTonApiRequest<AccountStatesResponse>({
    endpoint: '/api/v3/accountStates',
    query: `address=${encodeURIComponent(address)}`,
  });

  if (!result || result.error) {
    return undefined;
  }

  return result.accounts?.[0]?.status === 'active';
}

// `endpoint` is a full path from https://toncenter.com/api/v3/index.html, e.g. `/api/v3/masterchainInfo`;
// a bare name is rejected with `ENDPOINT_INVALID`
async function invokeTonApiRequest<T = AnyLiteral>({
  endpoint, query, payload, isPost,
}: {
  endpoint: string;
  query?: string;
  payload?: string;
  isPost?: boolean;
}): Promise<T | undefined> {
  const dcId = await getClient().getWebfileDcId();

  const result = await invokeRequest(new GramJs.toncenter.PerformApiRequest({
    post: isPost || undefined,
    endpoint,
    query,
    payload,
  }), { dcId });

  if (!result) {
    return undefined;
  }

  // A proxy error can return HTML instead of JSON
  try {
    return JSON.parse(result.response.data) as T;
  } catch {
    return undefined;
  }
}

export function watchWalletActivity({ address }: { address: string }) {
  watchAddressActivity({
    address,
    fetchUrl: fetchStreamingUrl,
    onActivity: () => sendApiUpdate({ '@type': 'updateWalletActivity' }),
  });
}

export function unwatchWalletActivity() {
  unwatchAddressActivity();
}

async function fetchStreamingUrl() {
  // A failure is retried by the stream, so it must not reach the user as an error dialog
  const streaming = await invokeRequest(new GramJs.toncenter.GetStreamingUrl(), { shouldIgnoreErrors: true });

  // The URL carries a secret that stops working at `expires`
  return streaming && { url: streaming.url, lifetimeMs: (streaming.expires - getServerTime()) * 1000 };
}
