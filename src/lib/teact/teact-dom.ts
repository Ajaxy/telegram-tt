import type { ChangeEvent } from 'react';
import type {
  VirtualElement,
  VirtualElementChildren,
  VirtualElementComponent,
  VirtualElementFragment,
  VirtualElementParent,
  VirtualElementReal,
  VirtualElementTag,
} from './teact';
import {
  captureImmediateEffects,
  hasElementChanged,
  isParentElement,
  mountComponent,
  MountState,
  renderComponent,
  unmountComponent,
  VirtualType,
} from './teact';
import { DEBUG } from '../../config';
import { addEventListener, removeAllDelegatedListeners, removeEventListener } from './dom-events';
import { unique } from '../../util/iteratees';

interface VirtualDomHead {
  children: [VirtualElement] | [];
}

interface SelectionState {
  selectionStart: number | null;
  selectionEnd: number | null;
  isCaretAtEnd: boolean;
}

type DOMElement = HTMLElement | SVGElement;

const FILTERED_ATTRIBUTES = new Set(['key', 'ref', 'teactFastList', 'teactOrderKey']);
const HTML_ATTRIBUTES = new Set(['dir', 'role', 'form']);
const CONTROLLABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const MAPPED_ATTRIBUTES: { [k: string]: string } = {
  autoPlay: 'autoplay',
  autoComplete: 'autocomplete',
};
const INDEX_KEY_PREFIX = '__indexKey#';

const headsByElement = new WeakMap<Element, VirtualDomHead>();
const extraClasses = new WeakMap<Element, Set<string>>();
const extraStyles = new WeakMap<Element, Record<string, string>>();

// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_virtualTreeSize = 1;

function render($element: VirtualElement | undefined, parentEl: HTMLElement) {
  if (!headsByElement.has(parentEl)) {
    headsByElement.set(parentEl, { children: [] });
  }

  const runImmediateEffects = captureImmediateEffects();
  const $head = headsByElement.get(parentEl)!;
  const $renderedChild = renderWithVirtual(parentEl, $head.children[0], $element, $head, 0);
  runImmediateEffects?.();

  $head.children = $renderedChild ? [$renderedChild] : [];

  if (process.env.APP_ENV === 'perf') {
    DEBUG_virtualTreeSize = 0;
    DEBUG_addToVirtualTreeSize($head);

    return DEBUG_virtualTreeSize;
  }

  return undefined;
}

