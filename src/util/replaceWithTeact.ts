import { type TeactNode } from '../lib/teact/teact';

export function replaceWithTeact(
  input: string, searchValue: string | RegExp, replaceValue: TeactNode,
) {
  const parts = input.split(searchValue);
  const [firstElement, ...rest] = parts;

  return rest.reduce((acc: TeactNode[], curr: string): TeactNode[] => (
    acc.concat(replaceValue, curr)
  ), [firstElement]).filter(Boolean);
}

export function replaceInStringsWithTeact(
  input: TeactNode[], searchValue: string | RegExp, replaceValue: TeactNode,
) {
  return input.flatMap((curr: TeactNode) => {
    if (typeof curr === 'string') return replaceWithTeact(curr, searchValue, replaceValue);
    return curr;
  }, []);
}
