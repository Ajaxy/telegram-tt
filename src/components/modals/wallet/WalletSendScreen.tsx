import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiUser, ApiWalletCollectible, ApiWalletGaslessInfo, ApiWalletUserAddress,
} from '../../../api/types';
import type { TabState } from '../../../global/types';

import {
  GRAM_TRANSFER_FEE_RESERVE, NFT_TRANSFER_ATTACHED_NANOS, WALLET_COMMENT_MAX_BYTES,
} from '../../../config';
import { toNonBounceableAddress } from '../../../lib/ton/address';
import {
  buildWalletTransferFeeKey, isDeletedUser, isUserBot,
} from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectTabState, selectWalletCurrency, selectWalletCurrencyRate } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { bufferFromUtf8 } from '../../../util/encoding/buffer';
import { isUserId } from '../../../util/entities/ids';
import { formatTonFromNanos, formatTonInFiat, parseTonToNanos } from '../../../util/formatCurrency';
import { unique } from '../../../util/iteratees';
import { getBigIntMax } from '../../../util/numbers';
import { parseTonTransferAddress, parseTonTransferLink } from '../../../util/tonAddress';
import { normalizeAmountInput } from './helpers/amount';
import { loadCurrentUserAddress } from './helpers/loadCurrentUserAddress';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GramIcon from '../../common/icons/GramIcon';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import Spinner from '../../ui/Spinner';
import TextArea from '../../ui/TextArea';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletCollectibleImage from './WalletCollectibleImage';
import WalletFeesInfoDialog from './WalletFeesInfoDialog';
import WalletRecentRecipient from './WalletRecentRecipient';
import Control, { ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandTitle } from '@gili/layout/Island';

import styles from './WalletSendScreen.module.scss';

export type WalletTransferPayload = {
  toAddress: string;
  toUserId?: string;
  // Nanotons
  amount: bigint;
  comment?: string;
  shouldEncryptComment?: boolean;
  shouldSendAll?: boolean;
  collectibleAddress?: string;
  // The relayer was to pay the fee
  isGasless?: boolean;
};

type WalletSendDraft = {
  // A wallet swapped in meanwhile must not send the draft
  fromAddress?: string;
  collectibleAddress?: string;
  recipient: string;
  amount: string;
  comment: string;
  isCommentPublic: boolean;
};

export const EMPTY_SEND_DRAFT: WalletSendDraft = {
  recipient: '', amount: '', comment: '', isCommentPublic: false,
};

type OwnProps = {
  draft: WalletSendDraft;
  collectible?: ApiWalletCollectible;
  onSubmit: (payload: WalletTransferPayload) => void;
  onDraftChange: (draft: WalletSendDraft) => void;
  onBuy: NoneToVoidFunction;
};

type StateProps = {
  balance?: bigint;
  usdRate?: number;
  currency: string;
  currencyRate?: number;
  currentUserId?: string;
  contactIds?: string[];
  // Private chats, whose ids are the ids of the users behind them
  activeChatIds?: string[];
  topPeerIds?: string[];
  recentlyFoundChatIds?: string[];
  usersById: Record<string, ApiUser>;
  // Empty for a user without a wallet, absent until asked
  userAddresses?: Record<string, string>;
  resolvedAddresses?: Record<string, ApiWalletUserAddress | false>;
  walletDomainLookup?: TabState['walletDomainLookup'];
  walletRecipientSearch?: TabState['walletRecipientSearch'];
  walletTransfer?: TabState['walletTransfer'];
  walletTransferFee?: TabState['walletTransferFee'];
  gaslessInfo?: ApiWalletGaslessInfo;
  freeTransfersPerDay?: number;
  // Nanotons. The server accepts smaller transfers but leaves them out of the history.
  minAmount?: bigint;
};

const RECENT_LIMIT = 50;
const SEARCH_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;
const FEE_DEBOUNCE_MS = 500;
// A `.ton` domain with subdomains, or a Telegram username sold on Fragment as a `.t.me` domain
const TON_DOMAIN_REGEX = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(ton|t\.me)$/;
const TON_DOMAIN_MAX_LENGTH = 126;
const COMMENT_COUNTER_THRESHOLD = 100;
const NANOTON_DECIMALS = 9;
const CAN_READ_CLIPBOARD = Boolean(window.navigator.clipboard?.readText);

