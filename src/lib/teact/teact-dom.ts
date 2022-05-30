import type {
  VirtualElement,
  VirtualElementComponent,
  VirtualRealElement,
  VirtualElementChildren,
} from './teact';
import {
  hasElementChanged,
  isComponentElement,
  isEmptyElement,
  isRealElement,
  isTextElement,
  mountComponent,
  renderComponent,
  unmountTree,
  getTarget,
  setTarget,
} from './teact';
import generateIdFor from '../../util/generateIdFor';
import { DEBUG } from '../../config';
import { addEventListener, removeEventListener } from './dom-events';
import { unique } from '../../util/iteratees';

type VirtualDomHead = {
  children: [VirtualElement] | [];
};

const FILTERED_ATTRIBUTES = new Set(['key', 'ref', 'teactFastList', 'teactOrderKey']);
const HTML_ATTRIBUTES = new Set(['dir', 'role']);
const MAPPED_ATTRIBUTES: { [k: string]: string } = {
  autoPlay: 'autoplay',
  autoComplete: 'autocomplete',
};
const INDEX_KEY_PREFIX = '__indexKey#';

const headsByElement: Record<string, VirtualDomHead> = {};
// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_virtualTreeSize = 1;

function render($element?: VirtualElement, parentEl?: HTMLElement | null) {
  if (!parentEl) {
    return undefined;
  }

  let headId = parentEl.getAttribute('data-teact-head-id');
  if (!headId) {
    headId = generateIdFor(headsByElement);
    headsByElement[headId] = { children: [] };
    parentEl.setAttribute('data-teact-head-id', headId);
  }

  const $head = headsByElement[headId];
  $head.children = [renderWithVirtual(parentEl, $head.children[0], $element, $head, 0) as VirtualElement];

  if (process.env.APP_ENV === 'perf') {
    DEBUG_virtualTreeSize = 0;
    DEBUG_addToVirtualTreeSize($head);

    return DEBUG_virtualTreeSize;
  }

  return undefined;
}

function renderWithVirtual(
  parentEl: HTMLElement,
  $current: VirtualElement | undefined,
  $new: VirtualElement | undefined,
  $parent: VirtualRealElement | VirtualDomHead,
  index: number,
  {
    skipComponentUpdate = false,
    forceIndex = false,
    fragment,
    moveDirection,
  }: {
    skipComponentUpdate?: boolean;
    forceIndex?: boolean;
    fragment?: DocumentFragment;
    moveDirection?: 'up' | 'down';
  } = {},
) {
  const isCurrentComponent = $current && isComponentElement($current);
  const isNewComponent = $new && isComponentElement($new);

  if (
    !skipComponentUpdate
    && isCurrentComponent && isNewComponent
    && !hasElementChanged($current!, $new!)
  ) {
    $new = updateComponent($current as VirtualElementComponent, $new as VirtualElementComponent);
  }

  // Parent element may have changed, so we need to update the listener closure.
  if (!skipComponentUpdate && isNewComponent && ($new as VirtualElementComponent).componentInstance.isMounted) {
    setupComponentUpdateListener($new as VirtualElementComponent, $parent, index, parentEl);
  }

  if ($current === $new) {
    return $new;
  }

  if (DEBUG && $new) {
    const newTarget = getTarget($new);
    if (newTarget && (!$current || newTarget !== getTarget($current))) {
      throw new Error('[Teact] Cached virtual element was moved within tree');
    }
  }

  if (!$current && $new) {
    if (isNewComponent) {
      $new = initComponent($new as VirtualElementComponent, $parent, index, parentEl);
    }

    const node = createNode($new);
    setTarget($new, node);

    if (forceIndex && parentEl.childNodes[index]) {
      parentEl.insertBefore(node, parentEl.childNodes[index]);
    } else {
      (fragment || parentEl).appendChild(node);
    }
  } else if ($current && !$new) {
    parentEl.removeChild(getTarget($current)!);
    unmountTree($current);
  } else if ($current && $new) {
    if (hasElementChanged($current, $new)) {
      if (isNewComponent) {
        $new = initComponent($new as VirtualElementComponent, $parent, index, parentEl);
      }

      const node = createNode($new);
      setTarget($new, node);
      parentEl.replaceChild(node, getTarget($current)!);
      unmountTree($current);
    } else {
      const areComponents = isCurrentComponent && isNewComponent;
      const currentTarget = getTarget($current);

      if (!areComponents) {
        setTarget($new, currentTarget!);
        setTarget($current, undefined as any); // Help GC

        if ('props' in $current && 'props' in $new) {
          $new.props.ref = $current.props.ref;
        }
      }

      if (isRealElement($new)) {
        if (moveDirection) {
          const node = currentTarget!;
          const nextSibling = parentEl.childNodes[moveDirection === 'up' ? index : index + 1];

          if (nextSibling) {
            parentEl.insertBefore(node, nextSibling);
          } else {
            (fragment || parentEl).appendChild(node);
          }
        }

        if (!areComponents) {
          updateAttributes(($current as VirtualRealElement), $new, currentTarget as HTMLElement);
        }

        $new.children = renderChildren(
          ($current as VirtualRealElement),
          $new,
          areComponents ? parentEl : currentTarget as HTMLElement,
        );
      }
    }
  }

  return $new;
}

