import React, {
  FC, FC_withDebug, Props, useEffect, useState,
} from './teact';

import { DEBUG, DEBUG_MORE } from '../../config';
import useForceUpdate from '../../hooks/useForceUpdate';
import generateIdFor from '../../util/generateIdFor';
import { fastRaf, throttleWithTickEnd } from '../../util/schedulers';
import arePropsShallowEqual, { getUnequalProps } from '../../util/arePropsShallowEqual';
import { orderBy } from '../../util/iteratees';
import {
  GlobalState, GlobalActions, ActionTypes, DispatchOptions,
} from '../../global/types';
import { handleError } from '../../util/handleError';
import { isHeavyAnimating } from '../../hooks/useHeavyAnimationCheck';

export default React;

type ActionPayload = AnyLiteral;

type Reducer = (
  global: GlobalState,
  actions: GlobalActions,
  payload: any,
) => GlobalState | void;

type MapStateToProps<OwnProps = undefined> = ((global: GlobalState, ownProps: OwnProps) => AnyLiteral);

let currentGlobal = {} as GlobalState;

const reducers: Record<string, Reducer[]> = {};
const callbacks: Function[] = [updateContainers];
const actions = {} as GlobalActions;
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

export function setGlobal(newGlobal?: GlobalState, options?: DispatchOptions) {
  if (typeof newGlobal === 'object' && newGlobal !== currentGlobal) {
    currentGlobal = newGlobal;
    if (options?.forceSyncOnIOs) {
      runCallbacks(true);
    } else {
      runCallbacksThrottled(options?.forceOnHeavyAnimation);
    }
  }
}

export function getGlobal() {
  return currentGlobal;
}

export function getDispatch() {
  return actions;
}

function onDispatch(name: string, payload?: ActionPayload, options?: DispatchOptions) {
  if (reducers[name]) {
    reducers[name].forEach((reducer) => {
      const newGlobal = reducer(currentGlobal, actions, payload);
      if (newGlobal) {
        setGlobal(newGlobal, options);
      }
    });
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

export function addReducer(name: ActionTypes, reducer: Reducer) {
  if (!reducers[name]) {
    reducers[name] = [];

    actions[name] = (payload?: ActionPayload, options?: DispatchOptions) => {
      onDispatch(name, payload, options);
    };
  }

  reducers[name].push(reducer);
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
