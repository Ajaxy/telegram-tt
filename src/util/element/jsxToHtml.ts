import type { VirtualElement } from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

export default function jsxToHtml(jsx: VirtualElement) {
  const fragment = document.createElement('div');
  TeactDOM.render(jsx, fragment);

  const children = Array.from(fragment.children);
  TeactDOM.render(undefined, fragment);

  return children;
}
