import { useEffect, useState } from '../lib/teact/teact';
import {
  getOrderedIds,
  getUnreadCounters,
  getChatsCount,
  addOrderedIdsCallback,
  addUnreadCountersCallback,
  addChatsCountCallback,
} from '../util/folderManager';

export function useFolderManagerForOrderedIds(folderId: number) {
  const [orderedIds, setOrderedIds] = useState(getOrderedIds(folderId));

  useEffect(() => addOrderedIdsCallback(folderId, setOrderedIds), [folderId]);

  return orderedIds;
}

export function useFolderManagerForUnreadCounters() {
  const [unreadCounters, setUnreadCounters] = useState(getUnreadCounters());

  useEffect(() => addUnreadCountersCallback(setUnreadCounters), []);

  return unreadCounters;
}

export function useFolderManagerForChatsCount() {
  const [chatsCount, setChatsCount] = useState(getChatsCount());

  useEffect(() => addChatsCountCallback(setChatsCount), []);

  return chatsCount;
}
