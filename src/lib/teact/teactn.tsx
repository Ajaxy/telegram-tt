import React, {
  FC, FC_withDebug, Props, useEffect, useState,
} from './teact';

import { DEBUG, DEBUG_MORE } from '../../config';
import useForceUpdate from '../../hooks/useForceUpdate';
import generateIdFor from '../../util/generateIdFor';
import { fastRaf, throttleWithTickEnd } from '../../util/schedulers';
import arePropsShallowEqual, { getUnequalProps } from '../../util/arePropsShallowEqual';
import { orderBy } from '../../util/iteratees';
import { handleError } from '../../util/handleError';
import { isHeavyAnimating } from '../../hooks/useHeavyAnimationCheck';

export default React;

type GlobalState =
  AnyLiteral
  & { DEBUG_capturedId?: number };
type ActionNames = string;
type ActionPayload = any;

interface ActionOptions {
  forceOnHeavyAnimation?: boolean;
  // Workaround for iOS gesture history navigation
  forceSyncOnIOs?: boolean;
}

type Actions = Record<ActionNames, (payload?: ActionPayload, options?: ActionOptions) => void>;

type ActionHandler = (
  global: GlobalState,
  actions: Actions,
  payload: any,
) => GlobalState | void | Promise<void>;

type MapStateToProps<OwnProps = undefined> = ((global: GlobalState, ownProps: OwnProps) => AnyLiteral);

let currentGlobal = {} as GlobalState;

// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_currentCapturedId: number | undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention
const DEBUG_releaseCapturedIdThrottled = throttleWithTickEnd(() => {
  DEBUG_currentCapturedId = undefined;
});

const actionHandlers: Record<string, ActionHandler[]> = {};
const callbacks: Function[] = [updateContainers];
const actions = {} as Actions;
const containers = new Map<string, {
  mapStateToProps: MapStateToProps<any>;
  ownProps: Props;
  mappedProps?: Props;
  forceUpdate: Function;
  areMappedPropsChanged: boolean;
  DEBUG_updates: number;
  DEBUG_componentName: string;
}>();

const runCallbacksThrottled = throttleWithTickEnd(runCallbacks);

function runCallbacks(forceOnHeavyAnimation = false) {
  if (!forceOnHeavyAnimation && isHeavyAnimating()) {
    fastRaf(runCallbacksThrottled);
    return;
  }

  callbacks.forEach((cb) => cb(currentGlobal));
}

export function setGlobal(newGlobal?: GlobalState, options?: ActionOptions) {
  if (typeof newGlobal === 'object' && newGlobal !== currentGlobal) {
    if (DEBUG) {
      if (newGlobal.DEBUG_capturedId && newGlobal.DEBUG_capturedId !== DEBUG_currentCapturedId) {
        throw new Error('[TeactN.setGlobal] Attempt to set an outdated global');
      }

      DEBUG_currentCapturedId = undefined;
    }

    currentGlobal = newGlobal;
    if (options?.forceSyncOnIOs) {
      runCallbacks(true);
    } else {
      runCallbacksThrottled(options?.forceOnHeavyAnimation);
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

let actionQueue: NoneToVoidFunction[] = [];

function handleAction(name: string, payload?: ActionPayload, options?: ActionOptions) {
  actionQueue.push(() => {
    actionHandlers[name]?.forEach((handler) => {
      const response = handler(DEBUG ? getGlobal() : currentGlobal, actions, payload);
      if (!response || typeof response.then === 'function') {
        return;
      }

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
        // eslint-disable-next-line no-console
        console.log(
          '[TeactN] Will update',
          container.DEBUG_componentName,
          'caused by',
          getUnequalProps(mappedProps!, newMappedProps).join(', '),
        );
      }

      container.mappedProps = newMappedProps;
      container.areMappedPropsChanged = true;
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

export function withGlobal<OwnProps>(
  mapStateToProps: MapStateToProps<OwnProps> = () => ({}),
) {
  return (Component: FC) => {
    return function TeactNContainer(props: OwnProps) {
      (TeactNContainer as FC_withDebug).DEBUG_contentComponentName = Component.name;

      const [id] = useState(generateIdFor(containers));
      const forceUpdate = useForceUpdate();

      useEffect(() => {
        return () => {
          containers.delete(id);
        };
      }, [id]);

      let container = containers.get(id);
      if (!container) {
        container = {
          mapStateToProps,
          ownProps: props,
          areMappedPropsChanged: false,
          forceUpdate,
          DEBUG_updates: 0,
          DEBUG_componentName: Component.name,
        };

        containers.set(id, container);
      }

      if (container.areMappedPropsChanged) {
        container.areMappedPropsChanged = false;
      }

      if (!container.mappedProps || !arePropsShallowEqual(container.ownProps, props)) {
        container.ownProps = props;

        try {
          container.mappedProps = mapStateToProps(currentGlobal, props);
        } catch (err: any) {
          handleError(err);
        }
      }

      // eslint-disable-next-line react/jsx-props-no-spreading
      return <Component {...container.mappedProps} {...props} />;
    };
  };
}

export function typify<ProjectGlobalState, ActionPayloads, NonTypedActionNames extends string = never>() {
  type NonTypedActionPayloads = {
    [ActionName in NonTypedActionNames]: ActionPayload;
  };

  type ProjectActionTypes =
    ActionPayloads
    & NonTypedActionPayloads;

  type ProjectActionNames = keyof ProjectActionTypes;

  type ProjectActions = {
    [ActionName in ProjectActionNames]: (
      payload?: ProjectActionTypes[ActionName],
      options?: ActionOptions,
    ) => void;
  };

  type ActionHandlers = {
    [ActionName in keyof ProjectActionTypes]: (
      global: ProjectGlobalState,
      actions: ProjectActions,
      payload: ProjectActionTypes[ActionName],
    ) => ProjectGlobalState | void | Promise<void>;
  };

  return {
    getGlobal: getGlobal as () => ProjectGlobalState,
    setGlobal: setGlobal as (state: ProjectGlobalState, options?: ActionOptions) => void,
    getActions: getActions as () => ProjectActions,
    addActionHandler: addActionHandler as <ActionName extends ProjectActionNames>(
      name: ActionName,
      handler: ActionHandlers[ActionName],
    ) => void,
    withGlobal: withGlobal as <OwnProps>(
      mapStateToProps: ((global: ProjectGlobalState, ownProps: OwnProps) => AnyLiteral),
    ) => (Component: FC) => FC,
  };
}

if (DEBUG) {
  (window as any).getGlobal = getGlobal;

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