function renderWithVirtual<T extends VirtualElement | undefined>(
  parentEl: DOMElement,
  $current: VirtualElement | undefined,
  $new: T,
  $parent: VirtualElementParent | VirtualDomHead,
  index: number,
  options: {
    skipComponentUpdate?: boolean;
    nextSibling?: ChildNode;
    forceMoveToEnd?: boolean;
    fragment?: DocumentFragment;
    isSvg?: true;
  } = {},
): T {
  const { skipComponentUpdate, fragment } = options;
  let { nextSibling, isSvg } = options;

  const isCurrentComponent = $current?.type === VirtualType.Component;
  const isNewComponent = $new?.type === VirtualType.Component;
  const $newAsReal = $new as VirtualElementReal;

  const isCurrentFragment = !isCurrentComponent && $current?.type === VirtualType.Fragment;
  const isNewFragment = !isNewComponent && $new?.type === VirtualType.Fragment;

  if ($new?.type === VirtualType.Tag && $new.tag === 'svg') {
    isSvg = true;
  }

  if (
    !skipComponentUpdate
    && isCurrentComponent && isNewComponent
    && !hasElementChanged($current!, $new!)
  ) {
    $new = updateComponent($current, $new as VirtualElementComponent) as typeof $new;
  }

  // Parent element may have changed, so we need to update the listener closure.
  if (
    !skipComponentUpdate
    && isNewComponent
    && ($new as VirtualElementComponent).componentInstance.mountState === MountState.Mounted
  ) {
    setupComponentUpdateListener(parentEl, $new as VirtualElementComponent, $parent, index);
  }

  if ($current === $new) {
    return $new;
  }

  if (DEBUG && $new) {
    const newTarget = 'target' in $new && $new.target;
    if (newTarget && (!$current || ('target' in $current && newTarget !== $current.target))) {
      throw new Error('[Teact] Cached virtual element was moved within tree');
    }
  }

  if (!$current && $new) {
    if (isNewComponent || isNewFragment) {
      if (isNewComponent) {
        $new = initComponent(parentEl, $new as VirtualElementComponent, $parent, index) as unknown as typeof $new;
      }

      mountChildren(parentEl, $new as VirtualElementComponent | VirtualElementFragment, {
        nextSibling, fragment, isSvg,
      });
    } else {
      const canSetTextContent = !fragment
        && !nextSibling
        && $newAsReal.type === VirtualType.Text
        && $parent.children.length === 1
        && !parentEl.firstChild;

      if (canSetTextContent) {
        parentEl.textContent = $newAsReal.value;
        $newAsReal.target = parentEl.firstChild!;
      } else {
        const node = createNode($newAsReal, isSvg);
        $newAsReal.target = node;
        insertBefore(fragment || parentEl, node, nextSibling);

        if ($newAsReal.type === VirtualType.Tag) {
          setElementRef($newAsReal, node as DOMElement);
        }
      }
    }
  } else if ($current && !$new) {
    remount(parentEl, $current, undefined);
  } else if ($current && $new) {
    if (hasElementChanged($current, $new)) {
      if (!nextSibling) {
        nextSibling = getNextSibling($current);
      }

      if (isNewComponent || isNewFragment) {
        if (isNewComponent) {
          $new = initComponent(parentEl, $new as VirtualElementComponent, $parent, index) as unknown as typeof $new;
        }

        remount(parentEl, $current, undefined);
        mountChildren(parentEl, $new as VirtualElementComponent | VirtualElementFragment, {
          nextSibling, fragment, isSvg,
        });
      } else {
        const node = createNode($newAsReal, isSvg);
        $newAsReal.target = node;
        remount(parentEl, $current, node, nextSibling);

        if ($newAsReal.type === VirtualType.Tag) {
          setElementRef($newAsReal, node as DOMElement);
        }
      }
    } else {
      const isComponent = isCurrentComponent && isNewComponent;
      const isFragment = isCurrentFragment && isNewFragment;

      if (isComponent || isFragment) {
        renderChildren(
          $current,
          $new as VirtualElementComponent | VirtualElementFragment,
          parentEl,
          nextSibling,
          options.forceMoveToEnd,
        );
      } else {
        const $currentAsReal = $current as VirtualElementReal;
        const currentTarget = $currentAsReal.target!;

        $newAsReal.target = currentTarget;
        $currentAsReal.target = undefined; // Help GC

        const isTag = $current.type === VirtualType.Tag;
        if (isTag) {
          const $newAsTag = $new as VirtualElementTag;

          setElementRef($current, undefined);
          setElementRef($newAsTag, currentTarget as DOMElement);

          if (nextSibling || options.forceMoveToEnd) {
            insertBefore(parentEl, currentTarget, nextSibling);
          }

          updateAttributes($current, $newAsTag, currentTarget as DOMElement, isSvg);
          renderChildren($current, $newAsTag, currentTarget as DOMElement, undefined, undefined, isSvg);
        }
      }
    }
  }

  return $new;
}

function initComponent(
  parentEl: DOMElement,
  $element: VirtualElementComponent,
  $parent: VirtualElementParent | VirtualDomHead,
  index: number,
) {
  const { componentInstance } = $element;

  if (componentInstance.mountState === MountState.New) {
    $element = mountComponent(componentInstance);
    setupComponentUpdateListener(parentEl, $element, $parent, index);
  }

  return $element;
}

