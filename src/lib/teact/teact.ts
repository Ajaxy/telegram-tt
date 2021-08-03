import { DEBUG, DEBUG_MORE } from '../../config';
import {
  fastRaf, onTickEnd, throttleWithPrimaryRaf, throttleWithRaf,
} from '../../util/schedulers';
import { flatten, orderBy } from '../../util/iteratees';
import arePropsShallowEqual, { getUnequalProps } from '../../util/arePropsShallowEqual';
import { handleError } from '../../util/handleError';
import { removeAllDelegatedListeners } from './dom-events';

export type Props = AnyLiteral;
export type FC<P extends Props = any> = (props: P) => any;
export type FC_withDebug =
  FC
  & {
  DEBUG_contentComponentName?: string;
};

export enum VirtualElementTypesEnum {
  Empty,
  Text,
  Tag,
  Component,
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
        dependencies?: any[];
        cleanup?: Function;
      }[];
    };
    memos: {
      cursor: number;
      byCursor: {
        current: any;
        dependencies: any[];
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
  | VirtualElementComponent;
export type VirtualRealElement =
  VirtualElementTag
  | VirtualElementComponent;
export type VirtualElementChildren = VirtualElement[];

const Fragment = Symbol('Fragment');

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

export function isRealElement($element: VirtualElement): $element is VirtualRealElement {
  return isTagElement($element) || isComponentElement($element);
}

function createElement(
  source: string | FC | typeof Fragment,
  props: Props,
  ...children: any[]
): VirtualRealElement | VirtualElementChildren {
  if (!props) {
    props = {};
  }

  children = flatten(children);

  if (source === Fragment) {
    return children;
  } else if (typeof source === 'function') {
    return createComponentInstance(source, props, children);
  } else {
    return buildTagElement(source, props, children);
  }
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
    },
  };

  componentInstance.$element = buildComponentElement(componentInstance);

  return componentInstance.$element;
}

function buildComponentElement(
  componentInstance: ComponentInstance,
  children: VirtualElementChildren = [],
): VirtualElementComponent {
  const { props } = componentInstance;

  return {
    componentInstance,
    type: VirtualElementTypesEnum.Component,
    props,
    children,
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
function dropEmptyTail(children: any[]) {
  let i = children.length - 1;

  for (; i >= 0; i--) {
    if (!isEmptyPlaceholder(children[i])) {
      break;
    }
  }

  return i + 1 < children.length ? children.slice(0, i + 1) : children;
}

function isEmptyPlaceholder(child: any) {
  // eslint-disable-next-line no-null/no-null
  return child === false || child === null || child === undefined;
}

function buildChildElement(child: any): VirtualElement {
  if (isEmptyPlaceholder(child)) {
    return buildEmptyElement();
  } else if (isRealElement(child)) {
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

const DEBUG_components: AnyLiteral = {};

document.addEventListener('dblclick', () => {
  // eslint-disable-next-line no-console
  console.log('COMPONENTS', orderBy(Object.values(DEBUG_components), 'renderCount', 'desc'));
});

export function renderComponent(componentInstance: ComponentInstance) {
  renderingInstance = componentInstance;
  componentInstance.hooks.state.cursor = 0;
  componentInstance.hooks.effects.cursor = 0;
  componentInstance.hooks.memos.cursor = 0;

  const { Component, props } = componentInstance;
  let newRenderedValue;

  try {
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
        if (componentName !== 'TeactMemoWrapper' && componentName !== 'TeactNContainer') {
          // eslint-disable-next-line no-console
          console.log(`[Teact] Render ${componentName}`);
        }
      }

      DEBUG_startAt = performance.now();
    }

    newRenderedValue = Component(props);

    if (DEBUG) {
      const renderTime = performance.now() - DEBUG_startAt!;
      const componentName = componentInstance.name;
      if (renderTime > 7) {
        // eslint-disable-next-line no-console
        console.warn(`[Teact] Slow component render: ${componentName}, ${Math.round(renderTime)} ms`);
      }
      DEBUG_components[componentName].renderTimes.push(renderTime);
      DEBUG_components[componentName].renderCount++;
    }
  } catch (err) {
    handleError(err);

    newRenderedValue = componentInstance.renderedValue;
  }

  if (componentInstance.isMounted && newRenderedValue === componentInstance.renderedValue) {
    return componentInstance.$element;
  }

  componentInstance.renderedValue = newRenderedValue;

  const newChild = buildChildElement(newRenderedValue);
  componentInstance.$element = buildComponentElement(componentInstance, [newChild]);

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

export function unmountTree($element: VirtualElement) {
  if (!isRealElement($element)) {
    return;
  }

  if (isComponentElement($element)) {
    unmountComponent($element.componentInstance);
  } else if ($element.target) {
    removeAllDelegatedListeners($element.target as HTMLElement);
    // Trying to help GC
    // eslint-disable-next-line no-null/no-null
    $element.target = null as any;
  }

  $element.children.forEach(unmountTree);
}

export function mountComponent(componentInstance: ComponentInstance) {
  renderComponent(componentInstance);
  componentInstance.isMounted = true;
  return componentInstance.$element;
}

function unmountComponent(componentInstance: ComponentInstance) {
  if (!componentInstance.isMounted) {
    return;
  }

  componentInstance.hooks.memos.byCursor.forEach((hook) => {
    // eslint-disable-next-line no-null/no-null
    hook.current = null;
  });

  componentInstance.hooks.effects.byCursor.forEach(({ cleanup }) => {
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (err) {
        handleError(err);
      }
    }
  });

  componentInstance.isMounted = false;

  helpGc(componentInstance);
}

// We need to remove all references to DOM objects. We also clean all other references, just in case.
function helpGc(componentInstance: ComponentInstance) {
  /* eslint-disable no-null/no-null */

  componentInstance.hooks.effects.byCursor.forEach((hook) => {
    hook.cleanup = null as any;
    hook.effect = null as any;
    hook.dependencies = null as any;
  });

  componentInstance.hooks.state.byCursor.forEach((hook) => {
    hook.value = null as any;
    hook.nextValue = null as any;
    hook.setter = null as any;
  });

  componentInstance.hooks.memos.byCursor.forEach((hook) => {
    hook.dependencies = null as any;
  });

  componentInstance.hooks = null as any;
  componentInstance.$element = null as any;
  componentInstance.renderedValue = null as any;
  componentInstance.Component = null as any;
  componentInstance.props = null as any;
  componentInstance.forceUpdate = null as any;
  componentInstance.onUpdate = null as any;

  /* eslint-enable no-null/no-null */
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

export function getTarget($element: VirtualElement): Node | undefined {
  if (isComponentElement($element)) {
    return getTarget($element.children[0]);
  } else {
    return $element.target;
  }
}

export function setTarget($element: VirtualElement, target: Node) {
  if (isComponentElement($element)) {
    setTarget($element.children[0], target);
  } else {
    $element.target = target;
  }
}

export function useState<T>(initial?: T): [T, StateHookSetter<T>] {
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
                `Forced update at cursor #${cursor}, next value: `,
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
  effect: () => Function | void,
  dependencies?: any[],
  debugKey?: string,
) {
  const { cursor, byCursor } = renderingInstance.hooks.effects;
  const componentInstance = renderingInstance;

  const exec = () => {
    if (!componentInstance.isMounted) {
      return;
    }

    const { cleanup } = byCursor[cursor];
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (err) {
        handleError(err);
      }
    }

    byCursor[cursor].cleanup = effect() as Function;
  };

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
        console.log(
          '[Teact]',
          debugKey,
          'Effect caused by dependencies.',
          causedBy.join(', '),
        );
      }

      schedulerFn(exec);
    }
  } else {
    schedulerFn(exec);
  }

  byCursor[cursor] = {
    effect,
    dependencies,
    cleanup: byCursor[cursor] ? byCursor[cursor].cleanup : undefined,
  };

  renderingInstance.hooks.effects.cursor++;
}

