import z from 'zod';
import { useEffect, useState } from '../lib/teact/teact';

import type { Workspace } from '../types';
import { WorkspaceSchema } from '../types';

import { DEFAULT_WORKSPACE, LOCAL_STORAGE_KEYS } from '../config';

export function useStorage() {
  const [isAutoDoneEnabled, setIsAutoDoneEnabled] = useLocalStorage<boolean>({
    key: LOCAL_STORAGE_KEYS.IS_AUTO_DONE_ENABLED,
    initValue: false,
    schema: z.boolean(),
  });
  const [
    isAutoArchiverEnabled,
    setIsAutoArchiverEnabled,
  ] = useLocalStorage<boolean>({
    key: LOCAL_STORAGE_KEYS.IS_AUTO_ARCHIVER_ENABLED,
    initValue: false,
    schema: z.boolean(),
  });
  const [
    isArchiveWhenDoneEnabled,
    setIsArchiveWhenDoneEnabled,
  ] = useLocalStorage<boolean>({
    key: LOCAL_STORAGE_KEYS.IS_ARCHIVE_WHEN_DONE_ENABLED,
    initValue: false,
    schema: z.boolean(),
  });
  const [isFoldersTreeEnabled, setIsFoldersTreeEnabled] = useLocalStorage<boolean>({
    key: LOCAL_STORAGE_KEYS.IS_FOLDERS_TREE_ENABLED,
    initValue: false,
    schema: z.boolean(),
  });

  const [doneChatIds, setDoneChatIds] = useLocalStorage<string[]>({
    key: LOCAL_STORAGE_KEYS.DONE_CHAT_IDS,
    initValue: [],
    schema: z.array(z.string()),
  });

  const [savedWorkspaces, setSavedWorkspaces] = useLocalStorage<Workspace[]>({
    key: LOCAL_STORAGE_KEYS.WORKSPACES,
    initValue: [],
    schema: z.array(WorkspaceSchema),
  });
  const [
    currentWorkspaceId,
    setCurrentWorkspaceId,
  ] = useLocalStorage<string>({ key: 'current_workspace_id', initValue: DEFAULT_WORKSPACE.id, schema: z.string() });

  const [
    isInitialMarkAsDone,
    setIsInitialMarkAsDone,
  ] = useLocalStorage<boolean>({
    key: LOCAL_STORAGE_KEYS.IS_INITIAL_MARK_AS_DONE,
    initValue: false,
    schema: z.boolean(),
  });

  return {
    isAutoDoneEnabled,
    setIsAutoDoneEnabled,
    isAutoArchiverEnabled,
    setIsAutoArchiverEnabled,
    isArchiveWhenDoneEnabled,
    setIsArchiveWhenDoneEnabled,
    isFoldersTreeEnabled,
    setIsFoldersTreeEnabled,
    doneChatIds,
    setDoneChatIds,
    savedWorkspaces,
    setSavedWorkspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    isInitialMarkAsDone,
    setIsInitialMarkAsDone,
  };
}

type UseLocalStorageProps<T> = {
  key: string;
  initValue: T;
  schema: z.ZodTypeAny;
};

function useLocalStorage<T>({ key, initValue, schema }: UseLocalStorageProps<T>):
[value: T, setValue: (val: T) => void] {
  const eventName = `update_storage_${key}`;

  const [state, setState] = useState<T>((() => {
    const value = localStorage.getItem(key);
    // eslint-disable-next-line no-null/no-null
    if (value !== null) {
      try {
        const parsedValue = JSON.parse(value);
        const isValid = schema.safeParse(parsedValue).success;
        if (!isValid) {
          throw new Error('Invalid value');
        }

        return parsedValue;
      } catch { /* */ }
    }

    localStorage.setItem(key, JSON.stringify(initValue));
    window.dispatchEvent(new Event(eventName));
    return initValue;
  })());

  useEffect(() => {
    if (JSON.stringify(state) !== localStorage.getItem(key)) { // can be optimized
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new Event(eventName));
    }
  }, [key, state, eventName]);

  useEffect(() => {
    const listenStorageChange = () => {
      setState(() => {
        const value = localStorage.getItem(key);
        // eslint-disable-next-line no-null/no-null
        if (value !== null) {
          try {
            const parsedValue = JSON.parse(value);
            const isValid = schema.safeParse(parsedValue).success;
            if (!isValid) {
              throw new Error('Invalid value');
            }

            return parsedValue;
          } catch { /* */ }
        }

        localStorage.setItem(key, JSON.stringify(initValue));
        window.dispatchEvent(new Event(eventName));
        return initValue;
      });
    };
    window.addEventListener(eventName, listenStorageChange);
    return () => window.removeEventListener(eventName, listenStorageChange);
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, []);

  const setStateFiltered = (value: T) => {
    const updValue = (value === undefined || typeof value !== typeof initValue)
      ? initValue
      : value;
    setState(updValue);
  };

  return [state, setStateFiltered];
}