function updateComponent($current: VirtualElementComponent, $new: VirtualElementComponent) {
  $current.componentInstance.props = $new.componentInstance.props;

  return renderComponent($current.componentInstance);
}

function setupComponentUpdateListener(
  parentEl: DOMElement,
  $element: VirtualElementComponent,
  $parent: VirtualElementParent | VirtualDomHead,
  index: number,
) {
  const { componentInstance } = $element;

  componentInstance.onUpdate = () => {
    $parent.children[index] = renderWithVirtual(
      parentEl,
      $parent.children[index],
      componentInstance.$element,
      $parent,
      index,
      { skipComponentUpdate: true },
    );
  };
}

function mountChildren(
  parentEl: DOMElement,
  $element: VirtualElementComponent | VirtualElementFragment,
  options: {
    nextSibling?: ChildNode;
    fragment?: DocumentFragment;
    isSvg?: true;
  },
) {
  const { children } = $element;
  for (let i = 0, l = children.length; i < l; i++) {
    const $child = children[i];
    const $renderedChild = renderWithVirtual(parentEl, undefined, $child, $element, i, options);
    if ($renderedChild !== $child) {
      children[i] = $renderedChild;
    }
  }
}

function unmountChildren(parentEl: DOMElement, $element: VirtualElementComponent | VirtualElementFragment) {
  for (const $child of $element.children) {
    renderWithVirtual(parentEl, $child, undefined, $element, -1);
  }
}

function createNode($element: VirtualElementReal, isSvg?: true): Node {
  if ($element.type === VirtualType.Empty) {
    return document.createTextNode('');
  }

  if ($element.type === VirtualType.Text) {
    return document.createTextNode($element.value);
  }

  const { tag, props, children } = $element;
  const element = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);

  processControlled(tag, props);

  // eslint-disable-next-line no-restricted-syntax
  for (const key in props) {
    if (!props.hasOwnProperty(key)) continue;

    if (props[key] !== undefined) {
      setAttribute(element, key, props[key], isSvg);
    }
  }

  processUncontrolledOnMount(element, props);

  for (let i = 0, l = children.length; i < l; i++) {
    const $child = children[i];
    const $renderedChild = renderWithVirtual(element, undefined, $child, $element, i, { isSvg });
    if ($renderedChild !== $child) {
      children[i] = $renderedChild;
    }
  }

  return element;
}

function remount(
  parentEl: DOMElement,
  $current: VirtualElement,
  node: Node | undefined,
  componentNextSibling?: ChildNode,
) {
  const isComponent = $current.type === VirtualType.Component;
  const isFragment = !isComponent && $current.type === VirtualType.Fragment;

  if (isComponent || isFragment) {
    if (isComponent) {
      unmountComponent($current.componentInstance);
    }

    unmountChildren(parentEl, $current);

    if (node) {
      insertBefore(parentEl, node, componentNextSibling);
    }
  } else {
    if (node) {
      parentEl.replaceChild(node, $current.target!);
    } else {
      parentEl.removeChild($current.target!);
    }

    unmountRealTree($current);
  }
}

function unmountRealTree($element: VirtualElement) {
  if ($element.type === VirtualType.Component) {
    unmountComponent($element.componentInstance);
  } else if ($element.type !== VirtualType.Fragment) {
    if ($element.type === VirtualType.Tag) {
      extraClasses.delete($element.target!);
      setElementRef($element, undefined);
      removeAllDelegatedListeners($element.target!);
    }

    $element.target = undefined; // Help GC

    if ($element.type !== VirtualType.Tag) {
      return;
    }
  }

  for (const $child of $element.children) {
    unmountRealTree($child);
  }
}

function insertBefore(parentEl: DOMElement | DocumentFragment, node: Node, nextSibling?: ChildNode) {
  if (nextSibling) {
    parentEl.insertBefore(node, nextSibling);
  } else {
    parentEl.appendChild(node);
  }
}

