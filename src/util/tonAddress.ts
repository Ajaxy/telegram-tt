import { WALLET_COMMENT_MAX_BYTES } from '../config';
import { parseAddress } from '../lib/ton/address';
import { truncateUtf8 } from './encoding/buffer';

type TonTransferLink = {
  address?: string;
  amount?: bigint;
  comment?: string;
  isCommentEncrypted?: boolean;
};

const ADDRESS_GROUP_REGEX = /.{1,4}/g;
const ADDRESS_GROUPS_PER_LINE = 4;
const ADDRESS_EDGE_LENGTH = 4;
// `ton://transfer/<address>?amount=<nanotons>&text=<comment>`, as a wallet QR code carries it
const TON_TRANSFER_LINK_REGEX = /^ton:\/\/transfer(?:\/([^/?#]*))?(?:\?(.*))?$/i;

// The wallet sends on mainnet, so a test-only address cannot be a transfer destination
export function parseTonTransferAddress(value: string) {
  const address = parseAddress(value);

  return address && !address.isTestOnly ? address : undefined;
}

export function splitAddressIntoGroups(address: string): string[] {
  return address.match(ADDRESS_GROUP_REGEX) || [];
}

export function getAddressGroupSeparator(index: number, total: number): string {
  if (index === total - 1) return '';

  if (index % ADDRESS_GROUPS_PER_LINE === ADDRESS_GROUPS_PER_LINE - 1) return '\n';

  return ' ';
}

export function formatAddressInGroups(address: string): string {
  const groups = splitAddressIntoGroups(address);

  return groups.map((group, index) => group + getAddressGroupSeparator(index, groups.length)).join('');
}

export function splitAddressInHalves(address: string): [string, string] {
  const groups = splitAddressIntoGroups(address);
  const half = Math.ceil(groups.length / 2);

  return [groups.slice(0, half).join(' '), groups.slice(half).join(' ')];
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, ADDRESS_EDGE_LENGTH)}…${address.slice(-ADDRESS_EDGE_LENGTH)}`;
}

const RE_NANOTONS = /^\d{1,20}$/;
// A flag counts as set unless it says otherwise, as `getBooleanQueryParameter` reads it in the Android app
const RE_FALSE_FLAG = /^(?:false|0)$/i;

// A comment longer than a transfer can carry is cut rather than refused
export function parseTransferComment(text?: string, comment?: string, encrypted?: string) {
  const value = text || comment || undefined;

  return {
    comment: value && truncateUtf8(value, WALLET_COMMENT_MAX_BYTES),
    isCommentEncrypted: value !== undefined && encrypted !== undefined && !RE_FALSE_FLAG.test(encrypted),
  };
}

export function parseTonTransferLink(value: string): TonTransferLink | undefined {
  const match = value.trim().match(TON_TRANSFER_LINK_REGEX);
  if (!match) return undefined;

  const address = match[1] || undefined;
  if (address && !parseTonTransferAddress(address)) return undefined;

  const params = new URLSearchParams(match[2] || '');
  const amountParam = params.get('amount');

  // The `amount` parameter is plain digits in nanotons. `BigInt` alone would also accept hex and surrounding spaces.
  const amount = amountParam && RE_NANOTONS.test(amountParam) ? BigInt(amountParam) : undefined;

  return {
    address,
    amount: amount || undefined,
    ...parseTransferComment(
      params.get('text') ?? undefined, params.get('comment') ?? undefined, params.get('encrypted') ?? undefined,
    ),
  };
}
