import type { Workspace } from '../types';

import { DEFAULT_WORKSPACE } from '../config';
import { useStorage } from './useStorage';

export function useWorkspaces() {
  const { currentWorkspaceId, savedWorkspaces } = useStorage();

  const currentWorkspace = savedWorkspaces.find((ws) => ws.id === currentWorkspaceId) || DEFAULT_WORKSPACE;

  return { currentWorkspace, savedWorkspaces };
}