function getNextSibling($current: VirtualElement): ChildNode | undefined {
  if ($current.type === VirtualType.Component || $current.type === VirtualType.Fragment) {
    const lastChild = $current.children[$current.children.length - 1];
    return getNextSibling(lastChild);
  }

  return $current.target!.nextSibling || undefined;
}

function renderChildren(
  $current: VirtualElementParent,
  $new: VirtualElementParent,
  currentEl: DOMElement,
  nextSibling?: ChildNode,
  forceMoveToEnd = false,
  isSvg?: true,
) {
  if (DEBUG) {
    DEBUG_checkKeyUniqueness($new.children);
  }

  if (('props' in $new) && $new.props.teactFastList) {
    renderFastListChildren($current, $new, currentEl);
    return;
  }

  const currentChildren = $current.children;
  const newChildren = $new.children;

  const currentChildrenLength = currentChildren.length;
  const newChildrenLength = newChildren.length;
  const maxLength = Math.max(currentChildrenLength, newChildrenLength);

  const fragment = newChildrenLength > currentChildrenLength ? document.createDocumentFragment() : undefined;
  const lastCurrentChild = $current.children[currentChildrenLength - 1];
  const fragmentNextSibling = fragment && (
    nextSibling || (lastCurrentChild ? getNextSibling(lastCurrentChild) : undefined)
  );

  for (let i = 0; i < maxLength; i++) {
    const $renderedChild = renderWithVirtual(
      currentEl,
      currentChildren[i],
      newChildren[i],
      $new,
      i,
      i >= currentChildrenLength ? { fragment, isSvg } : { nextSibling, forceMoveToEnd, isSvg },
    );

    if ($renderedChild && $renderedChild !== newChildren[i]) {
      newChildren[i] = $renderedChild;
    }
  }

  if (fragment) {
    insertBefore(currentEl, fragment, fragmentNextSibling);
  }
}

