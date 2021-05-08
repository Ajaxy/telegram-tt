import React, {
  FC, FC_withDebug, Props, useEffect, useState,
} from './teact';

import { DEBUG, DEBUG_MORE } from '../../config';
import useForceUpdate from '../../hooks/useForceUpdate';
import generateIdFor from '../../util/generateIdFor';
import { throttleWithRaf } from '../../util/schedulers';
import arePropsShallowEqual, { getUnequalProps } from '../../util/arePropsShallowEqual';
import { orderBy } from '../../util/iteratees';
import { GlobalState, GlobalActions, ActionTypes } from '../../global/types';
import { handleError } from '../../util/handleError';

export default React;

type ActionPayload = AnyLiteral;

type Reducer = (
  global: GlobalState,
  actions: GlobalActions,
  payload: any,
) => GlobalState | void;

type MapStateToProps<OwnProps = undefined> = ((global: GlobalState, ownProps: OwnProps) => AnyLiteral | null);
type MapActionsToProps = ((setGlobal: Function, actions: GlobalActions) => Partial<GlobalActions> | null);

let currentGlobal = {} as GlobalState;

const reducers: Record<string, Reducer[]> = {};
const callbacks: Function[] = [updateContainers];
const actions = {} as GlobalActions;
const containers = new Map<string, {
  mapStateToProps: MapStateToProps<any>;
  mapReducersToProps: MapActionsToProps;
  ownProps: Props;
  mappedProps?: Props;
  forceUpdate: Function;
  areMappedPropsChanged: boolean;
  DEBUG_updates: number;
  DEBUG_componentName: string;
}>();

function runCallbacks() {
  callbacks.forEach((cb) => cb(currentGlobal));
}

const runCallbacksThrottled = throttleWithRaf(runCallbacks);

export function setGlobal(newGlobal?: GlobalState) {
  if (typeof newGlobal === 'object' && newGlobal !== currentGlobal) {
    currentGlobal = newGlobal;
    runCallbacksThrottled();
  }
}

export function getGlobal() {
  return currentGlobal;
}

export function getDispatch() {
  return actions;
}

function onDispatch(name: string, payload?: ActionPayload) {
  if (reducers[name]) {
    reducers[name].forEach((reducer) => {
      const newGlobal = reducer(currentGlobal, actions, payload);
      if (newGlobal) {
        setGlobal(newGlobal);
      }
    });
  }
}

function updateContainers() {
  let DEBUG_startAt: number | undefined;
  if (DEBUG) {
    DEBUG_startAt = performance.now();
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const container of containers.values()) {
    const {
      mapStateToProps, mapReducersToProps, ownProps, mappedProps, forceUpdate,
    } = container;

    let newMappedProps;

    try {
      newMappedProps = {
        ...mapStateToProps(currentGlobal, ownProps),
        ...mapReducersToProps(setGlobal, actions),
      };
    } catch (err) {
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

    actions[name] = (payload?: ActionPayload) => {
      onDispatch(name, payload);
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
  mapReducersToProps: MapActionsToProps = () => ({}),
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
          mapReducersToProps,
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
          container.mappedProps = {
            ...mapStateToProps(currentGlobal, props),
            ...mapReducersToProps(setGlobal, actions),
          };
        } catch (err) {
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
    console.log('GLOBAL CONTAINERS', orderBy(Object.values(containers), 'DEBUG_updates', 'desc'));
  });
}
