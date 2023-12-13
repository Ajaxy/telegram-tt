import { DEFAULT_WORKSPACE } from '../config';
import { useStorage } from './useStorage';

export function useWorkspaces() {
  const {
    currentWorkspaceId, setCurrentWorkspaceId, savedWorkspaces, setSavedWorkspaces,
  } = useStorage();

  const allWorkspaces = [DEFAULT_WORKSPACE, ...savedWorkspaces];

  const getWorkspaceById = (wsId: string) => allWorkspaces.find((ws) => ws.id === wsId) || DEFAULT_WORKSPACE; // todo;

  const currentWorkspace = getWorkspaceById(currentWorkspaceId);

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
