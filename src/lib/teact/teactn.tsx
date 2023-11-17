/* eslint-disable react/jsx-props-no-spreading */
import type { FC, FC_withDebug, Props } from './teact';

import { DEBUG, DEBUG_MORE } from '../../config';
import arePropsShallowEqual, { logUnequalProps } from '../../util/arePropsShallowEqual';
import { handleError } from '../../util/handleError';
import { orderBy } from '../../util/iteratees';
import { throttleWithTickEnd } from '../../util/schedulers';
import { requestMeasure } from '../fasterdom/fasterdom';
// eslint-disable-next-line import/no-cycle
import { withGlobal as withGlobalReact } from '../react/reactn';
import React, { DEBUG_resolveComponentName, useEffect } from './teact';

import useForceUpdate from '../../hooks/useForceUpdate';
import { isHeavyAnimating } from '../../hooks/useHeavyAnimationCheck';
import useUniqueId from '../../hooks/useUniqueId';

export default React;

export interface Container {
  mapStateToProps: MapStateToProps<any>;
  activationFn?: ActivationFn<any>;
  stuckTo?: any;
  ownProps: Props;
  mappedProps?: Props;
  forceUpdate: Function;
  DEBUG_updates: number;
  DEBUG_componentName: string;
}

type GlobalState =
  AnyLiteral
  & { DEBUG_capturedId?: number };
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

export type MapStateToProps<OwnProps = undefined> = (global: GlobalState, ownProps: OwnProps) => AnyLiteral;
type StickToFirstFn = (value: any) => boolean;
export type ActivationFn<OwnProps = undefined> = (
  global: GlobalState, ownProps: OwnProps, stickToFirst: StickToFirstFn,
) => boolean;

// eslint-disable-next-line import/no-mutable-exports
export let currentGlobal = {} as GlobalState;

// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_currentCapturedId: number | undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention
const DEBUG_releaseCapturedIdThrottled = throttleWithTickEnd(() => {
  DEBUG_currentCapturedId = undefined;
});

const actionHandlers: Record<string, ActionHandler[]> = {};
const callbacks: Function[] = [updateContainers];
const actions = {} as Actions;
export const containers = new Map<string, Container>();

const runCallbacksThrottled = throttleWithTickEnd(runCallbacks);

let forceOnHeavyAnimation = true;

function runCallbacks() {
  if (forceOnHeavyAnimation) {
    forceOnHeavyAnimation = false;
  } else if (isHeavyAnimating()) {
    requestMeasure(runCallbacksThrottled);
    return;
  }

  callbacks.forEach((cb) => cb(currentGlobal));
}

