import type { ActionOptions } from '../lib/teact/teactn';
import { typify } from '../lib/teact/teactn';

import type {
  ActionPayloads, GlobalState, RequiredActionPayloads, RequiredGlobalState,
} from './types';

const typed = typify<GlobalState, ActionPayloads & RequiredActionPayloads>();

type ProjectActionTypes =
  ActionPayloads
  & RequiredActionPayloads;

type ProjectActionNames = keyof ProjectActionTypes;

type Helper<T, E> = Exclude<T, E> extends never ? {} : Exclude<T, E>;

export type TabStateActionNames = {
  [ActionName in ProjectActionNames]:
  'tabId' extends keyof Helper<ProjectActionTypes[ActionName], undefined> ? ActionName : never
}[ProjectActionNames];
// `Required` actions are called from actions to ensure the `tabId` is always provided if needed.
// There are three types of actions:
// 1. With tabId, which is made required when calling action from another action handler
// 2. Without payload (= undefined), hence made the payload not required
// 3. With payload, hence made the payload required
export type RequiredGlobalActions = {
  [ActionName in ProjectActionNames]: ActionName extends TabStateActionNames ? ((
    payload: ProjectActionTypes[ActionName] & { tabId: number },
    options?: ActionOptions,
  ) => void) :
    (undefined extends ProjectActionTypes[ActionName] ? (
      (payload?: ProjectActionTypes[ActionName], options?: ActionOptions) => void
    ) : (
      (payload: ProjectActionTypes[ActionName], options?: ActionOptions) => void
    ))
} & { _: never };

type ActionHandlers = {
  [ActionName in keyof ProjectActionTypes]: (
    global: RequiredGlobalState,
    actions: RequiredGlobalActions,
    payload: ProjectActionTypes[ActionName],
  ) => GlobalState | void | Promise<void>;
};

export const getGlobal = typed.getGlobal;
export const setGlobal = typed.setGlobal;
export const getActions = typed.getActions;
export const addActionHandler = typed.addActionHandler as <ActionName extends ProjectActionNames>(
  name: ActionName,
  handler: ActionHandlers[ActionName],
) => void;
export const withGlobal = typed.withGlobal;
export type GlobalActions = ReturnType<typeof getActions>;