function initComponent(
  $element: VirtualElementComponent, $parent: VirtualRealElement | VirtualDomHead, index: number, parentEl: HTMLElement,
) {
  if (!isComponentElement($element)) {
    return $element;
  }

  const { componentInstance } = $element;

  if (!componentInstance.isMounted) {
    $element = mountComponent(componentInstance);
    setupComponentUpdateListener($element, $parent, index, parentEl);

    const $firstChild = $element.children[0];
    if (isComponentElement($firstChild)) {
      $element.children = [initComponent($firstChild, $element, 0, parentEl)];
    }

    componentInstance.isMounted = true;
  }

  return $element;
}

function updateComponent($current: VirtualElementComponent, $new: VirtualElementComponent) {
  $current.componentInstance.props = $new.componentInstance.props;

  return renderComponent($current.componentInstance);
}

function setupComponentUpdateListener(
  $element: VirtualElementComponent, $parent: VirtualRealElement | VirtualDomHead, index: number, parentEl: HTMLElement,
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
    ) as VirtualElementComponent;
  };
}

function createNode($element: VirtualElement): Node {
  if (isEmptyElement($element)) {
    return document.createTextNode('');
  }

  if (isTextElement($element)) {
    return document.createTextNode($element.value);
  }

  if (isComponentElement($element)) {
    return createNode($element.children[0] as VirtualElement);
  }

  const { tag, props, children = [] } = $element;
  const element = document.createElement(tag);

  if (typeof props.ref === 'object') {
    props.ref.current = element;
  }

  Object.entries(props).forEach(([key, value]) => {
    if (props[key] !== undefined) {
      setAttribute(element, key, value);
    }
  });

  $element.children = children.map(($child, i) => (
    renderWithVirtual(element, undefined, $child, $element, i) as VirtualElement
  ));

  return element;
}

function renderChildren(
  $current: VirtualRealElement, $new: VirtualRealElement, currentEl: HTMLElement,
) {
  if (DEBUG) {
    DEBUG_checkKeyUniqueness($new.children);
  }

  if ($new.props.teactFastList) {
    return renderFastListChildren($current, $new, currentEl);
  }

  const currentChildrenLength = $current.children.length;
  const newChildrenLength = $new.children.length;
  const maxLength = Math.max(currentChildrenLength, newChildrenLength);
  const newChildren = [];
  const fragment = newChildrenLength > currentChildrenLength + 1 ? document.createDocumentFragment() : undefined;

  for (let i = 0; i < maxLength; i++) {
    const $newChild = renderWithVirtual(
      currentEl,
      $current.children[i],
      $new.children[i],
      $new,
      i,
      i >= currentChildrenLength ? { fragment } : undefined,
    );

    if ($newChild) {
      newChildren.push($newChild);
    }
  }

  if (fragment) {
    currentEl.appendChild(fragment);
  }

  return newChildren;
}

// This function allows to prepend/append a bunch of new DOM nodes to the top/bottom of preserved ones.
// It also allows to selectively move particular preserved nodes within their DOM list.
function renderFastListChildren($current: VirtualRealElement, $new: VirtualRealElement, currentEl: HTMLElement) {
  const newKeys = new Set(
    $new.children.map(($newChild) => {
      const key = 'props' in $newChild && $newChild.props.key;

      // eslint-disable-next-line no-null/no-null
      if (DEBUG && isRealElement($newChild) && (key === undefined || key === null)) {
        // eslint-disable-next-line no-console
        console.warn('Missing `key` in `teactFastList`');
      }

      return key;
    }),
  );

  // Build a collection of old children that also remain in the new list
  let currentRemainingIndex = 0;
  const remainingByKey = $current.children
    .reduce((acc, $currentChild, i) => {
      let key = 'props' in $currentChild ? $currentChild.props.key : undefined;
      // eslint-disable-next-line no-null/no-null
      const isKeyPresent = key !== undefined && key !== null;

      // First we process removed children
      if (isKeyPresent && !newKeys.has(key)) {
        renderWithVirtual(currentEl, $currentChild, undefined, $new, -1);

        return acc;
      } else if (!isKeyPresent) {
        const $newChild = $new.children[i];
        const newChildKey = ($newChild && 'props' in $newChild) ? $newChild.props.key : undefined;
        // If a non-key element remains at the same index we preserve it with a virtual `key`
        if ($newChild && !newChildKey) {
          key = `${INDEX_KEY_PREFIX}${i}`;
          // Otherwise, we just remove it
        } else {
          renderWithVirtual(currentEl, $currentChild, undefined, $new, -1);

          return acc;
        }
      }

      // Then we build up info about remaining children
      acc[key] = {
        $element: $currentChild,
        index: currentRemainingIndex++,
        orderKey: 'props' in $currentChild ? $currentChild.props.teactOrderKey : undefined,
      };
      return acc;
    }, {} as Record<string, { $element: VirtualElement; index: number; orderKey?: number }>);

  let newChildren: VirtualElement[] = [];

  let fragmentElements: VirtualElement[] | undefined;
  let fragmentIndex: number | undefined;

  let currentPreservedIndex = 0;

  $new.children.forEach(($newChild, i) => {
    const key = 'props' in $newChild ? $newChild.props.key : `${INDEX_KEY_PREFIX}${i}`;
    const currentChildInfo = remainingByKey[key];

    if (!currentChildInfo) {
      if (!fragmentElements) {
        fragmentElements = [];
        fragmentIndex = i;
      }

      fragmentElements.push($newChild);
      return;
    }

    // This prepends new children to the top
    if (fragmentElements) {
      newChildren = newChildren.concat(renderFragment(fragmentElements, fragmentIndex!, currentEl, $new));
      fragmentElements = undefined;
      fragmentIndex = undefined;
    }

    // Now we check if a preserved node was moved within preserved list
    const newOrderKey = 'props' in $newChild ? $newChild.props.teactOrderKey : undefined;
    // That is indicated by a changed `teactOrderKey` value
    const shouldMoveNode = (
      currentChildInfo.index !== currentPreservedIndex && currentChildInfo.orderKey !== newOrderKey
    );
    const isMovingDown = shouldMoveNode && currentPreservedIndex > currentChildInfo.index;

    if (!shouldMoveNode || isMovingDown) {
      currentPreservedIndex++;
    }

    newChildren.push(
      renderWithVirtual(currentEl, currentChildInfo.$element, $newChild, $new, i, {
        forceIndex: true,
        moveDirection: shouldMoveNode ? (isMovingDown ? 'down' : 'up') : undefined,
      })!,
    );
  });

  // This appends new children to the bottom
  if (fragmentElements) {
    newChildren = newChildren.concat(renderFragment(fragmentElements, fragmentIndex!, currentEl, $new));
  }

  return newChildren;
}

