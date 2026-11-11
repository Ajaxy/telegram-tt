// css-tree through its entry points (local patch, NOTICE.md): the package's index builds the lexer with its syntax data
// (~120 KB minified), which the sanitizer never uses. The same parser, walker and generator, with css-tree's types.

import type * as CssTree from 'css-tree';
import generate from 'css-tree/generator';
import parse from 'css-tree/parser';
import { List } from 'css-tree/utils';
import walk from 'css-tree/walker';

export type * from 'css-tree';
export { generate, List, parse, walk };
export const find = (walk as typeof walk & { find: typeof CssTree.find }).find;
