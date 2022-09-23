import type { ReactElement } from 'react';
import { DEBUG, DEBUG_MORE } from '../../config';
import {
  fastRaf, fastRafPrimary, onTickEnd, onTickEndPrimary, throttleWithPrimaryRaf, throttleWithRaf,
} from '../../util/schedulers';
import { orderBy } from '../../util/iteratees';
import { getUnequalProps } from '../../util/arePropsShallowEqual';
import { handleError } from '../../util/handleError';

export type Props = AnyLiteral;
export type FC<P extends Props = any> = (props: P) => any;
// eslint-disable-next-line @typescript-eslint/naming-convention
export type FC_withDebug = FC & {
  DEBUG_contentComponentName?: string;
};

export enum VirtualElementTypesEnum {
  Empty,
  Text,
  Tag,
  Component,
  Fragment,
}

interface VirtualElementEmpty {
  type: VirtualElementTypesEnum.Empty;
  target?: Node;
}

interface VirtualElementText {
  type: VirtualElementTypesEnum.Text;
  target?: Node;
  value: string;
}

export interface VirtualElementTag {
  type: VirtualElementTypesEnum.Tag;
  target?: Node;
  tag: string;
  props: Props;
  children: VirtualElementChildren;
}

export interface VirtualElementComponent {
  type: VirtualElementTypesEnum.Component;
  componentInstance: ComponentInstance;
  props: Props;
  children: VirtualElementChildren;
}

export interface VirtualElementFragment {
  type: VirtualElementTypesEnum.Fragment;
  target?: Node;
  children: VirtualElementChildren;
}

export type StateHookSetter<T> = (newValue: ((current: T) => T) | T) => void;