// This function allows to prepend/append a bunch of new DOM nodes to the top/bottom of preserved ones.
// It also allows to selectively move particular preserved nodes within their DOM list.
function renderFastListChildren($current: VirtualElementParent, $new: VirtualElementParent, currentEl: DOMElement) {
  const currentChildren = $current.children;
  const newChildren = $new.children;

  const newKeys = new Set();
  for (const $newChild of newChildren) {
    const key = 'props' in $newChild ? $newChild.props.key : undefined;

    if (DEBUG && isParentElement($newChild)) {
      // eslint-disable-next-line no-null/no-null
      if (key === undefined || key === null) {
        // eslint-disable-next-line no-console
        console.warn('Missing `key` in `teactFastList`');
      }

      if ($newChild.type === VirtualType.Fragment) {
        throw new Error('[Teact] Fragment can not be child of container with `teactFastList`');
      }
    }

    newKeys.add(key);
  }

  // Build a collection of old children that also remain in the new list
  let currentRemainingIndex = 0;
  const remainingByKey: Record<string, { $element: VirtualElement; index: number; orderKey?: number }> = {};
  for (let i = 0, l = currentChildren.length; i < l; i++) {
    const $currentChild = currentChildren[i];

    let key = 'props' in $currentChild ? $currentChild.props.key : undefined;
    // eslint-disable-next-line no-null/no-null
    const isKeyPresent = key !== undefined && key !== null;

    // First we process removed children
    if (isKeyPresent && !newKeys.has(key)) {
      renderWithVirtual(currentEl, $currentChild, undefined, $new, -1);

      continue;
    } else if (!isKeyPresent) {
      const $newChild = newChildren[i];
      const newChildKey = ($newChild && 'props' in $newChild) ? $newChild.props.key : undefined;
      // If a non-key element remains at the same index we preserve it with a virtual `key`
      if ($newChild && !newChildKey) {
        key = `${INDEX_KEY_PREFIX}${i}`;
        // Otherwise, we just remove it
      } else {
        renderWithVirtual(currentEl, $currentChild, undefined, $new, -1);

        continue;
      }
    }

    // Then we build up info about remaining children
    remainingByKey[key] = {
      $element: $currentChild,
      index: currentRemainingIndex++,
      orderKey: 'props' in $currentChild ? $currentChild.props.teactOrderKey : undefined,
    };
  }

  let fragmentIndex: number | undefined;
  let fragmentSize: number | undefined;

  let currentPreservedIndex = 0;

  for (let i = 0, l = newChildren.length; i < l; i++) {
    const $newChild = newChildren[i];
    const key = 'props' in $newChild ? $newChild.props.key : `${INDEX_KEY_PREFIX}${i}`;
    const currentChildInfo = remainingByKey[key];

    if (!currentChildInfo) {
      if (fragmentSize === undefined) {
        fragmentIndex = i;
        fragmentSize = 0;
      }

      fragmentSize++;
      continue;
    }

    // This prepends new children to the top
    if (fragmentSize) {
      renderFragment(fragmentIndex!, fragmentSize, currentEl, $new);
      fragmentSize = undefined;
      fragmentIndex = undefined;
    }

    // Now we check if a preserved node was moved within preserved list
    const newOrderKey = 'props' in $newChild ? $newChild.props.teactOrderKey : undefined;
    // That is indicated by a changed `teactOrderKey` value
    const shouldMoveNode = (
      currentChildInfo.index !== currentPreservedIndex && (!newOrderKey || currentChildInfo.orderKey !== newOrderKey)
    );
    const isMovingDown = shouldMoveNode && currentPreservedIndex > currentChildInfo.index;

    if (!shouldMoveNode || isMovingDown) {
      currentPreservedIndex++;
    }

    const nextSibling = currentEl.childNodes[isMovingDown ? i + 1 : i];
    const options = shouldMoveNode ? (nextSibling ? { nextSibling } : { forceMoveToEnd: true }) : undefined;

    const $renderedChild = renderWithVirtual(currentEl, currentChildInfo.$element, $newChild, $new, i, options);
    if ($renderedChild !== $newChild) {
      newChildren[i] = $renderedChild;
    }
  }

  // This appends new children to the bottom
  if (fragmentSize) {
    renderFragment(fragmentIndex!, fragmentSize, currentEl, $new);
  }
}

function renderFragment(
  fragmentIndex: number, fragmentSize: number, parentEl: DOMElement, $parent: VirtualElementParent,
) {
  const nextSibling = parentEl.childNodes[fragmentIndex];

  if (fragmentSize === 1) {
    const $child = $parent.children[fragmentIndex];
    const $renderedChild = renderWithVirtual(parentEl, undefined, $child, $parent, fragmentIndex, { nextSibling });
    if ($renderedChild !== $child) {
      $parent.children[fragmentIndex] = $renderedChild;
    }

    return;
  }

  const fragment = document.createDocumentFragment();

  for (let i = fragmentIndex; i < fragmentIndex + fragmentSize; i++) {
    const $child = $parent.children[i];
    const $renderedChild = renderWithVirtual(parentEl, undefined, $child, $parent, i, { fragment });
    if ($renderedChild !== $child) {
      $parent.children[i] = $renderedChild;
    }
  }

  insertBefore(parentEl, fragment, nextSibling);
}

function setElementRef($element: VirtualElementTag, DOMElement: DOMElement | undefined) {
  const { ref } = $element.props;

  if (typeof ref === 'object') {
    ref.current = DOMElement;
  } else if (typeof ref === 'function') {
    ref(DOMElement);
  }
}

