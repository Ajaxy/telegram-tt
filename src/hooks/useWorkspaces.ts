// import type { Workspace } from '../types';

import { DEFAULT_WORKSPACE } from '../config';
import { useStorage } from './useStorage';

export function useWorkspaces() {
  const { currentWorkspaceId, setCurrentWorkspaceId, savedWorkspaces } = useStorage();

  const currentWorkspace = savedWorkspaces.find((ws) => ws.id === currentWorkspaceId) || DEFAULT_WORKSPACE; // todo

  const allWorkspaces = [DEFAULT_WORKSPACE, ...savedWorkspaces];

  return {
    currentWorkspaceId,
    setCurrentWorkspaceId,
    currentWorkspace,
    savedWorkspaces,
    allWorkspaces,
  };
}
