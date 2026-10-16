import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiOnrampAvailability,
  ApiOnrampLimits,
  ApiOnrampProvider,
  ApiOnrampQuote,
  ApiOnrampSession,
  ApiTonConnectRequest,
  ApiTonConnectSession,
  ApiWalletCollectible,
  ApiWalletGaslessInfo,
  ApiWalletSentTransfer,
  ApiWalletStateResult,
  ApiWalletTransaction,
  ApiWalletTransactionPeer,
} from '../../types';

import { toNonBounceableAddress } from '../../../lib/ton/address';
import { getBigIntAbs } from '../../../util/numbers';
import { addWebDocumentToLocalDb } from '../helpers/localDb';
import { serializeBytes } from '../helpers/misc';
import { buildApiWebDocument } from './messageContent';
import { buildApiPeerId } from './peers';

const MODEL_TRAIT = 'Model';
const FRAGMENT_NFT_HOST = 'nft.fragment.com';
const FRAGMENT_URL = 'https://fragment.com';
const FRAGMENT_METADATA_EXTENSION = '.json';
const BACKDROP_TRAIT = 'Backdrop';
// Fragment puts the item type in the first segment of its metadata and image paths
const FRAGMENT_TYPES = ['gift', 'username', 'number'] as const;

export function buildApiTonConnectSession(session: GramJs.TonConnectSession): ApiTonConnectSession {
  if (session.manifest?.icon) {
    addWebDocumentToLocalDb(session.manifest.icon);
  }

  return {
    id: session.id.toString(),
    dappClientId: session.dappClientId,
    clientId: session.clientId,
    nonce: serializeBytes(session.nonce),
    manifest: session.manifest && {
      url: session.manifest.url,
      name: session.manifest.name,
      icon: buildApiWebDocument(session.manifest.icon),
    },
    manifestError: session.manifestError,
    isPending: session.pending,
    isClosing: session.closing,
    isClosed: session.closed,
    date: session.date,
  };
}

export function buildApiTonConnectRequest(request: GramJs.TonConnectRequest): ApiTonConnectRequest {
  return {
    sessionId: request.sessionId.toString(),
    msgId: request.msgId,
    body: serializeBytes(request.body),
    expires: request.expires,
    topic: request.topic,
    traceId: request.traceId,
  };
}

// An empty state without the `creating` flag is treated the same: the wallet is on its way either way
export function buildApiWalletStateResult(state: GramJs.TypeWalletState): ApiWalletStateResult {
  if (!(state instanceof GramJs.WalletState)) {
    return { status: 'provisioning' };
  }

  return {
    status: 'ready',
    state: {
      address: toNonBounceableAddress(state.address),
      publicKey: serializeBytes(state.publicKey),
      balance: state.balance,
      isBackupEnabled: state.backupEnabled,
      canExportPhrase: state.canExportPhrase,
      canEnableBackup: state.canEnableBackup,
    },
  };
}

export function buildApiWalletTransaction(transaction: GramJs.WalletTransaction): ApiWalletTransaction {
  // With the flag set, `comment` holds the base64 payload
  const isCommentEncrypted = transaction.commentEncrypted;

  return {
    id: transaction.id,
    isIncoming: Boolean(transaction.incoming),
    isFailed: transaction.failed,
    isGasless: transaction.gasless,
    isKeyChange: transaction.keyChange,
    peer: buildApiWalletTransactionPeer(transaction.peer),
    // The server signs the amount by direction, but `ApiWalletTransaction` keeps it positive
    amount: getBigIntAbs(transaction.amount),
    fee: transaction.fee,
    comment: isCommentEncrypted ? undefined : transaction.comment,
    encryptedComment: isCommentEncrypted ? transaction.comment : undefined,
    txHash: transaction.txHash,
    timestamp: transaction.date,
    collectible: transaction.nft && buildApiWalletCollectible(transaction.nft),
  };
}

function buildApiWalletTransactionPeer(peer: GramJs.TypeWalletTransactionPeer): ApiWalletTransactionPeer {
  if (peer instanceof GramJs.WalletTransactionPeerUser) {
    return {
      type: 'user',
      userId: buildApiPeerId(peer.userId, 'user'),
      address: toNonBounceableAddress(peer.address),
      domain: peer.domain,
    };
  }

  if (peer instanceof GramJs.WalletTransactionPeerAddress) {
    return { type: 'address', address: toNonBounceableAddress(peer.address), domain: peer.domain };
  }

  if (peer instanceof GramJs.WalletTransactionPeerOnramp) {
    return {
      type: 'onramp',
      address: toNonBounceableAddress(peer.address),
      domain: peer.domain,
      providerName: peer.providerName,
    };
  }

  return { type: 'unsupported' };
}

// The outcome travels inside the `Updates` answer; the other updates in it are dispatched as usual
export function buildApiWalletSentTransfer(
  updates: GramJs.TypeUpdates, { seqno, validUntil }: { seqno: number; validUntil: number },
): ApiWalletSentTransfer | undefined {
  const sent = 'updates' in updates
    ? updates.updates.find((update) => update instanceof GramJs.UpdateSentWalletTransaction)
    : 'update' in updates && updates.update instanceof GramJs.UpdateSentWalletTransaction
      ? updates.update
      : undefined;

  if (!sent) {
    return undefined;
  }

  return {
    msgHash: sent.msgHash,
    seqno,
    validUntil,
    isGasless: sent.gasless,
    transaction: sent.transaction && buildApiWalletTransaction(sent.transaction),
  };
}