export function useEffect(effect: () => Function | void, dependencies?: any[], debugKey?: string) {
  return useLayoutEffectBase(fastRaf, effect, dependencies, debugKey);
}

export function useLayoutEffect(effect: () => Function | void, dependencies?: any[], debugKey?: string) {
  return useLayoutEffectBase(onTickEnd, effect, dependencies, debugKey);
}

export function useMemo<T extends any>(resolver: () => T, dependencies: any[], debugKey?: string): T {
  const { cursor, byCursor } = renderingInstance.hooks.memos;
  let { current } = byCursor[cursor] || {};

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

    current = resolver();
  }

  byCursor[cursor] = {
    current,
    dependencies,
  };

  renderingInstance.hooks.memos.cursor++;

  return current;
}

export function useCallback<F extends AnyFunction>(newCallback: F, dependencies: any[]): F {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => newCallback, dependencies);
}

export function useRef<T>(initial: T): { current: T };
export function useRef<T>(): { current: T | undefined }; // TT way (empty is `undefined`)
export function useRef<T>(initial: null): { current: T | null }; // React way (empty is `null`)
// eslint-disable-next-line no-null/no-null
export function useRef<T>(initial?: T | null) {
  return useMemo(() => ({
    current: initial,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
}

export function memo<T extends FC>(Component: T, areEqual = arePropsShallowEqual, debugKey?: string) {
  return function TeactMemoWrapper(props: Props) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const propsRef = useRef(props);
    const renderedRef = useRef();

    if (!renderedRef.current || (propsRef.current && !areEqual(propsRef.current, props))) {
      if (DEBUG && debugKey) {
        // eslint-disable-next-line no-console
        console.log(
          `[Teact.memo] ${Component.name} (${debugKey}): Update is caused by:`,
          getUnequalProps(propsRef.current!, props).join(', '),
        );
      }

      propsRef.current = props;
      renderedRef.current = createElement(Component, props) as VirtualElementComponent;
    }

    return renderedRef.current;
  } as T;
}

// We need to keep it here for JSX.
export default {
  createElement,
  Fragment,
};
