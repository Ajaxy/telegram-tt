import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { AccountInfo, CustomPeer } from '../../../types';

import { temporarilySuspendCacheUpdate } from '../../../global/cache';
import { getCurrentMaxAccountCount, getCurrentProdAccountCount } from '../../../global/helpers';
import { IS_SAFARI } from '../../../util/browser/windowEnvironment';
import { getAccountSlotUrl } from '../../../util/multiaccount';
import { REM } from '../../common/helpers/mediaDimensions';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMultiaccountInfo from '../../../hooks/useMultiaccountInfo';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

type OwnProps = {
  currentUser: ApiUser;
  totalLimit: number;
  onSelectCurrent?: VoidFunction;
  onSwitchAccount: (url: string) => void;
};

const NOTIFICATION_DURATION = 7000;

const AccountMenuItems = ({
  currentUser,
  totalLimit,
  onSelectCurrent,
  onSwitchAccount,
}: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const accounts = useMultiaccountInfo(currentUser);

  const currentCount = getCurrentProdAccountCount();
  const maxCount = getCurrentMaxAccountCount();

  const currentAccountInfo = useMemo(() => {
    return Object.values(accounts).find((account) => account.userId === currentUser.id);
  }, [accounts, currentUser.id]);

  const shouldShowLimit = currentCount >= maxCount;

  const handleAccountClick = useLastCallback((account: AccountInfo, e: React.SyntheticEvent<HTMLElement>) => {
    if (account.userId === currentUser.id) {
      onSelectCurrent?.();
      return;
    }

    handleAccountNavigation(e);
  });

  const handleNewAccountClick = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    if (shouldShowLimit) {
      showNotification({
        title: lang('PremiumLimitAccountsTitle'),
        message: currentUser.isPremium ? lang('PremiumLimitAccounts') : lang('PremiumLimitAccountsNoPremium'),
        duration: NOTIFICATION_DURATION,
      });
      return;
    }

    handleAccountNavigation(e);
  });

  function handleAccountNavigation(e: React.SyntheticEvent<HTMLElement>) {
    if (!(e instanceof MouseEvent) || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey
      || !(e.currentTarget instanceof HTMLAnchorElement)) {
      return;
    }

    e.preventDefault();
    // IDB locks up if we write large payload on navigation
    if (IS_SAFARI) temporarilySuspendCacheUpdate();
    onSwitchAccount(e.currentTarget.href);
  }

  const newAccountUrl = useMemo(() => {
    if (!Object.values(accounts).length) {
      return undefined;
    }

    if (currentCount === totalLimit) {
      return undefined;
    }

    let freeIndex = 1;
    while (accounts[freeIndex]) {
      freeIndex += 1;
    }

    return getAccountSlotUrl(freeIndex, true);
  }, [accounts, currentCount, totalLimit]);

  return (
    <>
      {Object.entries(accounts || {})
        .sort(([, account]) => (account.userId === currentUser.id ? -1 : 1))
        .map(([slot, account], index, arr) => {
          const isSameServer = account.isTest === currentAccountInfo?.isTest;
          const mockUser: CustomPeer = {
            title: [account.firstName, account.lastName].filter(Boolean).join(' '),
            isCustomPeer: true,
            peerColorId: account.color,
            emojiStatusId: isSameServer ? account.emojiStatusId : undefined,
            isPremium: account.isPremium,
          };

          const hasSeparator = account.userId === currentUser.id && (newAccountUrl || arr.length > 1);

          return (
            <>
              <MenuItem
                className="account-menu-item"
                customIcon={(
                  <Avatar
                    size="mini"
                    className="account-avatar"
                    peer={mockUser}
                    previewUrl={account.avatarUri}
                  />
                )}
                onClick={(e) => handleAccountClick(account, e)}
                href={account.userId !== currentUser.id ? getAccountSlotUrl(Number(slot)) : undefined}
              >
                {account.isTest && <span className="account-menu-item-test">T</span>}
                <FullNameTitle peer={mockUser} withEmojiStatus emojiStatusSize={REM} />
              </MenuItem>
              {hasSeparator && <MenuSeparator />}
            </>
          );
        })}
      {newAccountUrl && (
        <MenuItem
          icon="add"
          rel="noopener" // Allow referrer to be passed
          href={!shouldShowLimit ? newAccountUrl : undefined}
          onClick={handleNewAccountClick}
        >
          {lang('MenuAddAccount')}
        </MenuItem>
      )}
    </>
  );
};

export default memo(AccountMenuItems);
