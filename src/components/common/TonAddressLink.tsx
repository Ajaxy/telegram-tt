import {
  type TeactNode, useCallback, useEffect, useMemo, useRef,
} from '@teact';
import { getActions, getGlobal, getPromiseActions } from '../../global';

import type { GlobalState } from '../../global/types';
import { ApiMessageEntityTypes } from '../../api/types';

import { toNonBounceableAddress } from '../../lib/ton/address';
import { getUserFullName } from '../../global/helpers';
import { selectIsWalletAvailable, selectTonExplorerUrl, selectWalletAddressOwner } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';
import { parseTonTransferAddress } from '../../util/tonAddress';

import useSelector from '../../hooks/data/useSelector';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Menu from '../ui/Menu';
import MenuItem, { MenuItemSubtitle, MenuItemTitle } from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import Skeleton from '../ui/placeholder/Skeleton';
import Avatar, { AVATAR_SIZES } from './Avatar';

import styles from './TonAddressLink.module.scss';

type OwnProps = {
  address: string;
  noCopy?: boolean;
  children?: TeactNode;
};

// Under the line heights of the title and the subtitle, so the skeleton does not make the item taller
const NAME_SKELETON_WIDTH = 80;
const NAME_SKELETON_HEIGHT = 12;
const LINK_SKELETON_WIDTH = 64;
const LINK_SKELETON_HEIGHT = 10;

const TonAddressLink = ({ address, noCopy, children }: OwnProps) => {
  const {
    showNotification, openWalletTransferLink, openUrl, openChatWithInfo,
  } = getActions();
  const lang = useLang();

  const ref = useRef<HTMLAnchorElement>();
  const menuRef = useRef<HTMLDivElement>();

  const [isOwnerLookupDone, markOwnerLookupDone, unmarkOwnerLookupDone] = useFlag();

  const nonBounceableAddress = useMemo(() => {
    return parseTonTransferAddress(address) ? toNonBounceableAddress(address) : undefined;
  }, [address]);

  const isWalletAvailable = useSelector(selectIsWalletAvailable);
  const ownerSelector = useCallback((global: GlobalState) => {
    return nonBounceableAddress ? selectWalletAddressOwner(global, nonBounceableAddress) : undefined;
  }, [nonBounceableAddress]);
  const owner = useSelector(ownerSelector);
  const ownerUser = owner || undefined;

  // In a protected chat an address the wallet cannot take leaves no items; the last flag stops a long tap here
  const {
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, noCopy && !nonBounceableAddress, undefined, undefined, undefined, true);

  useEffect(() => {
    if (!isContextMenuOpen || !nonBounceableAddress || owner !== undefined) return undefined;

    let isCancelled = false;

    getPromiseActions().loadWalletUserAddresses({ addresses: [nonBounceableAddress] }).then(() => {
      // `owner` catches up with the global only at the end of the tick, so only a lookup that stored nothing is marked
      if (!isCancelled && selectWalletAddressOwner(getGlobal(), nonBounceableAddress) === undefined) {
        markOwnerLookupDone();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isContextMenuOpen, nonBounceableAddress, owner]);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleMenuHide = useLastCallback(() => {
    handleContextMenuHide();
    unmarkOwnerLookupDone();
  });

  const handleSendMoney = useLastCallback(() => {
    openWalletTransferLink({ to: address });
  });

  const handleCopy = useLastCallback(() => {
    copyTextToClipboard(address);
    showNotification({ message: { key: 'WalletAddressCopied' } });
  });

  // A URL from the app config needs no open-link prompt, as for gift links
  const handleOpenInExplorer = useLastCallback(() => {
    openUrl({ url: `${selectTonExplorerUrl(getGlobal())}${encodeURIComponent(address)}`, shouldSkipModal: true });
  });

  const handleOpenProfile = useLastCallback(() => {
    openChatWithInfo({ id: ownerUser!.id });
  });

  const isOwnerMissing = !ownerUser && (owner === false || isOwnerLookupDone);

  // One item serves all three states, so the open menu keeps its size
  function renderOwnerRow() {
    const warning = (
      <div className={buildClassName(styles.noAccount, isOwnerMissing ? styles.appear : styles.invisible)}>
        {lang('WalletAddressNoLinkedAccount', undefined, { withNodes: true, renderTextFilters: ['br'] })}
      </div>
    );

    if (ownerUser) {
      return (
        <MenuItem
          className={styles.appear}
          customIcon={<Avatar size="small" peer={ownerUser} className={styles.avatar} />}
          onClick={handleOpenProfile}
        >
          <MenuItemTitle>{getUserFullName(lang, ownerUser)}</MenuItemTitle>
          <MenuItemSubtitle>{lang('HeaderMenuViewProfile')}</MenuItemSubtitle>
          {warning}
        </MenuItem>
      );
    }

    const skeletonClassName = isOwnerMissing ? styles.invisible : undefined;

    return (
      <MenuItem
        className={styles.placeholder}
        customIcon={(
          <Skeleton
            variant="round"
            animation="wave"
            width={AVATAR_SIZES.small}
            height={AVATAR_SIZES.small}
            className={buildClassName(styles.avatar, skeletonClassName)}
          />
        )}
      >
        <MenuItemTitle>
          <Skeleton
            inline
            animation="wave"
            width={NAME_SKELETON_WIDTH}
            height={NAME_SKELETON_HEIGHT}
            className={buildClassName(styles.lineSkeleton, skeletonClassName)}
          />
        </MenuItemTitle>
        <MenuItemSubtitle>
          <Skeleton
            inline
            animation="wave"
            width={LINK_SKELETON_WIDTH}
            height={LINK_SKELETON_HEIGHT}
            className={buildClassName(styles.lineSkeleton, skeletonClassName)}
          />
        </MenuItemSubtitle>
        {warning}
      </MenuItem>
    );
  }

  return (
    <a
      ref={ref}
      onClick={handleContextMenu}
      onContextMenu={handleContextMenu}
      className="text-entity-link"
      dir="auto"
      data-entity-type={ApiMessageEntityTypes.TonAddress}
    >
      {children}
      <Menu
        ref={menuRef}
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleMenuHide}
        withPortal
        autoClose
      >
        {nonBounceableAddress && isWalletAvailable && (
          <MenuItem icon="gram-outline" onClick={handleSendMoney}>{lang('WalletSendMoney')}</MenuItem>
        )}
        {!noCopy && <MenuItem icon="copy" onClick={handleCopy}>{lang('WalletCopyAddress')}</MenuItem>}
        {nonBounceableAddress && (
          <>
            <MenuItem icon="search" onClick={handleOpenInExplorer}>{lang('WalletViewInExplorer')}</MenuItem>
            <MenuSeparator />
            {renderOwnerRow()}
          </>
        )}
      </Menu>
    </a>
  );
};

export default TonAddressLink;
