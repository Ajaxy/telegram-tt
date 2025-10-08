import type { FC, FC_withDebug, Props } from './teact';

import { DEBUG, DEBUG_MORE } from '../../config';
import arePropsShallowEqual, { logUnequalProps } from '../../util/arePropsShallowEqual';
import Deferred from '../../util/Deferred';
import { handleError } from '../../util/handleError';
import { orderBy } from '../../util/iteratees';
import { throttleWithTickEnd } from '../../util/schedulers';
import React, { DEBUG_resolveComponentName, getIsHeavyAnimating, useUnmountCleanup } from './teact';

import useForceUpdate from '../../hooks/useForceUpdate';
import useUniqueId from '../../hooks/useUniqueId';

export default React;

interface Container {
  mapStateToProps: MapStateToProps<any>;
  activationFn?: ActivationFn<any>;
  stuckTo?: any;
  ownProps: Props;
  mappedProps?: Props;
  forceUpdate: VoidFunction;
  DEBUG_updates: number;
  DEBUG_componentName: string;
}

type GlobalState =
  AnyLiteral
  & { DEBUG_randomId?: number };
type ActionNames = string;
type ActionPayload = any;

export interface ActionOptions {
  forceOnHeavyAnimation?: boolean;
  // Workaround for iOS gesture history navigation
  forceSyncOnIOs?: boolean;
  forceOutdated?: boolean;
}

type Actions = Record<ActionNames, (payload?: ActionPayload, options?: ActionOptions) => void>;

type ActionHandler = (
  global: GlobalState,
  actions: Actions,
  payload: any,
) => GlobalState | void | Promise<void>;

type MapStateToProps<OwnProps = undefined> = (global: GlobalState, ownProps: OwnProps) => AnyLiteral;
type StickToFirstFn = (value: any) => boolean;
type ActivationFn<OwnProps = undefined> = (
  global: GlobalState, ownProps: OwnProps, stickToFirst: StickToFirstFn,
) => boolean;
// TODO: Add callback to typify
type GlobalCallback = (global: any) => void;

let currentGlobal = {
  isInited: false,
} as GlobalState;

let DEBUG_currentRandomId: number | undefined;

const DEBUG_invalidateGlobalOnTickEnd = throttleWithTickEnd(() => {
  DEBUG_currentRandomId = Math.random();
});

const actionHandlers: Record<string, ActionHandler[]> = {};
const callbacks: GlobalCallback[] = [updateContainers];
const actions = {} as Actions;
const containers = new Map<string, Container>();

const runCallbacksThrottled = throttleWithTickEnd(runCallbacks);

let forceOnHeavyAnimation = true;

function runCallbacks() {
  if (forceOnHeavyAnimation) {
    forceOnHeavyAnimation = false;
  } else if (getIsHeavyAnimating()) {
    getIsHeavyAnimating.once(runCallbacksThrottled);
    return;
  }

  callbacks.forEach((cb) => cb(currentGlobal));
}

export function setUntypedGlobal(newGlobal?: GlobalState, options?: ActionOptions) {
  if (typeof newGlobal === 'object' && newGlobal !== currentGlobal) {
    if (DEBUG) {
      if (
        !options?.forceOutdated
        && newGlobal.DEBUG_randomId && newGlobal.DEBUG_randomId !== DEBUG_currentRandomId
      ) {
        throw new Error('[TeactN.setGlobal] Attempt to set an outdated global');
      }

      DEBUG_currentRandomId = Math.random();
    }

    currentGlobal = newGlobal;

    if (options?.forceSyncOnIOs) {
      forceOnHeavyAnimation = true;
      runCallbacks();
    } else {
      if (options?.forceOnHeavyAnimation) {
        forceOnHeavyAnimation = true;
      }

      runCallbacksThrottled();
    }
  }
}

export function getUntypedGlobal() {
  if (DEBUG) {
    currentGlobal = {
      ...currentGlobal,
      DEBUG_randomId: DEBUG_currentRandomId,
    };
    DEBUG_invalidateGlobalOnTickEnd();
  }

  return currentGlobal;
}

