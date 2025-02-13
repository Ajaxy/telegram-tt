import type { ReactElement } from 'react';

import { DEBUG, DEBUG_MORE } from '../../config';
import { logUnequalProps } from '../../util/arePropsShallowEqual';
import { incrementOverlayCounter } from '../../util/debugOverlay';
import { orderBy } from '../../util/iteratees';
import safeExec from '../../util/safeExec';
import { throttleWith } from '../../util/schedulers';
import { createSignal, isSignal, type Signal } from '../../util/signals';
import { requestMeasure, requestMutation } from '../fasterdom/fasterdom';
import { getIsBlockingAnimating } from './heavyAnimation';

export { getIsHeavyAnimating, beginHeavyAnimation, onFullyIdle } from './heavyAnimation';

export type Props = AnyLiteral;
export type FC<P extends Props = any> = (props: P) => any;
// eslint-disable-next-line @typescript-eslint/naming-convention
export type FC_withDebug =
  FC
  & { DEBUG_contentComponentName?: string };

export enum VirtualType {
  Empty,
  Text,
  Tag,
  Component,
  Fragment,
}

interface VirtualElementEmpty {
  type: VirtualType.Empty;
  target?: Node;
}

interface VirtualElementText {
  type: VirtualType.Text;
  target?: Node;
  value: string;
}

export interface VirtualElementTag {
  type: VirtualType.Tag;
  target?: HTMLElement | SVGElement;
  tag: string;
  props: Props;
  children: VirtualElementChildren;
}

export interface VirtualElementComponent {
  type: VirtualType.Component;
  componentInstance: ComponentInstance;
  props: Props;
  children: VirtualElementChildren;
}

export interface VirtualElementFragment {
  type: VirtualType.Fragment;
  children: VirtualElementChildren;
}

export type StateHookSetter<T> = (newValue: ((current: T) => T) | T) => void;

export interface RefObject<T = any> {
  current: T;
  onChange?: NoneToVoidFunction;
}

export enum MountState {
  New,
  Mounted,
  Unmounted,
}

interface ComponentInstance {
  id: number;
  $element: VirtualElementComponent;
  Component: FC;
  name: string;
  props: Props;
  renderedValue?: any;
  mountState: MountState;
  context?: Record<string, Signal<unknown>>;
  hooks?: {
    state?: {
      cursor: number;
      byCursor: {
        value: any;
        nextValue: any;
        setter: StateHookSetter<any>;
      }[];
    };
    effects?: {
      cursor: number;
      byCursor: {
        dependencies?: readonly any[];
        schedule?: NoneToVoidFunction;
        cleanup?: NoneToVoidFunction;
        releaseSignals?: NoneToVoidFunction;
      }[];
    };
    memos?: {
      cursor: number;
      byCursor: {
        value: any;
        dependencies: any[];
      }[];
    };
    refs?: {
      cursor: number;
      byCursor: RefObject[];
    };
  };
  prepareForFrame?: () => void;
  forceUpdate?: () => void;
  onUpdate?: () => void;
}

export type VirtualElement =
  VirtualElementEmpty
  | VirtualElementText
  | VirtualElementTag
  | VirtualElementComponent
  | VirtualElementFragment;
export type VirtualElementParent =
  VirtualElementTag
  | VirtualElementComponent
  | VirtualElementFragment;
export type VirtualElementChildren = VirtualElement[];
export type VirtualElementReal = Exclude<VirtualElement, VirtualElementComponent | VirtualElementFragment>;

// Compatibility with JSX types
export type TeactNode =
  ReactElement
  | string
  | number
  | boolean
  | TeactNode[];

type Effect = () => (NoneToVoidFunction | void);
type EffectCleanup = NoneToVoidFunction;

export type Context<T> = {
  defaultValue?: T;
  contextId: string;
  Provider: FC<{ value: T; children: TeactNode }>;
};

const Fragment = Symbol('Fragment');

const DEBUG_RENDER_THRESHOLD = 7;
const DEBUG_EFFECT_THRESHOLD = 7;
const DEBUG_SILENT_RENDERS_FOR = new Set(['TeactMemoWrapper', 'TeactNContainer', 'Button', 'ListItem', 'MenuItem']);

let contextCounter = 0;

let lastComponentId = 0;
let renderingInstance: ComponentInstance;