interface ComponentInstance {
  $element: VirtualElementComponent;
  Component: FC;
  name: string;
  props: Props;
  renderedValue?: any;
  isMounted: boolean;
  hooks: {
    state: {
      cursor: number;
      byCursor: {
        value: any;
        nextValue: any;
        setter: StateHookSetter<any>;
      }[];
    };
    effects: {
      cursor: number;
      byCursor: {
        effect: () => void;
        dependencies?: readonly any[];
        cleanup?: Function;
      }[];
    };
    memos: {
      cursor: number;
      byCursor: {
        value: any;
        dependencies: any[];
      }[];
    };
    refs: {
      cursor: number;
      byCursor: {
        current: any;
      }[];
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

const Fragment = Symbol('Fragment');

const DEBUG_RENDER_THRESHOLD = 7;
const DEBUG_EFFECT_THRESHOLD = 7;
const DEBUG_SILENT_RENDERS_FOR = new Set(['TeactMemoWrapper', 'TeactNContainer', 'Button', 'ListItem', 'MenuItem']);

let renderingInstance: ComponentInstance;

export function isEmptyElement($element: VirtualElement): $element is VirtualElementEmpty {
  return $element.type === VirtualElementTypesEnum.Empty;
}

export function isTextElement($element: VirtualElement): $element is VirtualElementText {
  return $element.type === VirtualElementTypesEnum.Text;
}

export function isTagElement($element: VirtualElement): $element is VirtualElementTag {
  return $element.type === VirtualElementTypesEnum.Tag;
}

export function isComponentElement($element: VirtualElement): $element is VirtualElementComponent {
  return $element.type === VirtualElementTypesEnum.Component;
}

export function isFragmentElement($element: VirtualElement): $element is VirtualElementFragment {
  return $element.type === VirtualElementTypesEnum.Fragment;
}

export function isParentElement($element: VirtualElement): $element is VirtualElementParent {
  return isTagElement($element) || isComponentElement($element) || isFragmentElement($element);
}

function createElement(
  source: string | FC | typeof Fragment,
  props: Props,
  ...children: any[]
): VirtualElementParent | VirtualElementChildren {
  children = children.flat();

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
    type: VirtualElementTypesEnum.Fragment,
    children: dropEmptyTail(children, true).map(buildChildElement),
  };
}

function createComponentInstance(Component: FC, props: Props, children: any[]): VirtualElementComponent {
  let parsedChildren: any | any[] | undefined;
  if (children.length === 0) {
    parsedChildren = undefined;
  } else if (children.length === 1) {
    [parsedChildren] = children;
  } else {
    parsedChildren = children;
  }

  const componentInstance: ComponentInstance = {
    $element: {} as VirtualElementComponent,
    Component,
    name: Component.name,
    props: {
      ...props,
      ...(parsedChildren && { children: parsedChildren }),
    },
    isMounted: false,
    hooks: {
      state: {
        cursor: 0,
        byCursor: [],
      },
      effects: {
        cursor: 0,
        byCursor: [],
      },
      memos: {
        cursor: 0,
        byCursor: [],
      },
      refs: {
        cursor: 0,
        byCursor: [],
      },
    },
  };

  componentInstance.$element = buildComponentElement(componentInstance);

  return componentInstance.$element;
}

function buildComponentElement(
  componentInstance: ComponentInstance,
  children: VirtualElementChildren = [],
): VirtualElementComponent {
  return {
    type: VirtualElementTypesEnum.Component,
    componentInstance,
    props: componentInstance.props,
    children: dropEmptyTail(children, true).map(buildChildElement),
  };
}

function buildTagElement(tag: string, props: Props, children: any[]): VirtualElementTag {
  return {
    type: VirtualElementTypesEnum.Tag,
    tag,
    props,
    children: dropEmptyTail(children).map(buildChildElement),
  };
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
  // eslint-disable-next-line no-null/no-null
  return child === false || child === null || child === undefined;
}

function buildChildElement(child: any): VirtualElement {
  if (isEmptyPlaceholder(child)) {
    return buildEmptyElement();
  } else if (isParentElement(child)) {
    return child;
  } else {
    return buildTextElement(child);
  }
}

function buildTextElement(value: any): VirtualElementText {
  return {
    type: VirtualElementTypesEnum.Text,
    value: String(value),
  };
}

function buildEmptyElement(): VirtualElementEmpty {
  return { type: VirtualElementTypesEnum.Empty };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const DEBUG_components: AnyLiteral = {};

document.addEventListener('dblclick', () => {
  // eslint-disable-next-line no-console
  console.warn('COMPONENTS', orderBy(Object.values(DEBUG_components), 'renderCount', 'desc'));
});

export function renderComponent(componentInstance: ComponentInstance) {
  renderingInstance = componentInstance;
  componentInstance.hooks.state.cursor = 0;
  componentInstance.hooks.effects.cursor = 0;
  componentInstance.hooks.memos.cursor = 0;
  componentInstance.hooks.refs.cursor = 0;

  const { Component, props } = componentInstance;
  let newRenderedValue;

  try {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    let DEBUG_startAt: number | undefined;
    if (DEBUG) {
      const componentName = componentInstance.name;
      if (!DEBUG_components[componentName]) {
        DEBUG_components[componentName] = {
          componentName,
          renderCount: 0,
          renderTimes: [],
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
      const componentName = componentInstance.name;
      if (duration > DEBUG_RENDER_THRESHOLD) {
        // eslint-disable-next-line no-console
        console.warn(`[Teact] Slow component render: ${componentName}, ${Math.round(duration)} ms`);
      }
      DEBUG_components[componentName].renderTimes.push(duration);
      DEBUG_components[componentName].renderCount++;
    }
  } catch (err: any) {
    handleError(err);

    newRenderedValue = componentInstance.renderedValue;
  }

  if (componentInstance.isMounted && newRenderedValue === componentInstance.renderedValue) {
    return componentInstance.$element;
  }

  componentInstance.renderedValue = newRenderedValue;

  const children = Array.isArray(newRenderedValue) ? newRenderedValue : [newRenderedValue];
  componentInstance.$element = buildComponentElement(componentInstance, children);

  return componentInstance.$element;
}

export function hasElementChanged($old: VirtualElement, $new: VirtualElement) {
  if (typeof $old !== typeof $new) {
    return true;
  } else if ($old.type !== $new.type) {
    return true;
  } else if (isTextElement($old) && isTextElement($new)) {
    return $old.value !== $new.value;
  } else if (isTagElement($old) && isTagElement($new)) {
    return ($old.tag !== $new.tag) || ($old.props.key !== $new.props.key);
  } else if (isComponentElement($old) && isComponentElement($new)) {
    return (
      $old.componentInstance.Component !== $new.componentInstance.Component
    ) || (
      $old.props.key !== $new.props.key
    );
  }

  return false;
}

export function mountComponent(componentInstance: ComponentInstance) {
  renderComponent(componentInstance);
  componentInstance.isMounted = true;
  return componentInstance.$element;
}

export function unmountComponent(componentInstance: ComponentInstance) {
  if (!componentInstance.isMounted) {
    return;
  }

  componentInstance.hooks.effects.byCursor.forEach((effect) => {
    if (effect.cleanup) {
      try {
        effect.cleanup();
      } catch (err: any) {
        handleError(err);
      } finally {
        effect.cleanup = undefined;
      }
    }
  });

  componentInstance.isMounted = false;

  helpGc(componentInstance);
}

// We need to remove all references to DOM objects. We also clean all other references, just in case
function helpGc(componentInstance: ComponentInstance) {
  componentInstance.hooks.effects.byCursor.forEach((hook) => {
    hook.cleanup = undefined;
    hook.effect = undefined as any;
    hook.dependencies = undefined;
  });

  componentInstance.hooks.state.byCursor.forEach((hook) => {
    hook.value = undefined;
    hook.nextValue = undefined;
    hook.setter = undefined as any;
  });

  componentInstance.hooks.memos.byCursor.forEach((hook) => {
    hook.value = undefined as any;
    hook.dependencies = undefined as any;
  });

  componentInstance.hooks.refs.byCursor.forEach((hook) => {
    hook.current = undefined as any;
  });

  componentInstance.hooks = undefined as any;
  componentInstance.$element = undefined as any;
  componentInstance.renderedValue = undefined;
  componentInstance.Component = undefined as any;
  componentInstance.props = undefined as any;
  componentInstance.forceUpdate = undefined;
  componentInstance.onUpdate = undefined;
}

function prepareComponentForFrame(componentInstance: ComponentInstance) {
  if (!componentInstance.isMounted) {
    return;
  }

  componentInstance.hooks.state.byCursor.forEach((hook) => {
    hook.value = hook.nextValue;
  });

  componentInstance.prepareForFrame = throttleWithPrimaryRaf(() => prepareComponentForFrame(componentInstance));
  componentInstance.forceUpdate = throttleWithRaf(() => forceUpdateComponent(componentInstance));
}

function forceUpdateComponent(componentInstance: ComponentInstance) {
  if (!componentInstance.isMounted || !componentInstance.onUpdate) {
    return;
  }

  const currentElement = componentInstance.$element;

  renderComponent(componentInstance);

  if (componentInstance.$element !== currentElement) {
    componentInstance.onUpdate();
  }
}

export function useState<T>(initial?: T, debugKey?: string): [T, StateHookSetter<T>] {
  const { cursor, byCursor } = renderingInstance.hooks.state;

  if (byCursor[cursor] === undefined) {
    byCursor[cursor] = {
      value: initial,
      nextValue: initial,
      setter: ((componentInstance) => (newValue: ((current: T) => T) | T) => {
        if (byCursor[cursor].nextValue !== newValue) {
          byCursor[cursor].nextValue = typeof newValue === 'function'
            ? (newValue as (current: T) => T)(byCursor[cursor].value)
            : newValue;

          if (!componentInstance.prepareForFrame || !componentInstance.forceUpdate) {
            componentInstance.prepareForFrame = throttleWithPrimaryRaf(
              () => prepareComponentForFrame(componentInstance),
            );
            componentInstance.forceUpdate = throttleWithRaf(
              () => forceUpdateComponent(componentInstance),
            );
          }

          componentInstance.prepareForFrame();
          componentInstance.forceUpdate();

          if (DEBUG_MORE) {
            if (componentInstance.name !== 'TeactNContainer') {
              // eslint-disable-next-line no-console
              console.log(
                '[Teact.useState]',
                componentInstance.name,
                // `componentInstance.Component` may be set to `null` by GC helper
                componentInstance.Component && (componentInstance.Component as FC_withDebug).DEBUG_contentComponentName
                  ? `> ${(componentInstance.Component as FC_withDebug).DEBUG_contentComponentName}`
                  : '',
                debugKey
                  ? `State update for ${debugKey}, next value: `
                  : `State update at cursor #${cursor}, next value: `,
                byCursor[cursor].nextValue,
              );
            }
          }
        }
      })(renderingInstance),
    };
  }

  renderingInstance.hooks.state.cursor++;

  return [
    byCursor[cursor].value,
    byCursor[cursor].setter,
  ];
}

function useLayoutEffectBase(
  schedulerFn: typeof onTickEnd | typeof requestAnimationFrame,
  primarySchedulerFn: typeof onTickEnd | typeof requestAnimationFrame,
  effect: () => Function | void,
  dependencies?: readonly any[],
  debugKey?: string,
) {
  const { cursor, byCursor } = renderingInstance.hooks.effects;
  const componentInstance = renderingInstance;

  function execCleanup() {
    if (!componentInstance.isMounted) {
      return;
    }

    const { cleanup } = byCursor[cursor];
    if (!cleanup) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      let DEBUG_startAt: number | undefined;
      if (DEBUG) {
        DEBUG_startAt = performance.now();
      }

      cleanup();

      if (DEBUG) {
        const duration = performance.now() - DEBUG_startAt!;
        const componentName = componentInstance.name;
        if (duration > DEBUG_EFFECT_THRESHOLD) {
          // eslint-disable-next-line no-console
          console.warn(
            `[Teact] Slow cleanup at effect cursor #${cursor}: ${componentName}, ${Math.round(duration)} ms`,
          );
        }
      }
    } catch (err: any) {
      handleError(err);
    } finally {
      byCursor[cursor].cleanup = undefined;
    }
  }

  function exec() {
    if (!componentInstance.isMounted) {
      return;
    }

    execCleanup();

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
      const componentName = componentInstance.name;
      if (duration > DEBUG_EFFECT_THRESHOLD) {
        // eslint-disable-next-line no-console
        console.warn(`[Teact] Slow effect at cursor #${cursor}: ${componentName}, ${Math.round(duration)} ms`);
      }
    }
  }

  if (byCursor[cursor] !== undefined && dependencies && byCursor[cursor].dependencies) {
    if (dependencies.some((dependency, i) => dependency !== byCursor[cursor].dependencies![i])) {
      if (debugKey) {
        const causedBy = dependencies.reduce((res, newValue, i) => {
          const prevValue = byCursor[cursor].dependencies![i];
          if (newValue !== prevValue) {
            res.push(`${i}: ${prevValue} => ${newValue}`);
          }

          return res;
        }, []);

        // eslint-disable-next-line no-console
        console.log(`[Teact] Effect "${debugKey}" caused by dependencies.`, causedBy.join(', '));
      }

      primarySchedulerFn(execCleanup);
      schedulerFn(exec);
    }
  } else {
    if (debugKey) {
      // eslint-disable-next-line no-console
      console.log(`[Teact] Effect "${debugKey}" caused by missing dependencies.`);
    }

    primarySchedulerFn(execCleanup);
    schedulerFn(exec);
  }

  byCursor[cursor] = {
    effect,
    dependencies,
    cleanup: byCursor[cursor]?.cleanup,
  };

  renderingInstance.hooks.effects.cursor++;
}

export function useEffect(effect: () => Function | void, dependencies?: readonly any[], debugKey?: string) {
  return useLayoutEffectBase(fastRaf, fastRafPrimary, effect, dependencies, debugKey);
}

export function useLayoutEffect(effect: () => Function | void, dependencies?: readonly any[], debugKey?: string) {
  return useLayoutEffectBase(onTickEnd, onTickEndPrimary, effect, dependencies, debugKey);
}

export function useMemo<T extends any>(resolver: () => T, dependencies: any[], debugKey?: string): T {
  const { cursor, byCursor } = renderingInstance.hooks.memos;
  let { value } = byCursor[cursor] || {};

  if (
    byCursor[cursor] === undefined
    || dependencies.some((dependency, i) => dependency !== byCursor[cursor].dependencies[i])
  ) {
    if (DEBUG && debugKey) {
      // eslint-disable-next-line no-console
      console.log(
        `[Teact.useMemo] ${renderingInstance.name} (${debugKey}): Update is caused by:`,
        byCursor[cursor]
          ? getUnequalProps(dependencies, byCursor[cursor].dependencies).join(', ')
          : '[first render]',
      );
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => newCallback, dependencies, debugKey);
}

export function useRef<T>(initial: T): { current: T };
export function useRef<T>(): { current: T | undefined }; // TT way (empty is `undefined`)
export function useRef<T>(initial: null): { current: T | null }; // React way (empty is `null`)
// eslint-disable-next-line no-null/no-null
export function useRef<T>(initial?: T | null) {
  const { cursor, byCursor } = renderingInstance.hooks.refs;
  if (!byCursor[cursor]) {
    byCursor[cursor] = {
      current: initial,
    };
  }

  renderingInstance.hooks.refs.cursor++;

  return byCursor[cursor];
}

export function memo<T extends FC>(Component: T, debugKey?: string) {
  return function TeactMemoWrapper(props: Props) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => createElement(Component, props), Object.values(props), debugKey);
  } as T;
}

export default {
  createElement,
  Fragment,
};