export function setGlobal(newGlobal?: GlobalState, options?: ActionOptions) {
  if (typeof newGlobal === 'object' && newGlobal !== currentGlobal) {
    if (DEBUG) {
      if (
        !options?.forceOutdated
        && newGlobal.DEBUG_capturedId && newGlobal.DEBUG_capturedId !== DEBUG_currentCapturedId
      ) {
        throw new Error('[TeactN.setGlobal] Attempt to set an outdated global');
      }

      DEBUG_currentCapturedId = undefined;
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

export function getGlobal() {
  if (DEBUG) {
    DEBUG_currentCapturedId = Math.random();
    currentGlobal = {
      ...currentGlobal,
      DEBUG_capturedId: DEBUG_currentCapturedId,
    };
    DEBUG_releaseCapturedIdThrottled();
  }

  return currentGlobal;
}

export function getActions() {
  return actions;
}

export function forceOnHeavyAnimationOnce() {
  forceOnHeavyAnimation = true;
}

let actionQueue: NoneToVoidFunction[] = [];

function handleAction(name: string, payload?: ActionPayload, options?: ActionOptions) {
  actionQueue.push(() => {
    actionHandlers[name]?.forEach((handler) => {
      const response = handler(DEBUG ? getGlobal() : currentGlobal, actions, payload);
      if (!response || typeof response.then === 'function') {
        return;
      }

      // eslint-disable-next-line eslint-multitab-tt/set-global-only-variable
      setGlobal(response as GlobalState, options);
    });
  });

  if (actionQueue.length === 1) {
    try {
      while (actionQueue.length) {
        actionQueue[0]();
        actionQueue.shift();
      }
    } finally {
      actionQueue = [];
    }
  }
}

function updateContainers() {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let DEBUG_startAt: number | undefined;
  if (DEBUG) {
    DEBUG_startAt = performance.now();
  }

  // eslint-disable-next-line no-restricted-syntax
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
          // eslint-disable-next-line max-len
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

export function addActionHandler(name: ActionNames, handler: ActionHandler) {
  if (!actionHandlers[name]) {
    actionHandlers[name] = [];

    actions[name] = (payload?: ActionPayload, options?: ActionOptions) => {
      handleAction(name, payload, options);
    };
  }

  actionHandlers[name].push(handler);
}

export function addCallback(cb: Function) {
  callbacks.push(cb);
}

export function removeCallback(cb: Function) {
  const index = callbacks.indexOf(cb);
  if (index !== -1) {
    callbacks.splice(index, 1);
  }
}

export function withGlobal<OwnProps extends AnyLiteral>(
  mapStateToProps: MapStateToProps<OwnProps> = () => ({}),
  activationFn?: ActivationFn<OwnProps>,
) {
  return (Component: FC) => {
    function TeactNContainer(props: OwnProps) {
      const id = useUniqueId();
      const forceUpdate = useForceUpdate();

      useEffect(() => {
        return () => {
          containers.delete(id);
        };
      }, [id]);

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

      if (!container.mappedProps || (
        !arePropsShallowEqual(container.ownProps, props) && activateContainer(container, currentGlobal, props)
      )) {
        try {
          container.mappedProps = mapStateToProps(currentGlobal, props);
        } catch (err: any) {
          handleError(err);
        }
      }

      container.ownProps = props;

      // eslint-disable-next-line react/jsx-props-no-spreading
      return <Component {...container.mappedProps} {...props} />;
    }

    (TeactNContainer as FC_withDebug).DEBUG_contentComponentName = DEBUG_resolveComponentName(Component);

    return TeactNContainer;
  };
}

export function activateContainer(container: Container, global: GlobalState, props: Props) {
  const { activationFn, stuckTo } = container;
  if (!activationFn) {
    return true;
  }

  return activationFn(global, props, (stickTo: any) => {
    if (stickTo && !stuckTo) {
      container.stuckTo = stickTo;
    }

    return stickTo && (!stuckTo || stuckTo === stickTo);
  });
}

export function typify<
  ProjectGlobalState,
  ActionPayloads,
>() {
  type ProjectActionNames = keyof ActionPayloads;

  // When payload is allowed to be `undefined` we consider it optional
  type ProjectActions = {
    [ActionName in ProjectActionNames]:
    (undefined extends ActionPayloads[ActionName] ? (
      (payload?: ActionPayloads[ActionName], options?: ActionOptions) => void
    ) : (
      (payload: ActionPayloads[ActionName], options?: ActionOptions) => void
    ))
  };

  type ActionHandlers = {
    [ActionName in keyof ActionPayloads]: (
      global: ProjectGlobalState,
      actions: ProjectActions,
      payload: ActionPayloads[ActionName],
    ) => ProjectGlobalState | void | Promise<void>;
  };

  return {
    getGlobal: getGlobal as <T extends ProjectGlobalState>() => T,
    setGlobal: setGlobal as (state: ProjectGlobalState, options?: ActionOptions) => void,
    getActions: getActions as () => ProjectActions,
    addActionHandler: addActionHandler as <ActionName extends ProjectActionNames>(
      name: ActionName,
      handler: ActionHandlers[ActionName],
    ) => void,
    withGlobal: withGlobal as <OwnProps extends AnyLiteral>(
      mapStateToProps: (global: ProjectGlobalState, ownProps: OwnProps) => AnyLiteral,
      activationFn?: (global: ProjectGlobalState, ownProps: OwnProps, stickToFirst: StickToFirstFn) => boolean,
    ) => (Component: FC) => FC<OwnProps>,
    withGlobalReact: withGlobalReact as <OwnProps extends AnyLiteral>(
      mapStateToProps: (global: ProjectGlobalState, ownProps: OwnProps) => AnyLiteral,
      activationFn?: (global: ProjectGlobalState, ownProps: OwnProps, stickToFirst: StickToFirstFn) => boolean,
    ) => (Component: FC) => FC<OwnProps>,
  };
}

if (DEBUG) {
  (window as any).getGlobal = getGlobal;
  (window as any).setGlobal = setGlobal;

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
