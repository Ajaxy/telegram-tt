// import type { Workspace } from '../types';

import { DEFAULT_WORKSPACE } from '../config';
import { useStorage } from './useStorage';

export function useWorkspaces() {
  const {
    currentWorkspaceId, setCurrentWorkspaceId, savedWorkspaces, setSavedWorkspaces,
  } = useStorage();

  const currentWorkspace = savedWorkspaces.find((ws) => ws.id === currentWorkspaceId) || DEFAULT_WORKSPACE; // todo

  const allWorkspaces = [DEFAULT_WORKSPACE, ...savedWorkspaces];

  const getWorkspaceById = (wsId: string) => allWorkspaces.find((ws) => ws.id === wsId);

  return {
    currentWorkspaceId,
    setCurrentWorkspaceId,
    currentWorkspace,
    savedWorkspaces,
    setSavedWorkspaces,
    allWorkspaces,
    getWorkspaceById,
  };
}