const WalletSendScreen = ({
  balance, usdRate, currency, currencyRate, currentUserId, contactIds, activeChatIds, topPeerIds, recentlyFoundChatIds,
  usersById, userAddresses, resolvedAddresses, walletDomainLookup, walletRecipientSearch,
  walletTransfer, walletTransferFee, gaslessInfo, freeTransfersPerDay, minAmount,
  draft, collectible,
  onSubmit, onDraftChange, onBuy,
}: OwnProps & StateProps) => {
  const {
    loadWalletUserAddresses, loadWalletTransferFee, loadWalletDomainAddress, loadTopPeers, searchWalletRecipients,
    showNotification,
  } = getActions();

  const lang = useLang();

  const [isFeesInfoOpen, openFeesInfo, closeFeesInfo] = useFlag();
  const [resolvingUserId, setResolvingUserId] = useState<string>();
  const selectedUserIdRef = useRef<string>();

  const {
    recipient, amount, comment, isCommentPublic,
  } = draft;

  const updateDraft = useLastCallback((update: Partial<WalletSendDraft>) => {
    onDraftChange({ ...draft, ...update });
  });

  const isSending = walletTransfer?.status === 'pending';

  // The item contract pays its fees from the fixed amount and returns the rest
  const collectibleAddress = draft.collectibleAddress;
  const amountNanos = collectibleAddress
    ? NFT_TRANSFER_ATTACHED_NANOS
    : parseTonToNanos(amount);

  // Emptying the wallet is a distinct transfer mode, where the fees come out of the amount itself
  const shouldSendAll = !collectibleAddress && amountNanos === balance;
  const trimmedRecipient = recipient.trim();
  const hasRecipient = Boolean(trimmedRecipient);
  const isRecipientValid = Boolean(parseTonTransferAddress(trimmedRecipient));
  const normalizedRecipient = isRecipientValid ? toNonBounceableAddress(trimmedRecipient) : undefined;
  const resolvedRecipient = normalizedRecipient ? resolvedAddresses?.[normalizedRecipient] : undefined;

  useEffect(() => {
    if (!normalizedRecipient) return;

    loadWalletUserAddresses({ addresses: [normalizedRecipient] });
  }, [normalizedRecipient]);

  const lowerCaseRecipient = trimmedRecipient.toLowerCase();
  const recipientDomain = !isRecipientValid && lowerCaseRecipient.length <= TON_DOMAIN_MAX_LENGTH
    && TON_DOMAIN_REGEX.test(lowerCaseRecipient) ? lowerCaseRecipient : undefined;

  const domainLookup = recipientDomain && walletDomainLookup?.domain === recipientDomain
    ? walletDomainLookup : undefined;
  const domainAddress = domainLookup?.address || undefined;
  const hasDomainLookupFailed = Boolean(domainLookup?.isFailed);
  const isResolvingRecipient = recipientDomain
    ? domainLookup?.address === undefined && !hasDomainLookupFailed
    : (Boolean(normalizedRecipient) && resolvedRecipient === undefined) || resolvingUserId !== undefined;

  // Not debounced: the pattern only matches once the whole suffix is typed, and answered domains are not re-requested
  useEffect(() => {
    if (!recipientDomain) return;

    loadWalletDomainAddress({ domain: recipientDomain });
  }, [recipientDomain]);

  const isSearching = hasRecipient && !isRecipientValid && !recipientDomain;
  const trimmedComment = comment.trim();

  // The item contract delivers the comment to the new owner as plain text, so it cannot be encrypted
  const shouldEncryptComment = Boolean(trimmedComment) && !isCommentPublic && !collectibleAddress;
  const commentBytesLeft = WALLET_COMMENT_MAX_BYTES - bufferFromUtf8(trimmedComment).length;
  const isCommentTooLong = commentBytesLeft < 0;

  // The estimate is debounced, so it is only used while it matches what is typed now
  const feePayload = useMemo(() => ({
    toAddress: trimmedRecipient,
    amount: amountNanos,
    comment: trimmedComment || undefined,
    shouldEncryptComment,
    shouldSendAll,
    collectibleAddress,
  }), [trimmedRecipient, amountNanos, trimmedComment, shouldEncryptComment, shouldSendAll, collectibleAddress]);
  const currentFee = walletTransferFee?.key === buildWalletTransferFeeKey(feePayload) ? walletTransferFee : undefined;

  // The recipient's wallet has no key to encrypt for yet
  const isCommentEncryptionUnavailable = shouldEncryptComment && currentFee?.canEncryptComment === false;

  // When the estimate fails, the fixed reserve is the only fee the transfer could rely on, and a payload can cost more
  const hasFeeFailed = Boolean(currentFee?.isFailed);

  // The API's safety reserve is kept even for gasless transfers, which may fall back to a regular message
  const estimatedFee = currentFee?.fee;
  const canShowFeesInfo = Boolean(estimatedFee && freeTransfersPerDay);
  const feeToCover = getBigIntMax(estimatedFee ?? 0n, GRAM_TRANSFER_FEE_RESERVE);

  // The relayer takes neither collectibles nor transfers to the wallet itself
  const isSelfTransfer = Boolean(normalizedRecipient && draft.fromAddress)
    && normalizedRecipient === toNonBounceableAddress(draft.fromAddress!);

  // The quota and the minimum are the server's word on relayed transfers. A wallet with no code yet is the one
  // thing the client knows the relayer cannot carry, and only the estimate tells whether the wallet has code.
  const isGasless = !collectibleAddress && !isSelfTransfer
    && Boolean(gaslessInfo?.isAvailable && gaslessInfo.left > 0 && amountNanos >= gaslessInfo.minAmount)
    && Boolean(currentFee?.canUseRelayer);
  const requiredNanos = shouldSendAll ? amountNanos : amountNanos + feeToCover;
  const isBelowMin = Boolean(!collectibleAddress && minAmount && amountNanos > 0n && amountNanos < minAmount);
  const isInsufficient = balance !== undefined && amountNanos > 0n && requiredNanos > balance;

  const canSubmit = isRecipientValid
    && amountNanos > 0n
    && !isBelowMin
    && !isCommentTooLong
    && !isCommentEncryptionUnavailable
    && !isInsufficient
    && !hasFeeFailed;

  // Confirmed before the estimate, the transfer would go out with neither the fee nor the payer shown
  const isEstimatingFee = canSubmit && !currentFee;

  const debouncedLoadFee = useDebouncedCallback(
    (payload: WalletTransferPayload) => {
      loadWalletTransferFee(payload);
    },
    [],
    FEE_DEBOUNCE_MS,
    true,
  );

  useEffect(() => {
    if (!isRecipientValid || amountNanos <= 0n) return;

    debouncedLoadFee(feePayload);
  }, [feePayload, isRecipientValid, amountNanos, debouncedLoadFee]);

  const handleSubmit = useLastCallback(() => {
    // Naming the person lets the server show each side of the transfer to the other, even without a chat
    const toUserId = (resolvedRecipient && resolvedRecipient.userId)
      || Object.entries(userAddresses || {}).find(([, address]) => address === normalizedRecipient)?.[0];

    onSubmit({ ...feePayload, isGasless, toUserId });
  });

  const handleMaxClick = useLastCallback(() => {
    updateDraft({ amount: formatTonFromNanos(balance!) });
  });

  useEffect(() => {
    loadTopPeers({ category: 'correspondents' });
  }, []);

  const recentRecipients = useMemo(() => (
    unique([...(topPeerIds || []), ...(recentlyFoundChatIds || [])])
      .filter((id) => isUserId(id) && id !== currentUserId && canHaveWallet(usersById[id]))
      .slice(0, RECENT_LIMIT)
  ), [topPeerIds, recentlyFoundChatIds, currentUserId, usersById]);

  const candidateIds = useMemo(() => (
    unique([...(contactIds || []), ...(activeChatIds || []).filter(isUserId)]).filter((userId) => (
      userId !== currentUserId && canHaveWallet(usersById[userId])
    ))
  ), [contactIds, activeChatIds, usersById, currentUserId]);

  const debouncedSearchRecipients = useDebouncedCallback((query: string) => {
    searchWalletRecipients({ query });
  }, [], SEARCH_DEBOUNCE_MS, true);

  useEffect(() => {
    if (!isSearching) return;

    debouncedSearchRecipients(trimmedRecipient);
  }, [isSearching, trimmedRecipient, debouncedSearchRecipients]);

  // Strangers found on the server stay in their own section, as in the chat search, so a familiar name
  // does not pass for a contact. The search answers later than the local match, so they join as they arrive.
  const searchResults = useMemo(() => {
    if (!isSearching) return undefined;

    const found = walletRecipientSearch?.query === trimmedRecipient ? walletRecipientSearch : undefined;
    const isOffered = (userId: string) => userId !== currentUserId && canHaveWallet(usersById[userId]);
    const localIds = unique([
      ...filterPeersByQuery({ ids: candidateIds, query: trimmedRecipient, type: 'user' }),
      ...(found?.localUserIds || []),
    ]).filter(isOffered).slice(0, SEARCH_LIMIT);
    const globalIds = (found?.globalUserIds || [])
      .filter((userId) => isOffered(userId) && !localIds.includes(userId))
      .slice(0, SEARCH_LIMIT);

    return { localIds, globalIds };
  }, [isSearching, candidateIds, trimmedRecipient, walletRecipientSearch, currentUserId, usersById]);

  const fiatAmount = amountNanos > 0n
    ? formatTonInFiat(amountNanos, usdRate, currency, currencyRate, lang.code)
    : undefined;

  // An edit after a tap on a row cancels the tap. Otherwise the row's address would replace the newer input when
  // it arrives.
  const dropRecipientSelection = useLastCallback(() => {
    selectedUserIdRef.current = undefined;
    setResolvingUserId(undefined);
  });

  const handleRecipientChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dropRecipientSelection();
    updateDraft({ recipient: e.currentTarget.value });
  });

  const applyTransferLink = useLastCallback((text: string) => {
    const link = parseTonTransferLink(text);
    if (!link) return false;

    dropRecipientSelection();

    // A memo from a link stays readable to its issuer, e.g. an exchange matching a deposit, unless the link says so
    updateDraft({
      recipient: link.address ?? draft.recipient,
      amount: link.amount === undefined ? draft.amount : formatTonFromNanos(link.amount),
      comment: link.comment ?? draft.comment,
      isCommentPublic: link.comment !== undefined ? !link.isCommentEncrypted : draft.isCommentPublic,
    });

    return true;
  });

  const handleRecipientPaste = useLastCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (applyTransferLink(e.clipboardData.getData('text'))) {
      e.preventDefault();
    }
  });

  const handlePasteClick = useLastCallback(async () => {
    const text = (await window.navigator.clipboard.readText().catch(() => '')).trim();
    if (!text || applyTransferLink(text)) return;

    dropRecipientSelection();
    updateDraft({ recipient: text });
  });

  // The tap always asks the server: a cached address may be stale, and the forced request creates a missing wallet
  const handleRecipientSelect = useLastCallback(async (userId: string) => {
    selectedUserIdRef.current = userId;
    setResolvingUserId(userId);

    const address = await loadCurrentUserAddress(userId);

    // A later tap on another row takes over, so an earlier answer must not fill the field
    if (selectedUserIdRef.current !== userId) return;

    setResolvingUserId(undefined);

    if (address) {
      updateDraft({ recipient: address });
    } else if (address === '') {
      showNotification({ message: { key: 'WalletLinkNoWallet' } });
    }
  });

  const handleDomainSelect = useLastCallback(() => {
    updateDraft({ recipient: domainAddress! });
  });

  const handleAmountChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateDraft({ amount: normalizeAmountInput(e.currentTarget.value, NANOTON_DECIMALS) });
  });

  const handleCommentChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateDraft({ comment: e.currentTarget.value });
  });

  const handleCommentLockClick = useLastCallback(() => {
    updateDraft({ isCommentPublic: !isCommentPublic });
  });

  return (
    <div className={styles.root}>
      {collectible && (
        <Island className={styles.collectible}>
          <WalletCollectibleImage collectible={collectible} className={styles.collectibleImage} />
          <div className={styles.collectibleName}>{collectible.name ?? lang('WalletCollectibleTitle')}</div>
        </Island>
      )}
      <Island className={buildClassName(styles.form, isRecipientValid && styles.formBeforeSubmit)}>
        <div className={styles.recipientField}>
          {/* An address is too long for one line, so it wraps instead of scrolling out of sight */}
          <TextArea
            className="no-margin"
            label={lang('WalletSendRecipient')}
            value={recipient}
            error={domainLookup?.address === false ? lang('WalletSendDomainNotFound')
              : hasDomainLookupFailed ? lang('WalletSendDomainLookupFailed') : undefined}
            onChange={handleRecipientChange}
            onPaste={handleRecipientPaste}
          />
          {isResolvingRecipient && <Spinner className={styles.recipientSpinner} />}
          {CAN_READ_CLIPBOARD && !hasRecipient && !isResolvingRecipient && (
            <Button
              isText
              size="tiny"
              iconName="paste"
              className={styles.paste}
              ariaLabel={lang('WalletPaste')}
              onClick={handlePasteClick}
            />
          )}
        </div>
        {resolvedRecipient && resolvedRecipient.userId && (
          <WalletRecentRecipient
            userId={resolvedRecipient.userId}
            isLinkedAddress
            className={styles.linkedRecipient}
            onSelect={handleRecipientSelect}
          />
        )}
        {isRecipientValid && !collectibleAddress && (
          <div className={styles.amountBlock}>
            <div className={styles.amountField}>
              <GramIcon isMono className={styles.amountIcon} />
              <InputText
                className={styles.amountInput}
                label={lang('WalletSendAmount')}
                value={amount}
                inputMode="decimal"
                noMargin
                onChange={handleAmountChange}
              />
              {fiatAmount && <span className={styles.amountUsd}>{`~${fiatAmount}`}</span>}
            </div>
            <div className={styles.balance}>
              {lang(
                'WalletSendBalance',
                { amount: <ExpandableTonAmount nanos={balance ?? 0n} withTicker /> },
                { withNodes: true },
              )}
              {Boolean(balance) && (
                <button type="button" className={styles.maxButton} onClick={handleMaxClick}>
                  {lang('WalletSendMax')}
                </button>
              )}
            </div>
          </div>
        )}
        {isRecipientValid && (
          <div className={styles.commentBlock}>
            <div className={styles.commentField}>
              <InputText
                className={buildClassName(!collectibleAddress && styles.commentInput)}
                label={lang('WalletSendComment')}
                value={comment}
                error={isCommentTooLong ? lang('WalletCommentTooLong') : undefined}
                maxLengthIndicator={
                  commentBytesLeft <= COMMENT_COUNTER_THRESHOLD ? String(commentBytesLeft) : undefined
                }
                noMargin
                onChange={handleCommentChange}
              />
              {!collectibleAddress && (
                <Button
                  round
                  size="smaller"
                  color="translucent"
                  className={buildClassName(styles.commentLock, !isCommentPublic && styles.commentLockClosed)}
                  iconName={isCommentPublic ? 'unlock' : 'lock'}
                  ariaLabel={lang(isCommentPublic ? 'WalletPublicCommentInfo' : 'WalletPrivateCommentInfo')}
                  onClick={handleCommentLockClick}
                />
              )}
            </div>
            {Boolean(trimmedComment) && (
              <div className={styles.commentHint}>
                {lang(shouldEncryptComment ? 'WalletPrivateCommentInfo' : 'WalletPublicCommentInfo')}
              </div>
            )}
          </div>
        )}
      </Island>
      {isRecipientValid ? (
        <div className={styles.footer}>
          {isBelowMin ? (
            <div className={styles.feeLine}>
              {lang(
                'WalletSendMinAmount',
                { amount: <ExpandableTonAmount nanos={minAmount!} withTicker /> },
                { withNodes: true },
              )}
            </div>
          ) : isCommentEncryptionUnavailable ? (
            <div className={styles.feeLine}>{lang('WalletCommentEncryptionUnavailable')}</div>
          ) : isInsufficient ? (
            <div className={styles.feeLine}>
              {lang('WalletSendInsufficientFunds')}
              {' '}
              <Link isPrimary onClick={onBuy}>{lang('WalletDepositFunds')}</Link>
            </div>
          ) : hasFeeFailed ? (
            <div className={styles.feeLine}>{lang('WalletSendFeeUnavailable')}</div>
          ) : isGasless ? (
            <div className={styles.feeLine}>
              {lang('WalletTransactionFeeFree')}
              {canShowFeesInfo && (
                <Button
                  round
                  size="tiny"
                  color="translucent"
                  className={styles.feeInfoButton}
                  iconName="help"
                  ariaLabel={lang('WalletNetworkFeesTitle')}
                  onClick={openFeesInfo}
                />
              )}
            </div>
          ) : Boolean(estimatedFee) && (
            <div className={styles.feeLine}>
              {lang(
                'WalletSendNetworkFee',
                { amount: <ExpandableTonAmount nanos={estimatedFee} withTicker /> },
                { withNodes: true },
              )}
            </div>
          )}
          <Button
            pill
            disabled={!canSubmit || isSending || isEstimatingFee}
            isLoading={isSending || isEstimatingFee}
            onClick={handleSubmit}
          >
            {lang('WalletSendContinue')}
          </Button>
        </div>
      ) : domainAddress ? (
        <Island className={styles.recent}>
          <Interactive clickable ripple onClick={handleDomainSelect}>
            <Control>
              <ControlLabel>{recipientDomain}</ControlLabel>
              <ControlDescription>{domainAddress}</ControlDescription>
            </Control>
          </Interactive>
        </Island>
      ) : isSearching ? (
        <>
          {Boolean(searchResults!.localIds.length) && (
            <>
              <IslandTitle>{lang('DialogListSearchSectionDialogs')}</IslandTitle>
              <Island className={styles.recent}>
                {searchResults!.localIds.map((userId) => (
                  <WalletRecentRecipient
                    key={userId}
                    userId={userId}
                    onSelect={handleRecipientSelect}
                  />
                ))}
              </Island>
            </>
          )}
          {Boolean(searchResults!.globalIds.length) && (
            <>
              <IslandTitle>{lang('DialogListSearchSectionGlobal')}</IslandTitle>
              <Island className={styles.recent}>
                {searchResults!.globalIds.map((userId) => (
                  <WalletRecentRecipient
                    key={userId}
                    userId={userId}
                    withUsername
                    onSelect={handleRecipientSelect}
                  />
                ))}
              </Island>
            </>
          )}
        </>
      ) : Boolean(recentRecipients.length) && (
        <>
          <IslandTitle>{lang('WalletSendRecent')}</IslandTitle>
          <Island className={styles.recent}>
            {recentRecipients.map((userId) => (
              <WalletRecentRecipient
                key={userId}
                userId={userId}
                onSelect={handleRecipientSelect}
              />
            ))}
          </Island>
        </>
      )}
      {canShowFeesInfo && (
        <WalletFeesInfoDialog
          isOpen={isFeesInfoOpen}
          fee={estimatedFee}
          freeTransfersPerDay={freeTransfersPerDay!}
          onClose={closeFeesInfo}
        />
      )}
    </div>
  );
};

