import Teact, { type Props } from './teact';
export type { JSX } from 'react';
export const Fragment = Teact.Fragment;

function create(type: any, props: Props = {}, key?: any) {
  if (key !== undefined) props.key = key;
  const children = props.children;
  if (props.children !== undefined) props.children = undefined;
  return Teact.createElement(type, props, children);
}

export function jsx(type: any, props: Props, key?: any) {
  return create(type, props, key);
}

// Not implemented, reusing jsx for now
export const jsxs = jsx;
export const jsxDEV = jsx;