export function isParentElement($element: VirtualElement): $element is VirtualElementParent {
  return (
    $element.type === VirtualType.Tag
    || $element.type === VirtualType.Component
    || $element.type === VirtualType.Fragment
  );
}

function createElement(
  source: string | FC | typeof Fragment,
  props: Props,
  ...children: any[]
): VirtualElementParent | VirtualElementChildren {
  if (source === Fragment) {
    return buildFragmentElement(children);
  } else if (typeof source === 'function') {
    return createComponentInstance(source, props || {}, children);
  } else {
    return buildTagElement(source, props || {}, children);
  }
}

function buildFragmentElement(children: any[]): VirtualElementFragment {
  return {
    type: VirtualType.Fragment,
    children: buildChildren(children, true),
  };
}

function createComponentInstance(Component: FC, props: Props, children: any[]): VirtualElementComponent {
  if (children?.length) {
    props.children = children.length === 1 ? children[0] : children;
  }

  const componentInstance: ComponentInstance = {
    id: -1,
    $element: undefined as unknown as VirtualElementComponent,
    Component,
    name: Component.name,
    props,
    mountState: MountState.New,
  };

  componentInstance.$element = buildComponentElement(componentInstance);

  return componentInstance.$element;
}

function buildComponentElement(
  componentInstance: ComponentInstance,
  children?: VirtualElementChildren,
): VirtualElementComponent {
  return {
    type: VirtualType.Component,
    componentInstance,
    props: componentInstance.props,
    children: children ? buildChildren(children, true) : [],
  };
}

function buildTagElement(tag: string, props: Props, children: any[]): VirtualElementTag {
  return {
    type: VirtualType.Tag,
    tag,
    props,
    children: buildChildren(children),
  };
}

function buildChildren(children: any[], noEmpty = false): VirtualElement[] {
  const cleanChildren = dropEmptyTail(children, noEmpty);
  const newChildren = [];

  for (let i = 0, l = cleanChildren.length; i < l; i++) {
    const child = cleanChildren[i];
    if (Array.isArray(child)) {
      newChildren.push(...buildChildren(child, noEmpty));
    } else {
      newChildren.push(buildChildElement(child));
    }
  }

  return newChildren;
}

// We only need placeholders in the middle of collection (to ensure other elements order).
function dropEmptyTail(children: any[], noEmpty = false) {
  let i = children.length - 1;

  for (; i >= 0; i--) {
    if (!isEmptyPlaceholder(children[i])) {
      break;
    }
  }

  if (i === children.length - 1) {
    return children;
  }

  if (i === -1 && noEmpty) {
    return children.slice(0, 1);
  }

  return children.slice(0, i + 1);
}

function isEmptyPlaceholder(child: any) {
  return !child && child !== 0;
}