function processControlled(tag: string, props: AnyLiteral) {
  // TODO Remove after tests
  if (!props.teactExperimentControlled) {
    return;
  }

  const isValueControlled = props.value !== undefined;
  const isCheckedControlled = props.checked !== undefined;
  const isControlled = (isValueControlled || isCheckedControlled) && CONTROLLABLE_TAGS.includes(tag.toUpperCase());
  if (!isControlled) {
    return;
  }

  const {
    value, checked, onInput, onChange,
  } = props;

  props.onChange = undefined;
  props.onInput = (e: ChangeEvent<HTMLInputElement>) => {
    onInput?.(e);
    onChange?.(e);

    if (value !== undefined && value !== e.currentTarget.value) {
      const { selectionStart, selectionEnd } = e.currentTarget;
      const isCaretAtEnd = selectionStart === selectionEnd && selectionEnd === e.currentTarget.value.length;

      e.currentTarget.value = value;

      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        e.currentTarget.setSelectionRange(selectionStart, selectionEnd);

        const selectionState: SelectionState = { selectionStart, selectionEnd, isCaretAtEnd };
        // eslint-disable-next-line no-underscore-dangle
        e.currentTarget.dataset.__teactSelectionState = JSON.stringify(selectionState);
      }
    }

    if (checked !== undefined) {
      e.currentTarget.checked = checked;
    }
  };
}

function processUncontrolledOnMount(element: DOMElement, props: AnyLiteral) {
  if (!CONTROLLABLE_TAGS.includes(element.tagName)) {
    return;
  }

  if (props.defaultValue) {
    setAttribute(element, 'value', props.defaultValue);
  }

  if (props.defaultChecked) {
    setAttribute(element, 'checked', props.defaultChecked);
  }
}

function updateAttributes($current: VirtualElementTag, $new: VirtualElementTag, element: DOMElement, isSvg?: true) {
  processControlled(element.tagName, $new.props);

  const currentEntries = Object.entries($current.props);
  const newEntries = Object.entries($new.props);

  for (const [key, currentValue] of currentEntries) {
    const newValue = $new.props[key];

    if (
      currentValue !== undefined
      && (
        newValue === undefined
        || (currentValue !== newValue && key.startsWith('on'))
      )
    ) {
      removeAttribute(element, key, currentValue);
    }
  }

  for (const [key, newValue] of newEntries) {
    const currentValue = $current.props[key];

    if (newValue !== undefined && newValue !== currentValue) {
      setAttribute(element, key, newValue, isSvg);
    }
  }
}