export function getUntypedActions() {
  return actions;
}

export function forceOnHeavyAnimationOnce() {
  forceOnHeavyAnimation = true;
}

let actionQueue: NoneToVoidFunction[] = [];
let afterActionQueue: NoneToVoidFunction[] = [];

function handleAction(name: string, payload?: ActionPayload, options?: ActionOptions): Promise<void> {
  const deferred = new Deferred<void>();
  actionQueue.push(() => {
    actionHandlers[name]?.forEach((handler) => {
      const result = handler(DEBUG ? getUntypedGlobal() : currentGlobal, actions, payload);
      if (!result) {
        deferred.resolve();
        return;
      }

      if (typeof result.then === 'function') {
        result.then(() => {
          deferred.resolve();
        });
        return;
      }

      setUntypedGlobal(result as GlobalState, options);
      deferred.resolve();
    });
  });

  // Important: Keep 1 as start requirement to avoid immediate nested action calls
  // Do not remove element from array before it is executed for the same reason
  if (actionQueue.length === 1) {
    try {
      while (actionQueue.length) {
        actionQueue[0]();
        actionQueue.shift();
      }
      while (afterActionQueue.length) {
        afterActionQueue[0]();
        afterActionQueue.shift();
      }
    } finally {
      actionQueue = [];
      afterActionQueue = [];
    }
  }

  return deferred.promise;
}

/**
 * Execute a function after all actions in stack are executed
 * Call only from action handlers
 */
export function execAfterActions(fn: NoneToVoidFunction) {
  afterActionQueue.push(fn);
}

function updateContainers() {
  let DEBUG_startAt: number | undefined;
  if (DEBUG) {
    DEBUG_startAt = performance.now();
  }

  for (const container of containers.values()) {
    const {
      mapStateToProps, ownProps, mappedProps, forceUpdate,
    } = container;

    if (!activateContainer(container, currentGlobal, ownProps)) {
      continue;
    }

    let newMappedProps;

    try {
      newMappedProps = mapStateToProps(currentGlobal, ownProps);
    } catch (err: any) {
      handleError(err);

      return;
    }

    if (DEBUG) {
      if (Object.values(newMappedProps).some(Number.isNaN)) {
        // eslint-disable-next-line no-console
        console.warn(
          // eslint-disable-next-line @stylistic/max-len
          `[TeactN] Some of \`${container.DEBUG_componentName}\` mappers contain NaN values. This may cause redundant updates because of incorrect equality check.`,
        );
      }
    }

    if (Object.keys(newMappedProps).length && !arePropsShallowEqual(mappedProps!, newMappedProps)) {
      if (DEBUG_MORE) {
        logUnequalProps(
          mappedProps!,
          newMappedProps,
          `[TeactN] Will update ${container.DEBUG_componentName} caused by:`,
        );
      }

      container.mappedProps = newMappedProps;
      container.DEBUG_updates++;

      forceUpdate();
    }
  }

  if (DEBUG) {
    const updateTime = performance.now() - DEBUG_startAt!;
    if (updateTime > 7) {
      // eslint-disable-next-line no-console
      console.warn(`[TeactN] Slow containers update: ${Math.round(updateTime)} ms`);
    }
  }
}

export function addUntypedActionHandler(name: ActionNames, handler: ActionHandler) {
  if (!actionHandlers[name]) {
    actionHandlers[name] = [];

    actions[name] = (payload?: ActionPayload, options?: ActionOptions) => {
      return handleAction(name, payload, options);
    };
  }

  actionHandlers[name].push(handler);
}

export function addCallback(cb: GlobalCallback) {
  callbacks.push(cb);
}

export function removeCallback(cb: GlobalCallback) {
  const index = callbacks.indexOf(cb);
  if (index !== -1) {
    callbacks.splice(index, 1);
  }
}