function buildChildElement(child: any): VirtualElement {
  if (isEmptyPlaceholder(child)) {
    return { type: VirtualType.Empty };
  } else if (isParentElement(child)) {
    return child;
  } else {
    return {
      type: VirtualType.Text,
      value: String(child),
    };
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const DEBUG_components: AnyLiteral = { TOTAL: { name: 'TOTAL', renders: 0 } };
// eslint-disable-next-line @typescript-eslint/naming-convention
const DEBUG_memos: Record<string, { key: string; calls: number; misses: number; hitRate: number }> = {};
const DEBUG_MEMOS_CALLS_THRESHOLD = 20;

document.addEventListener('dblclick', () => {
  // eslint-disable-next-line no-console
  console.warn('COMPONENTS', orderBy(
    Object
      .values(DEBUG_components)
      .map(({ avgRenderTime, ...state }) => {
        return { ...state, ...(avgRenderTime !== undefined && { avgRenderTime: Number(avgRenderTime.toFixed(2)) }) };
      }),
    'renders',
    'desc',
  ));

  // eslint-disable-next-line no-console
  console.warn('MEMOS', orderBy(
    Object
      .values(DEBUG_memos)
      .filter(({ calls }) => calls >= DEBUG_MEMOS_CALLS_THRESHOLD)
      .map((state) => ({ ...state, hitRate: Number(state.hitRate.toFixed(2)) })),
    'hitRate',
    'asc',
  ));
});

let instancesPendingUpdate = new Set<ComponentInstance>();
let idsToExcludeFromUpdate = new Set<number>();
let pendingEffects = new Map<string, Effect>();
let pendingCleanups = new Map<string, EffectCleanup>();
let pendingLayoutEffects = new Map<string, Effect>();
let pendingLayoutCleanups = new Map<string, EffectCleanup>();
let areImmediateEffectsCaptured = false;

/*
  Order:
  - component effect cleanups
  - component effects
  - measure tasks
  - mutation tasks
  - component updates
  - component layout effect cleanups
  - component layout effects
  - forced layout measure tasks
  - forced layout mutation tasks
 */

const runUpdatePassOnRaf = throttleWith(requestMeasure, () => {
  if (getIsBlockingAnimating()) {
    getIsBlockingAnimating.once(runUpdatePassOnRaf);
    return;
  }

  const runImmediateEffects = captureImmediateEffects();

  idsToExcludeFromUpdate = new Set();
  const instancesToUpdate = Array
    .from(instancesPendingUpdate)
    .sort((a, b) => a.id - b.id);
  instancesPendingUpdate = new Set();

  const currentCleanups = pendingCleanups;
  pendingCleanups = new Map();
  currentCleanups.forEach((cb) => cb());

  const currentEffects = pendingEffects;
  pendingEffects = new Map();
  currentEffects.forEach((cb) => cb());

  requestMutation(() => {
    instancesToUpdate.forEach(prepareComponentForFrame);
    instancesToUpdate.forEach((instance) => {
      if (idsToExcludeFromUpdate!.has(instance.id)) {
        return;
      }

      forceUpdateComponent(instance);
    });

    runImmediateEffects?.();
  });
});

export function captureImmediateEffects() {
  if (areImmediateEffectsCaptured) {
    return undefined;
  }

  areImmediateEffectsCaptured = true;
  return runCapturedImmediateEffects;
}

function runCapturedImmediateEffects() {
  const currentLayoutCleanups = pendingLayoutCleanups;
  pendingLayoutCleanups = new Map();
  currentLayoutCleanups.forEach((cb) => cb());

  const currentLayoutEffects = pendingLayoutEffects;
  pendingLayoutEffects = new Map();
  currentLayoutEffects.forEach((cb) => cb());

  areImmediateEffectsCaptured = false;
}

export function renderComponent(componentInstance: ComponentInstance) {
  idsToExcludeFromUpdate.add(componentInstance.id);

  const { Component, props } = componentInstance;
  let newRenderedValue: any;

  safeExec(() => {
    renderingInstance = componentInstance;
    if (componentInstance.hooks) {
      if (componentInstance.hooks.state) {
        componentInstance.hooks.state.cursor = 0;
      }
      if (componentInstance.hooks.effects) {
        componentInstance.hooks.effects.cursor = 0;
      }
      if (componentInstance.hooks.memos) {
        componentInstance.hooks.memos.cursor = 0;
      }
      if (componentInstance.hooks.refs) {
        componentInstance.hooks.refs.cursor = 0;
      }
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    let DEBUG_startAt: number | undefined;
    if (DEBUG) {
      const componentName = DEBUG_resolveComponentName(Component);
      if (!DEBUG_components[componentName]) {
        DEBUG_components[componentName] = {
          name: componentName,
          renders: 0,
          avgRenderTime: 0,
        };
      }

      if (DEBUG_MORE) {
        if (!DEBUG_SILENT_RENDERS_FOR.has(componentName)) {
          // eslint-disable-next-line no-console
          console.log(`[Teact] Render ${componentName}`);
        }
      }

      DEBUG_startAt = performance.now();
    }

    newRenderedValue = Component(props);

    if (DEBUG) {
      const duration = performance.now() - DEBUG_startAt!;
      const componentName = DEBUG_resolveComponentName(Component);
      if (duration > DEBUG_RENDER_THRESHOLD) {
        // eslint-disable-next-line no-console
        console.warn(`[Teact] Slow component render: ${componentName}, ${Math.round(duration)} ms`);
      }

      const { renders, avgRenderTime } = DEBUG_components[componentName];
      DEBUG_components[componentName].avgRenderTime = (avgRenderTime * renders + duration) / (renders + 1);
      DEBUG_components[componentName].renders++;
      DEBUG_components.TOTAL.renders++;

      if (DEBUG_MORE) {
        incrementOverlayCounter(`${componentName} renders`);
        incrementOverlayCounter(`${componentName} duration`, duration);
      }
    }
  }, () => {
    // eslint-disable-next-line no-console
    console.error(`[Teact] Error while rendering component ${componentInstance.name}`, componentInstance);

    newRenderedValue = componentInstance.renderedValue;
  });

  if (componentInstance.mountState === MountState.Mounted && newRenderedValue === componentInstance.renderedValue) {
    return componentInstance.$element;
  }

  componentInstance.renderedValue = newRenderedValue;

  const children = Array.isArray(newRenderedValue) ? newRenderedValue : [newRenderedValue];

  if (componentInstance.mountState === MountState.New) {
    componentInstance.$element.children = buildChildren(children, true);
  } else {
    componentInstance.$element = buildComponentElement(componentInstance, children);
  }

  return componentInstance.$element;
}

export function hasElementChanged($old: VirtualElement, $new: VirtualElement) {
  if (typeof $old !== typeof $new) {
    return true;
  } else if ($old.type !== $new.type) {
    return true;
  } else if ($old.type === VirtualType.Text && $new.type === VirtualType.Text) {
    return $old.value !== $new.value;
  } else if ($old.type === VirtualType.Tag && $new.type === VirtualType.Tag) {
    return ($old.tag !== $new.tag) || ($old.props.key !== $new.props.key);
  } else if ($old.type === VirtualType.Component && $new.type === VirtualType.Component) {
    return (
      $old.componentInstance.Component !== $new.componentInstance.Component
    ) || (
      $old.props.key !== $new.props.key
    );
  }

  return false;
}

export function mountComponent(componentInstance: ComponentInstance) {
  componentInstance.id = ++lastComponentId;
  renderComponent(componentInstance);
  componentInstance.mountState = MountState.Mounted;
  return componentInstance.$element;
}

export function unmountComponent(componentInstance: ComponentInstance) {
  if (componentInstance.mountState !== MountState.Mounted) {
    return;
  }

  idsToExcludeFromUpdate.add(componentInstance.id);

  if (componentInstance.hooks?.effects) {
    for (const effect of componentInstance.hooks.effects.byCursor) {
      if (effect.cleanup) {
        safeExec(effect.cleanup);
      }

      effect.cleanup = undefined;
      effect.releaseSignals?.();
    }
  }

  componentInstance.mountState = MountState.Unmounted;

  helpGc(componentInstance);
}

// We need to remove all references to DOM objects. We also clean all other references, just in case
function helpGc(componentInstance: ComponentInstance) {
  const {
    effects, state, memos, refs,
  } = componentInstance.hooks || {};

  if (effects) {
    for (const hook of effects.byCursor) {
      hook.schedule = undefined as any;
      hook.cleanup = undefined as any;
      hook.releaseSignals = undefined as any;
      hook.dependencies = undefined;
    }
  }

  if (state) {
    for (const hook of state.byCursor) {
      hook.value = undefined;
      hook.nextValue = undefined;
      hook.setter = undefined as any;
    }
  }

  if (memos) {
    for (const hook of memos.byCursor) {
      hook.value = undefined as any;
      hook.dependencies = undefined as any;
    }
  }

  if (refs) {
    for (const hook of refs.byCursor) {
      hook.current = undefined as any;
      hook.onChange = undefined as any;
    }
  }

  componentInstance.hooks = undefined as any;
  componentInstance.$element = undefined as any;
  componentInstance.renderedValue = undefined;
  componentInstance.Component = undefined as any;
  componentInstance.props = undefined as any;
  componentInstance.onUpdate = undefined;
}

function prepareComponentForFrame(componentInstance: ComponentInstance) {
  if (componentInstance.mountState !== MountState.Mounted) {
    return;
  }

  if (componentInstance.hooks?.state) {
    for (const hook of componentInstance.hooks.state.byCursor) {
      hook.value = hook.nextValue;
    }
  }
}

function forceUpdateComponent(componentInstance: ComponentInstance) {
  if (componentInstance.mountState !== MountState.Mounted || !componentInstance.onUpdate) {
    return;
  }

  const currentElement = componentInstance.$element;

  renderComponent(componentInstance);

  if (componentInstance.$element !== currentElement) {
    componentInstance.onUpdate();
  }
}

export function useState<T>(): [T | undefined, StateHookSetter<T | undefined>];
export function useState<T>(initial: T, debugKey?: string): [T, StateHookSetter<T>];
export function useState<T>(initial?: T, debugKey?: string): [T, StateHookSetter<T>] {
  if (!renderingInstance.hooks) {
    renderingInstance.hooks = {};
  }
  if (!renderingInstance.hooks.state) {
    renderingInstance.hooks.state = { cursor: 0, byCursor: [] };
  }

  const { cursor, byCursor } = renderingInstance.hooks.state;
  const componentInstance = renderingInstance;

  if (byCursor[cursor] === undefined) {
    byCursor[cursor] = {
      value: initial,
      nextValue: initial,
      setter: (newValue: ((current: T) => T) | T) => {
        if (componentInstance.mountState === MountState.Unmounted) {
          return;
        }

        if (typeof newValue === 'function') {
          newValue = (newValue as (current: T) => T)(byCursor[cursor].nextValue);
        }

        if (byCursor[cursor].nextValue === newValue) {
          return;
        }

        byCursor[cursor].nextValue = newValue;

        instancesPendingUpdate.add(componentInstance);
        runUpdatePassOnRaf();

        if (DEBUG_MORE) {
          // eslint-disable-next-line no-console
          console.log(
            '[Teact.useState]',
            DEBUG_resolveComponentName(componentInstance.Component),
            `State update at cursor #${cursor}${debugKey ? ` (${debugKey})` : ''}, next value: `,
            byCursor[cursor].nextValue,
          );
        }
      },
    };
  }

  renderingInstance.hooks.state.cursor++;

  return [
    byCursor[cursor].value,
    byCursor[cursor].setter,
  ];
}

function useEffectBase(
  isLayout: boolean,
  effect: Effect,
  dependencies?: readonly any[],
  debugKey?: string,
) {
  if (!renderingInstance.hooks) {
    renderingInstance.hooks = {};
  }

  if (!renderingInstance.hooks.effects) {
    renderingInstance.hooks.effects = { cursor: 0, byCursor: [] };
  }

  const { cursor, byCursor } = renderingInstance.hooks.effects;
  const effectConfig = byCursor[cursor];
  const componentInstance = renderingInstance;

  function schedule() {
    scheduleEffect(componentInstance, cursor, effect, isLayout);
  }

  if (dependencies && effectConfig?.dependencies) {
    if (dependencies.some((dependency, i) => dependency !== effectConfig.dependencies![i])) {
      if (DEBUG && debugKey) {
        const causedBy = dependencies.reduce((res, newValue, i) => {
          const prevValue = effectConfig.dependencies![i];
          if (newValue !== prevValue) {
            res.push(`${i}: ${prevValue} => ${newValue}`);
          }

          return res;
        }, []);

        // eslint-disable-next-line no-console
        console.log(`[Teact] Effect "${debugKey}" caused by dependencies.`, causedBy.join(', '));
      }

      schedule();
    }
  } else {
    if (debugKey) {
      // eslint-disable-next-line no-console
      console.log(`[Teact] Effect "${debugKey}" caused by missing dependencies.`);
    }

    schedule();
  }

  function setupSignals() {
    const cleanups = dependencies?.filter(isSignal).map((signal, i) => signal.subscribe(() => {
      if (debugKey) {
        // eslint-disable-next-line no-console
        console.log(`[Teact] Effect "${debugKey}" caused by signal #${i} new value:`, signal());
      }

      byCursor[cursor].schedule!();
    }));

    if (!cleanups?.length) {
      return undefined;
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  if (effectConfig) effectConfig.schedule = undefined; // Help GC

  byCursor[cursor] = {
    ...effectConfig,
    dependencies,
    schedule,
  };

  if (!effectConfig) {
    byCursor[cursor].releaseSignals = setupSignals();
  }

  renderingInstance.hooks.effects.cursor++;
}

function scheduleEffect(
  componentInstance: ComponentInstance,
  cursor: number,
  effect: Effect,
  isLayout: boolean,
) {
  const { byCursor } = componentInstance.hooks!.effects!;
  const cleanup = byCursor[cursor]?.cleanup;
  const cleanupsContainer = isLayout ? pendingLayoutCleanups : pendingCleanups;
  const effectsContainer = isLayout ? pendingLayoutEffects : pendingEffects;
  const effectId = `${componentInstance.id}_${cursor}`;

  if (cleanup) {
    const runEffectCleanup = () => safeExec(() => {
      if (componentInstance.mountState === MountState.Unmounted) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/naming-convention
      let DEBUG_startAt: number | undefined;
      if (DEBUG) {
        DEBUG_startAt = performance.now();
      }

      cleanup();

      if (DEBUG) {
        const duration = performance.now() - DEBUG_startAt!;
        const componentName = DEBUG_resolveComponentName(componentInstance.Component);
        if (duration > DEBUG_EFFECT_THRESHOLD) {
          // eslint-disable-next-line no-console
          console.warn(
            `[Teact] Slow cleanup at effect cursor #${cursor}: ${componentName}, ${Math.round(duration)} ms`,
          );
        }
      }
    }, () => {
      // eslint-disable-next-line no-console, max-len
      console.error(`[Teact] Error in effect cleanup at cursor #${cursor} in ${componentInstance.name}`, componentInstance);
    }, () => {
      byCursor[cursor].cleanup = undefined;
    });

    cleanupsContainer.set(effectId, runEffectCleanup);
  }

  const runEffect = () => safeExec(() => {
    if (componentInstance.mountState === MountState.Unmounted) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    let DEBUG_startAt: number | undefined;
    if (DEBUG) {
      DEBUG_startAt = performance.now();
    }

    const result = effect();
    if (typeof result === 'function') {
      byCursor[cursor].cleanup = result;
    }

    if (DEBUG) {
      const duration = performance.now() - DEBUG_startAt!;
      const componentName = DEBUG_resolveComponentName(componentInstance.Component);
      if (duration > DEBUG_EFFECT_THRESHOLD) {
        // eslint-disable-next-line no-console
        console.warn(`[Teact] Slow effect at cursor #${cursor}: ${componentName}, ${Math.round(duration)} ms`);
      }
    }
  }, () => {
    // eslint-disable-next-line no-console
    console.error(`[Teact] Error in effect at cursor #${cursor} in ${componentInstance.name}`, componentInstance);
  });

  effectsContainer.set(effectId, runEffect);

  runUpdatePassOnRaf();
}

export function useEffect(effect: Effect, dependencies?: readonly any[], debugKey?: string) {
  return useEffectBase(false, effect, dependencies, debugKey);
}

export function useLayoutEffect(effect: Effect, dependencies?: readonly any[], debugKey?: string) {
  return useEffectBase(true, effect, dependencies, debugKey);
}

export function useUnmountCleanup(cleanup: NoneToVoidFunction) {
  if (!renderingInstance.hooks) {
    renderingInstance.hooks = {};
  }

  if (!renderingInstance.hooks.effects) {
    renderingInstance.hooks.effects = { cursor: 0, byCursor: [] };
  }

  const { cursor, byCursor } = renderingInstance.hooks.effects;

  if (!byCursor[cursor]) {
    byCursor[cursor] = {
      cleanup,
    };
  }

  renderingInstance.hooks.effects.cursor++;
}

export function useMemo<T extends any>(
  resolver: () => T,
  dependencies: any[],
  debugKey?: string,
  debugHitRateKey?: string,
): T {
  if (!renderingInstance.hooks) {
    renderingInstance.hooks = {};
  }
  if (!renderingInstance.hooks.memos) {
    renderingInstance.hooks.memos = { cursor: 0, byCursor: [] };
  }

  const { cursor, byCursor } = renderingInstance.hooks.memos;
  let { value } = byCursor[cursor] || {};

  // eslint-disable-next-line @typescript-eslint/naming-convention
  let DEBUG_state: typeof DEBUG_memos[string] | undefined;
  if (DEBUG && debugHitRateKey) {
    const instanceKey = `${debugHitRateKey}#${renderingInstance.id}`;

    DEBUG_state = DEBUG_memos[instanceKey];
    if (!DEBUG_state) {
      DEBUG_state = {
        key: instanceKey, calls: 0, misses: 0, hitRate: 0,
      };
      DEBUG_memos[instanceKey] = DEBUG_state;
    }

    DEBUG_state.calls++;
    DEBUG_state.hitRate = (DEBUG_state.calls - DEBUG_state.misses) / DEBUG_state.calls;
  }

  if (
    byCursor[cursor] === undefined
    || dependencies.length !== byCursor[cursor].dependencies.length
    || dependencies.some((dependency, i) => dependency !== byCursor[cursor].dependencies[i])
  ) {
    if (DEBUG) {
      if (debugKey) {
        const msg = `[Teact.useMemo] ${renderingInstance.name} (${debugKey}): Update is caused by:`;
        if (!byCursor[cursor]) {
          // eslint-disable-next-line no-console
          console.log(`${msg} [first render]`);
        } else {
          logUnequalProps(byCursor[cursor].dependencies, dependencies, msg, debugKey);
        }
      }

      if (DEBUG_state) {
        DEBUG_state.misses++;
        DEBUG_state.hitRate = (DEBUG_state.calls - DEBUG_state.misses) / DEBUG_state.calls;

        if (
          DEBUG_state.calls % 10 === 0
          && DEBUG_state.calls >= DEBUG_MEMOS_CALLS_THRESHOLD
          && DEBUG_state.hitRate < 0.25
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            // eslint-disable-next-line max-len
            `[Teact] ${DEBUG_state.key}: Hit rate is ${DEBUG_state.hitRate.toFixed(2)} for ${DEBUG_state.calls} calls`,
          );
        }
      }
    }

    value = resolver();
  }

  byCursor[cursor] = {
    value,
    dependencies,
  };

  renderingInstance.hooks.memos.cursor++;

  return value;
}

export function useCallback<F extends AnyFunction>(newCallback: F, dependencies: any[], debugKey?: string): F {
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  return useMemo(() => newCallback, dependencies, debugKey);
}

export function useRef<T>(initial: T): RefObject<T>;
export function useRef<T>(): RefObject<T | undefined>; // TT way (empty is `undefined`)
export function useRef<T>(initial: null): RefObject<T | null>; // React way (empty is `null`)
// eslint-disable-next-line no-null/no-null
export function useRef<T>(initial?: T | null) {
  if (!renderingInstance.hooks) {
    renderingInstance.hooks = {};
  }
  if (!renderingInstance.hooks.refs) {
    renderingInstance.hooks.refs = { cursor: 0, byCursor: [] };
  }

  const { cursor, byCursor } = renderingInstance.hooks.refs;
  if (!byCursor[cursor]) {
    byCursor[cursor] = {
      current: initial,
    };
  }

  renderingInstance.hooks.refs.cursor++;

  return byCursor[cursor];
}

export function createContext<T>(defaultValue?: T): Context<T> {
  const contextId = String(contextCounter++);

  function TeactContextProvider(props: { value: T; children: TeactNode }) {
    const [getValue, setValue] = useSignal(props.value ?? defaultValue);
    // Create a new object to avoid mutations in the parent context
    renderingInstance.context = { ...renderingInstance.context };

    renderingInstance.context[contextId] = getValue;
    setValue(props.value);
    return props.children;
  }

  TeactContextProvider.DEBUG_contentComponentName = contextId;

  const context = {
    defaultValue,
    contextId,
    Provider: TeactContextProvider,
  };

  return context;
}

export function useContextSignal<T>(context: Context<T>) {
  const [getDefaultValue] = useSignal(context.defaultValue);

  return renderingInstance.context?.[context.contextId] || getDefaultValue;
}

export function useSignal<T>(initial?: T) {
  const signalRef = useRef<ReturnType<typeof createSignal<T>>>();
  signalRef.current ??= createSignal<T>(initial);
  return signalRef.current;
}

export function memo<T extends FC_withDebug>(Component: T, debugKey?: string) {
  function TeactMemoWrapper(props: Props) {
    return useMemo(
      () => createElement(Component, props),
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      Object.values(props),
      debugKey,
      DEBUG_MORE ? DEBUG_resolveComponentName(renderingInstance.Component) : undefined,
    );
  }

  TeactMemoWrapper.DEBUG_contentComponentName = DEBUG_resolveComponentName(Component);

  return TeactMemoWrapper as T;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function DEBUG_resolveComponentName(Component: FC_withDebug) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { name, DEBUG_contentComponentName } = Component;

  if (name === 'TeactNContainer') {
    return `container>${DEBUG_contentComponentName}`;
  }

  if (name === 'TeactMemoWrapper') {
    return `memo>${DEBUG_contentComponentName}`;
  }

  if (name === 'TeactContextProvider') {
    return `context>id${DEBUG_contentComponentName}`;
  }

  return name + (DEBUG_contentComponentName ? `>${DEBUG_contentComponentName}` : '');
}

export default {
  createElement,
  Fragment,
};
