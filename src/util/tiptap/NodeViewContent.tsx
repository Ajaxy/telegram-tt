import type { TeactNode } from '../../lib/teact/teact';

import { useTeactNodeViewContext } from './TeactNodeViewContext';

type OwnProps = {
  as?: 'div' | 'pre' | 'span';
  className?: string;
  placeholder?: string;
  contentEditable?: boolean;
  children?: TeactNode;
};

const DEFAULT_ELEMENT_TAG = 'div';

const NodeViewContent = ({
  as = DEFAULT_ELEMENT_TAG,
  className,
  placeholder,
  contentEditable,
  children,
}: OwnProps) => {
  const { contentDOMElement } = useTeactNodeViewContext();
  const Element = as;

  function handleElementRef(element?: HTMLElement) {
    if (!element || !contentDOMElement || contentDOMElement.parentElement === element) {
      return;
    }

    element.appendChild(contentDOMElement);
  }

  return (
    <Element
      className={className}
      contentEditable={contentEditable}
      ref={handleElementRef}
      data-node-view-content=""
      data-placeholder={placeholder}
    >
      {children}
    </Element>
  );
};

export default NodeViewContent;