export function withUntypedGlobal<OwnProps extends AnyLiteral>(
  mapStateToProps: MapStateToProps<OwnProps> = () => ({}),
  activationFn?: ActivationFn<OwnProps>,
) {
  return (Component: FC) => {
    function TeactNContainer(props: OwnProps) {
      const id = useUniqueId();
      const forceUpdate = useForceUpdate();

      useUnmountCleanup(() => {
        containers.delete(id);
      });

      let container = containers.get(id)!;
      if (!container) {
        container = {
          mapStateToProps,
          activationFn,
          ownProps: props,
          forceUpdate,
          DEBUG_updates: 0,
          DEBUG_componentName: Component.name,
        };

        containers.set(id, container);
      }

      if (
        (!container.mappedProps || !arePropsShallowEqual(container.ownProps, props))
        && activateContainer(container, currentGlobal, props)
      ) {
        try {
          container.mappedProps = mapStateToProps(currentGlobal, props);
        } catch (err: any) {
          handleError(err);
        }
      }

      container.ownProps = props;

      return <Component {...container.mappedProps} {...props} />;
    }

    (TeactNContainer as FC_withDebug).DEBUG_contentComponentName = DEBUG_resolveComponentName(Component);

    return TeactNContainer;
  };
}

function activateContainer(container: Container, global: GlobalState, props: Props) {
  const { activationFn, stuckTo } = container;
  if (!activationFn) {
    return true;
  }

  return activationFn(global, props, (stickTo: any) => {
    if (stuckTo) {
      return stuckTo === stickTo;
    } else if (stickTo !== undefined) {
      container.stuckTo = stickTo;
    }

    return true;
  });
}

export function typify<
  ProjectGlobalState,
  ActionPayloads,
>() {
  type ProjectActionNames = keyof ActionPayloads;

  // When payload is allowed to be `undefined` we consider it optional
  type ProjectActions<ReturnType = void> = {
    [ActionName in ProjectActionNames]:
    (undefined extends ActionPayloads[ActionName] ? (
      (payload?: ActionPayloads[ActionName], options?: ActionOptions) => ReturnType
    ) : (
      (payload: ActionPayloads[ActionName], options?: ActionOptions) => ReturnType
    ))
  };

  type ActionHandlers = {
    [ActionName in keyof ActionPayloads]: (
      global: ProjectGlobalState,
      actions: ProjectActions,
      payload: ActionPayloads[ActionName],
    ) => ProjectGlobalState | void | Promise<void>;
  };

  type WithGlobalFn = <OwnProps extends AnyLiteral>(
    mapStateToProps: (global: ProjectGlobalState, ownProps: OwnProps) => AnyLiteral,
    activationFn?: (global: ProjectGlobalState, ownProps: OwnProps, stickToFirst: StickToFirstFn) => boolean,
  ) => (Component: FC) => FC<OwnProps>;

  return {
    getGlobal: getUntypedGlobal as <T extends ProjectGlobalState>() => T,
    setGlobal: setUntypedGlobal as (state: ProjectGlobalState, options?: ActionOptions) => void,
    getActions: getUntypedActions as () => ProjectActions,
    getPromiseActions: getUntypedActions as () => ProjectActions<Promise<void>>,
    addActionHandler: addUntypedActionHandler as <ActionName extends ProjectActionNames>(
      name: ActionName,
      handler: ActionHandlers[ActionName],
    ) => void,
    withGlobal: withUntypedGlobal as WithGlobalFn,
    execAfterActions,
  };
}

if (DEBUG) {
  (window as any).getGlobal = getUntypedGlobal;
  (window as any).setGlobal = setUntypedGlobal;
  (window as any).getActions = getUntypedActions;

  document.addEventListener('dblclick', () => {
    // eslint-disable-next-line no-console
    console.warn(
      'GLOBAL CONTAINERS',
      orderBy(
        Array.from(containers.values())
          .map(({ DEBUG_componentName, DEBUG_updates }) => ({ DEBUG_componentName, DEBUG_updates })),
        'DEBUG_updates',
        'desc',
      ),
    );
  });
}
