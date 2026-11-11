// Bundles produced by the Vite plugin in vite.ts (esbuild IIFE builds).
declare module 'virtual:sandbox-bundle' {
  const code: string;
  export default code;
}
// linkedom's selector engine, reached only through the build-time redirect in
// scripts/sandbox-build.ts (not a direct dependency, hence no types).
declare module 'css-select';

// Renderer transport, set by esbuild `define` (scripts/sandbox-build.ts).
declare const __TW_TRANSPORT__: 'port' | 'webkit';
// css-tree's entry points (host/css-tree.ts), which @types/css-tree leaves out
declare module 'css-tree/parser' {
  const parse: typeof import('css-tree').parse;
  export default parse;
}
declare module 'css-tree/walker' {
  const walk: typeof import('css-tree').walk;
  export default walk;
}
declare module 'css-tree/generator' {
  const generate: typeof import('css-tree').generate;
  export default generate;
}
declare module 'css-tree/utils' {
  export { List } from 'css-tree';
}
