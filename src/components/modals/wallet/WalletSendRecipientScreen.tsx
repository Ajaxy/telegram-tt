import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser, ApiWalletUserAddress } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { WalletSendDraft } from './types';

import { toNonBounceableAddress } from '../../../lib/ton/address';
import { isDeletedUser, isUserBot } from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectTabState } from '../../../global/selectors';
import { formatTonFromNanos } from '../../../util/formatCurrency';
import { unique } from '../../../util/iteratees';
import { parseTonTransferAddress, parseTonTransferLink } from '../../../util/tonAddress';
import { loadCurrentUserAddress } from './helpers/loadCurrentUserAddress';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useEffectOnce from '../../../hooks/useEffectOnce';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';

import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import TextArea from '../../ui/TextArea';
import WalletRecentRecipient from './WalletRecentRecipient';
import Control, { ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandTitle } from '@gili/layout/Island';

import styles from './WalletSendRecipientScreen.module.scss';

type OwnProps = {
  isActive: boolean;
  draft: WalletSendDraft;
  onDraftChange: (draft: WalletSendDraft) => void;
  onContinue: NoneToVoidFunction;
};

type StateProps = {
  currentUserId?: string;
  contactIds?: string[];
  // Private chats, whose ids are the ids of the users behind them
  activeChatIds?: string[];
  topPeerIds?: string[];
  recentlyFoundChatIds?: string[];
  usersById: Record<string, ApiUser>;
  resolvedAddresses?: Record<string, ApiWalletUserAddress | false>;
  walletDomainLookup?: TabState['walletDomainLookup'];
  walletRecipientSearch?: TabState['walletRecipientSearch'];
  // `Modal` freezes its content while it closes, so the screen learns about the closing from here
  isModalOpen: boolean;
};

const RECENT_LIMIT = 50;
const SEARCH_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;
// A `.ton` domain with subdomains, or a Telegram username sold on Fragment as a `.t.me` domain
const TON_DOMAIN_REGEX = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(ton|t\.me)$/;
const TON_DOMAIN_MAX_LENGTH = 126;
const CAN_READ_CLIPBOARD = Boolean(window.navigator.clipboard?.readText);