// Bots and deleted accounts have no wallet
function canHaveWallet(user?: ApiUser) {
  return user !== undefined && !isUserBot(user) && !isDeletedUser(user);
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);

    return {
      balance: global.wallet?.state?.balance,
      usdRate: global.appConfig.tonUsdRate,
      currency: selectWalletCurrency(global),
      currencyRate: selectWalletCurrencyRate(global),
      currentUserId: global.currentUserId,
      contactIds: global.contactList?.userIds,
      activeChatIds: global.chats.listIds.active,
      topPeerIds: global.topPeerCategories.correspondents?.peerIds,
      recentlyFoundChatIds: global.recentlyFoundChatIds,
      usersById: global.users.byId,
      userAddresses: global.wallet?.userAddresses,
      resolvedAddresses: global.wallet?.resolvedAddresses,
      walletDomainLookup: tabState.walletDomainLookup,
      walletTransfer: tabState.walletTransfer,
      walletTransferFee: tabState.walletTransferFee,
      walletRecipientSearch: tabState.walletRecipientSearch,
      gaslessInfo: global.wallet?.gaslessInfo,
      freeTransfersPerDay: global.appConfig.walletGaslessDailyTransfers,
      minAmount: global.appConfig.walletTransferMinNanos,
    };
  },
)(WalletSendScreen));