function renderFragment(
  elements: VirtualElement[], fragmentIndex: number, parentEl: HTMLElement, $parent: VirtualRealElement,
) {
  if (elements.length === 1) {
    return [renderWithVirtual(parentEl, undefined, elements[0], $parent, fragmentIndex, { forceIndex: true })!];
  }

  const fragment = document.createDocumentFragment();
  const newChildren = elements.map(($element) => (
    renderWithVirtual(parentEl, undefined, $element, $parent, fragmentIndex, { fragment })!
  ));

  if (parentEl.childNodes[fragmentIndex]) {
    parentEl.insertBefore(fragment, parentEl.childNodes[fragmentIndex]);
  } else {
    parentEl.appendChild(fragment);
  }

  return newChildren;
}

function updateAttributes($current: VirtualRealElement, $new: VirtualRealElement, element: HTMLElement) {
  const currentEntries = Object.entries($current.props);
  const newEntries = Object.entries($new.props);

  currentEntries.forEach(([key, currentValue]) => {
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
  });

  newEntries.forEach(([key, newValue]) => {
    const currentValue = $current.props[key];

    if (newValue !== undefined && newValue !== currentValue) {
      setAttribute(element, key, newValue);
    }
  });
}

function setAttribute(element: HTMLElement, key: string, value: any) {
  // An optimization attempt
  if (key === 'className') {
    element.className = value;
    // An optimization attempt
  } else if (key === 'value') {
    if ((element as HTMLInputElement).value !== value) {
      (element as HTMLInputElement).value = value;
    }
  } else if (key === 'style') {
    element.style.cssText = value;
  } else if (key === 'dangerouslySetInnerHTML') {
    // eslint-disable-next-line no-underscore-dangle
    element.innerHTML = value.__html;
  } else if (key.startsWith('on')) {
    addEventListener(element, key, value, key.endsWith('Capture'));
  } else if (key.startsWith('data-') || key.startsWith('aria-') || HTML_ATTRIBUTES.has(key)) {
    element.setAttribute(key, value);
  } else if (!FILTERED_ATTRIBUTES.has(key)) {
    (element as any)[MAPPED_ATTRIBUTES[key] || key] = value;
  }
}

function removeAttribute(element: HTMLElement, key: string, value: any) {
  if (key === 'className') {
    element.className = '';
  } else if (key === 'value') {
    (element as HTMLInputElement).value = '';
  } else if (key === 'style') {
    element.style.cssText = '';
  } else if (key === 'dangerouslySetInnerHTML') {
    element.innerHTML = '';
  } else if (key.startsWith('on')) {
    removeEventListener(element, key, value, key.endsWith('Capture'));
  } else if (key.startsWith('data-') || key.startsWith('aria-') || HTML_ATTRIBUTES.has(key)) {
    element.removeAttribute(key);
  } else if (!FILTERED_ATTRIBUTES.has(key)) {
    delete (element as any)[MAPPED_ATTRIBUTES[key] || key];
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function DEBUG_addToVirtualTreeSize($current: VirtualRealElement | VirtualDomHead) {
  DEBUG_virtualTreeSize += $current.children.length;

  $current.children.forEach(($child) => {
    if (isRealElement($child)) {
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
      throw new Error('[Teact] Children keys are not unique');
    }
  }
}

const TeactDOM = { render };
export default TeactDOM;