export function buildApiWalletGaslessInfo(info: GramJs.UpdateWalletGaslessInfo): ApiWalletGaslessInfo {
  return {
    isAvailable: info.available,
    left: info.left,
    resetAt: info.resetAt,
    minAmount: info.minAmount,
  };
}

export function buildApiWalletCollectible(item: GramJs.wallet.NftItem): ApiWalletCollectible {
  const {
    address, name, description, attributes, contentUrl,
  } = item;

  // Only a proxied document is shown, so the client never reaches the NFT host itself
  const image = item.image instanceof GramJs.WebDocument ? item.image : undefined;
  const imageSmall = item.imageSmall instanceof GramJs.WebDocument ? item.imageSmall : undefined;
  if (image) addWebDocumentToLocalDb(image);

  if (imageSmall) addWebDocumentToLocalDb(imageSmall);

  const base = {
    address,
    name,
    description,
    attributes: attributes?.map(({ traitType, value }) => ({ traitType, value })),
    image: buildApiWebDocument(image),
    imageSmall: buildApiWebDocument(imageSmall),
    // An item without a page of its own is sold from the Fragment home page
    fragmentUrl: buildFragmentUrl(contentUrl?.url) || FRAGMENT_URL,
  };
  const type = getCollectibleType(contentUrl?.url, item.image?.url);

  if (type !== 'gift') {
    return { ...base, type };
  }

  return {
    ...base,
    type,
    model: attributes?.find(({ traitType }) => traitType === MODEL_TRAIT)?.value,
    backdrop: attributes?.find(({ traitType }) => traitType === BACKDROP_TRAIT)?.value,
  };
}

function getCollectibleType(metadataUrl?: string, imageUrl?: string): ApiWalletCollectible['type'] {
  for (const url of [metadataUrl, imageUrl]) {
    const type = url && FRAGMENT_TYPES.find((item) => url.startsWith(`https://${FRAGMENT_NFT_HOST}/${item}/`));
    if (type) return type;
  }

  return 'other';
}

// The item's page is at the metadata path (`nft.fragment.com/<path>.json`) on `fragment.com`
function buildFragmentUrl(metadataUrl?: string): string | undefined {
  if (!metadataUrl) return undefined;

  try {
    const { protocol, hostname, pathname } = new URL(metadataUrl);

    if ((protocol !== 'https:' && protocol !== 'http:') || hostname !== FRAGMENT_NFT_HOST
      || !pathname.endsWith(FRAGMENT_METADATA_EXTENSION)) {
      return undefined;
    }

    return `${FRAGMENT_URL}${pathname.slice(0, -FRAGMENT_METADATA_EXTENSION.length)}`;
  } catch {
    return undefined;
  }
}

export function buildApiOnrampProvider(provider: GramJs.OnrampProviderInfo): ApiOnrampProvider {
  return {
    id: provider.id,
    name: provider.name,
    cryptoCurrencies: provider.cryptoCurrencies,
    hasBaseCurrencies: provider.supportsBaseCurrencies,
    hasLimits: provider.supportsLimits,
    hasQuote: provider.supportsQuote,
  };
}

export function buildApiOnrampSession(session: GramJs.OnrampSession): ApiOnrampSession {
  return {
    provider: session.provider,
    sessionId: session.sessionId,
    url: session.url,
    expiresDate: session.expiresDate,
  };
}

export function buildApiOnrampAvailability(availability: GramJs.OnrampAvailability): ApiOnrampAvailability {
  return {
    isAllowed: availability.allowed,
    isBuyAllowed: availability.buyAllowed,
    countryCode: availability.countryCode,
    state: availability.state,
    methods: availability.methods.map((method) => ({
      paymentMethod: method.paymentMethod,
      isAvailable: method.available,
    })),
  };
}

export function buildApiOnrampLimits(limits: GramJs.OnrampLimits): ApiOnrampLimits {
  return {
    baseCurrency: limits.baseCurrency,
    baseMinAmount: limits.baseMinAmount,
    baseMaxAmount: limits.baseMaxAmount,
    cryptoMinAmount: limits.cryptoMinAmount,
    cryptoMaxAmount: limits.cryptoMaxAmount,
    paymentMethod: limits.paymentMethod,
  };
}

export function buildApiOnrampQuote(quote: GramJs.OnrampQuote): ApiOnrampQuote {
  return {
    baseCurrency: quote.baseCurrency,
    baseAmount: quote.baseAmount,
    cryptoCurrency: quote.cryptoCurrency,
    cryptoAmount: quote.cryptoAmount,
    cryptoPrice: quote.cryptoPrice,
    feeAmount: quote.feeAmount,
    extraFeeAmount: quote.extraFeeAmount,
    networkFeeAmount: quote.networkFeeAmount,
    totalAmount: quote.totalAmount,
    paymentMethod: quote.paymentMethod,
    expiresDate: quote.expiresDate,
  };
}
