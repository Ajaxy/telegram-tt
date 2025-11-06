import { useEffect, useState } from '../lib/teact/teact';
import { getGlobal } from '../global';

import type { ApiUser } from '../api/types';

import { SESSION_ACCOUNT_PREFIX } from '../config';
import { getChatAvatarHash } from '../global/helpers';
import { selectIsSynced } from '../global/selectors';
import { preloadImage } from '../util/files';
import { resizeImage } from '../util/imageResize';
import { ACCOUNT_SLOT, getAccountsInfo, storeAccountData } from '../util/multiaccount';
import useSelector from './data/useSelector';
import useInterval from './schedulers/useInterval';
import useLastCallback from './useLastCallback';
import useMedia from './useMedia';
import useThrottledCallback from './useThrottledCallback';

const LOCAL_STORAGE_LISTENING_THROTTLE = 1000;
const REFRESH_INTERVAL = 1000 * 60;
const PREVIEW_SIZE = 72;

export default function useMultiaccountInfo(currentUser?: ApiUser) {
  const isUpdater = Boolean(currentUser) && getGlobal().authRememberMe;
  const isSynced = useSelector(selectIsSynced);

  const [accountsInfo, setAccountsInfo] = useState(() => getAccountsInfo());

  const avatarHash = currentUser && getChatAvatarHash(currentUser);
  const avatarUrl = useMedia(avatarHash, !isUpdater);

  const refresh = useThrottledCallback(() => {
    setAccountsInfo(getAccountsInfo());
  }, [], LOCAL_STORAGE_LISTENING_THROTTLE);

  useEffect(() => {
    if (!isUpdater || !isSynced) return;
    const color = currentUser.color?.type === 'regular' ? currentUser.color.color : undefined;
    storeAccountData(ACCOUNT_SLOT, {
      userId: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      emojiStatusId: currentUser.emojiStatus?.documentId,
      color,
      isPremium: currentUser.isPremium,
      phone: currentUser.phoneNumber,
    });

    refresh();
  }, [
    isUpdater, currentUser?.emojiStatus?.documentId, currentUser?.firstName, currentUser?.id, currentUser?.lastName,
    currentUser?.color, currentUser?.isPremium, currentUser?.phoneNumber, refresh, isSynced,
  ]);

  const updateAvatar = useLastCallback(async (url: string, abortSignal?: AbortSignal) => {
    const resizedAvatar = await resizeImage(url, PREVIEW_SIZE, PREVIEW_SIZE);
    const img = await preloadImage(resizedAvatar);
    if (abortSignal?.aborted) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    storeAccountData(ACCOUNT_SLOT, { avatarUri: dataUrl });

    refresh();
  });

  useEffect(() => {
    if (!avatarUrl || !isUpdater || !isSynced) return undefined;
    const controller = new AbortController();
    updateAvatar(avatarUrl, controller.signal);

    return () => {
      controller.abort();
    };
  }, [avatarUrl, isSynced, isUpdater]);

  // Storage event only thrown when other tabs change the storage
  useInterval(refresh, REFRESH_INTERVAL);
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (!e.key?.startsWith(SESSION_ACCOUNT_PREFIX)) return;
      refresh();
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refresh]);

  return accountsInfo;
}