const WalletSendRecipientScreen = (props: OwnProps & StateProps) => {
  const {
    loadWalletUserAddresses, loadWalletDomainAddress, loadTopPeers, searchWalletRecipients, showNotification,
  } = getActions();

  // A screen leaving with its slide or the modal keeps its last values, so nothing changes under the animation
  const {
    currentUserId, contactIds, activeChatIds, topPeerIds, recentlyFoundChatIds,
    usersById, resolvedAddresses, walletDomainLookup, walletRecipientSearch,
    draft,
    onDraftChange, onContinue,
  } = useFrozenProps(props, !props.isActive || !props.isModalOpen);

  const lang = useLang();

  const [resolvingUserId, setResolvingUserId] = useState<string>();
  const selectedUserIdRef = useRef<string>();
  const isShownRef = useStateRef(props.isActive && props.isModalOpen);

  const recipient = draft.recipientQuery;

  const updateDraft = useLastCallback((update: Partial<WalletSendDraft>) => {
    onDraftChange({ ...draft, ...update });
  });

  // Typed, pasted or linked text is both the field and the recipient
  const setTypedRecipient = useLastCallback((text: string, update?: Partial<WalletSendDraft>) => {
    updateDraft({ ...update, recipient: text, recipientQuery: text });
  });

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

  useEffectOnce(() => {
    loadTopPeers({ category: 'correspondents' });
  });

  const recentRecipients = useMemo(() => (
    unique([...(topPeerIds || []), ...(recentlyFoundChatIds || [])])
      .filter((id) => canOfferUser(id, currentUserId, usersById))
      .slice(0, RECENT_LIMIT)
  ), [topPeerIds, recentlyFoundChatIds, currentUserId, usersById]);

  const candidateIds = useMemo(() => (
    unique([...(contactIds || []), ...(activeChatIds || [])])
      .filter((userId) => canOfferUser(userId, currentUserId, usersById))
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
    const isOffered = (userId: string) => canOfferUser(userId, currentUserId, usersById);
    const localIds = unique([
      ...filterPeersByQuery({ ids: candidateIds, query: trimmedRecipient, type: 'user' }),
      ...(found?.localUserIds || []),
    ]).filter(isOffered).slice(0, SEARCH_LIMIT);
    const globalIds = (found?.globalUserIds || [])
      .filter((userId) => isOffered(userId) && !localIds.includes(userId))
      .slice(0, SEARCH_LIMIT);

    return { localIds, globalIds };
  }, [isSearching, candidateIds, trimmedRecipient, walletRecipientSearch, currentUserId, usersById]);

  // An edit after a tap on a row cancels the tap. Otherwise the row's address would replace the newer input when
  // it arrives.
  const dropRecipientSelection = useLastCallback(() => {
    selectedUserIdRef.current = undefined;
    setResolvingUserId(undefined);
  });

  const handleRecipientChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dropRecipientSelection();
    setTypedRecipient(e.currentTarget.value);
  });

  const applyTransferLink = useLastCallback((text: string) => {
    const link = parseTonTransferLink(text);
    if (!link) return false;

    dropRecipientSelection();

    // A memo from a link stays readable to its issuer, e.g. an exchange matching a deposit, unless the link says so
    setTypedRecipient(link.address ?? draft.recipientQuery, {
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
    setTypedRecipient(text);
  });

  // The tap always asks the server: a cached address may be stale, and the forced request creates a missing wallet
  const handleRecipientSelect = useLastCallback(async (userId: string) => {
    selectedUserIdRef.current = userId;
    setResolvingUserId(userId);

    const address = await loadCurrentUserAddress(userId);

    // A later tap on another row takes over, so an earlier answer must not fill the field
    if (selectedUserIdRef.current !== userId) return;

    setResolvingUserId(undefined);

    // The screen may have been left while the server answered
    if (!isShownRef.current) return;

    if (address) {
      updateDraft({ recipient: address, recipientUser: { id: userId, address } });
      onContinue();
    } else if (address === '') {
      showNotification({ message: { key: 'WalletLinkNoWallet' } });
    }
  });

  const handleDomainSelect = useLastCallback(() => {
    updateDraft({ recipient: domainAddress! });
    onContinue();
  });

  // A row picked before Back may have left another address in the draft, so the typed one takes over
  const handleContinue = useLastCallback(() => {
    updateDraft({ recipient });
    onContinue();
  });

  const handleRecipientKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

    e.preventDefault();

    const firstUserId = searchResults?.localIds[0] || searchResults?.globalIds[0]
      || (!hasRecipient ? recentRecipients[0] : undefined);

    if (isRecipientValid) {
      handleContinue();
    } else if (domainAddress) {
      handleDomainSelect();
    } else if (firstUserId) {
      handleRecipientSelect(firstUserId);
    }
  });

  return (
    <div className={styles.root}>
      <div className={styles.form}>
        <Island className={styles.recipientField}>
          {/* An address is too long for one line, so it wraps instead of scrolling out of sight */}
          <TextArea
            className="no-margin"
            label={lang('WalletSendRecipient')}
            value={recipient}
            error={domainLookup?.address === false ? lang('WalletSendDomainNotFound')
              : hasDomainLookupFailed ? lang('WalletSendDomainLookupFailed') : undefined}
            onChange={handleRecipientChange}
            onPaste={handleRecipientPaste}
            onKeyDown={handleRecipientKeyDown}
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
        </Island>
        {resolvedRecipient && resolvedRecipient.userId && (
          <Island>
            <WalletRecentRecipient
              userId={resolvedRecipient.userId}
              isLinkedAddress
              onSelect={handleRecipientSelect}
            />
          </Island>
        )}
      </div>
      {isRecipientValid ? (
        <Button pill className={styles.continue} onClick={handleContinue}>
          {lang('WalletSendContinue')}
        </Button>
      ) : domainAddress ? (
        <Island>
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
              <Island>
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
              <Island>
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
          <Island>
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
    </div>
  );
};

// Bots and deleted accounts have no wallet. Ids of group chats find no user, so they drop out too.
function canOfferUser(userId: string, currentUserId: string | undefined, usersById: Record<string, ApiUser>) {
  const user = usersById[userId];

  return userId !== currentUserId && user !== undefined && !isUserBot(user) && !isDeletedUser(user);
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);

    return {
      currentUserId: global.currentUserId,
      contactIds: global.contactList?.userIds,
      activeChatIds: global.chats.listIds.active,
      topPeerIds: global.topPeerCategories.correspondents?.peerIds,
      recentlyFoundChatIds: global.recentlyFoundChatIds,
      usersById: global.users.byId,
      resolvedAddresses: global.wallet?.resolvedAddresses,
      walletDomainLookup: tabState.walletDomainLookup,
      walletRecipientSearch: tabState.walletRecipientSearch,
      isModalOpen: Boolean(tabState.walletModal),
    };
  },
)(WalletSendRecipientScreen));
