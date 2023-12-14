import type { ChatTimeSnapshot, Workspace } from '../../types';

import { DEFAULT_WORKSPACE, LOCAL_STORAGE_KEYS } from '../../config';
import { LocalStorage } from '../../lib/localStorage';
import { actualizeChatTimeSnapshot, buildChatTimeSnapshot } from '../helpers';

const lsWorkspaces = new LocalStorage<Workspace[]>();
const lsCurrentWorkspaceId = new LocalStorage<string>();

function getWorkspaces() {
  const savedWorkspaces = lsWorkspaces.getOrFallback(LOCAL_STORAGE_KEYS.WORKSPACES, [])!;
  const currentWorkspaceId = lsCurrentWorkspaceId.getOrFallback(
    LOCAL_STORAGE_KEYS.CURRENT_WORKSPACE_ID,
    DEFAULT_WORKSPACE.id,
  );

  const getWorkspaceById = (wsId: string) => (
    savedWorkspaces.find((ws: Workspace) => ws.id === wsId)
    || DEFAULT_WORKSPACE
  );

  const currentWorkspace = getWorkspaceById(currentWorkspaceId!);

  const allWorkspaces = [DEFAULT_WORKSPACE, ...savedWorkspaces];

  return {
    currentWorkspaceId,
    currentWorkspace,
    savedWorkspaces,
    allWorkspaces,
  };
}

function saveWorkspace(workspace: Workspace) {
  const { savedWorkspaces } = getWorkspaces();
  const workspaceIndex = savedWorkspaces.findIndex((ws) => ws.id === workspace.id);
  const newSavedWorkspaces = [...savedWorkspaces];
  if (workspaceIndex === -1) {
    newSavedWorkspaces.push(workspace);
  } else {
    newSavedWorkspaces[workspaceIndex] = workspace;
  }

  lsWorkspaces.set(LOCAL_STORAGE_KEYS.WORKSPACES, newSavedWorkspaces);
}

export function isWorkspaceChatTimeSnapshotStale(chatTimeSnapshot: ChatTimeSnapshot) {
  const currentTime = Date.now();

  function isOlderThanXHours(timestamp: number, hours: number) {
    const timeDifferenceInMilliseconds = currentTime - timestamp;
    const timeDifferenceInHours = timeDifferenceInMilliseconds / (1000 * 60 * 60);

    return timeDifferenceInHours > hours;
  }

  return isOlderThanXHours((chatTimeSnapshot.dateUpdated || chatTimeSnapshot.dateAdded), 12);
}

export function addChatToCurrentWorkspaceTemp(chatId: string) {
  const { currentWorkspace } = getWorkspaces();
  const { chatSnapshotsTemp = [] } = currentWorkspace;
  const index = chatSnapshotsTemp.findIndex((chatSnapshot) => chatSnapshot.id === chatId);
  const newChatSnapshot = index === -1
    ? buildChatTimeSnapshot(chatId)
    : actualizeChatTimeSnapshot(chatSnapshotsTemp[index]);

  const newChatSnapshotsTemp = index === -1
    ? [...chatSnapshotsTemp, newChatSnapshot]
    : [...chatSnapshotsTemp.slice(0, index), newChatSnapshot, ...chatSnapshotsTemp.slice(index + 1)];

  const newCurrentWorkspace: Workspace = { ...currentWorkspace, chatSnapshotsTemp: newChatSnapshotsTemp };
  saveWorkspace(newCurrentWorkspace);
}