function setAttribute(element: DOMElement, key: string, value: any, isSvg?: true) {
  if (key === 'className') {
    updateClassName(element, value, isSvg);
  } else if (key === 'value') {
    const inputEl = element as HTMLInputElement;

    if (inputEl.value !== value) {
      inputEl.value = value;

      // eslint-disable-next-line no-underscore-dangle
      const selectionStateJson = inputEl.dataset.__teactSelectionState;
      if (selectionStateJson) {
        const { selectionStart, selectionEnd, isCaretAtEnd } = JSON.parse(selectionStateJson) as SelectionState;

        if (isCaretAtEnd) {
          const length = inputEl.value.length;
          inputEl.setSelectionRange(length, length);
        } else if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
          inputEl.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    }
  } else if (key === 'style') {
    updateStyle(element, value);
  } else if (key === 'dangerouslySetInnerHTML') {
    // eslint-disable-next-line no-underscore-dangle
    element.innerHTML = value.__html;
  } else if (key.startsWith('on')) {
    addEventListener(element, key, value, key.endsWith('Capture'));
  } else if (isSvg || key.startsWith('data-') || key.startsWith('aria-') || HTML_ATTRIBUTES.has(key)) {
    element.setAttribute(key, value);
  } else if (!FILTERED_ATTRIBUTES.has(key)) {
    (element as any)[MAPPED_ATTRIBUTES[key] || key] = value;
  }
}

function removeAttribute(element: DOMElement, key: string, value: any) {
  if (key === 'className') {
    updateClassName(element, '');
  } else if (key === 'value') {
    (element as HTMLInputElement).value = '';
  } else if (key === 'style') {
    updateStyle(element, '');
  } else if (key === 'dangerouslySetInnerHTML') {
    element.innerHTML = '';
  } else if (key.startsWith('on')) {
    removeEventListener(element, key, value, key.endsWith('Capture'));
  } else if (!FILTERED_ATTRIBUTES.has(key)) {
    element.removeAttribute(key);
  }
}

function updateClassName(element: DOMElement, value: string, isSvg?: true) {
  if (isSvg) {
    element.setAttribute('class', value);
    return;
  }

  const htmlElement = element as HTMLElement;
  const extra = extraClasses.get(element);
  if (!extra) {
    htmlElement.className = value;
    return;
  }

  const extraArray = Array.from(extra);
  if (value) {
    extraArray.push(value);
  }

  htmlElement.className = extraArray.join(' ');
}

function updateStyle(element: DOMElement, value: string) {
  element.style.cssText = value;

  const extraObject = extraStyles.get(element);
  if (extraObject) {
    applyExtraStyles(element);
  }
}

export function addExtraClass(element: DOMElement, className: string, forceSingle = false) {
  if (!forceSingle) {
    const classNames = className.split(' ');
    if (classNames.length > 1) {
      for (const cn of classNames) {
        addExtraClass(element, cn, true);
      }

      return;
    }
  }

  element.classList.add(className);

  const classList = extraClasses.get(element);
  if (classList) {
    classList.add(className);
  } else {
    extraClasses.set(element, new Set([className]));
  }
}

export function removeExtraClass(element: DOMElement, className: string, forceSingle = false) {
  if (!forceSingle) {
    const classNames = className.split(' ');
    if (classNames.length > 1) {
      for (const cn of classNames) {
        removeExtraClass(element, cn, true);
      }

      return;
    }
  }

  element.classList.remove(className);

  const classList = extraClasses.get(element);
  if (classList) {
    classList.delete(className);

    if (!classList.size) {
      extraClasses.delete(element);
    }
  }
}

export function toggleExtraClass(element: DOMElement, className: string, force?: boolean, forceSingle = false) {
  if (!forceSingle) {
    const classNames = className.split(' ');
    if (classNames.length > 1) {
      for (const cn of classNames) {
        toggleExtraClass(element, cn, force, true);
      }

      return;
    }
  }

  element.classList.toggle(className, force);

  if (element.classList.contains(className)) {
    addExtraClass(element, className);
  } else {
    removeExtraClass(element, className);
  }
}

export function setExtraStyles(element: DOMElement, styles: Partial<CSSStyleDeclaration> & AnyLiteral) {
  extraStyles.set(element, styles);
  applyExtraStyles(element);
}

function applyExtraStyles(element: DOMElement) {
  const standardStyles = Object.entries(extraStyles.get(element)!).reduce<Record<string, string>>(
    (acc, [prop, value]) => {
      if (prop.startsWith('--')) {
        element.style.setProperty(prop, value);
      } else {
        acc[prop] = value;
      }

      return acc;
    },
    {},
  );

  Object.assign(element.style, standardStyles);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function DEBUG_addToVirtualTreeSize($current: VirtualElementParent | VirtualDomHead) {
  DEBUG_virtualTreeSize += $current.children.length;

  $current.children.forEach(($child) => {
    if (isParentElement($child)) {
      DEBUG_addToVirtualTreeSize($child);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function DEBUG_checkKeyUniqueness(children: VirtualElementChildren) {
  const firstChild = children[0];
  if (firstChild && 'props' in firstChild && firstChild.props.key !== undefined) {
    const keys = children.reduce((acc: any[], child) => {
      if ('props' in child && child.props.key) {
        acc.push(child.props.key);
      }

      return acc;
    }, []);

    if (keys.length !== unique(keys).length) {
      // eslint-disable-next-line no-console
      console.warn('[Teact] Duplicated keys:', keys.filter((e, i, a) => a.indexOf(e) !== i));
      throw new Error('[Teact] Children keys are not unique');
    }
  }
}

const TeactDOM = { render };
export default TeactDOM;
