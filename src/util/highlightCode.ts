import type { Element, Root } from 'hast';
import { lowlight } from 'lowlight/lib/core';
import type { TeactNode } from '../lib/teact/teact';
import Teact from '../lib/teact/teact';

// First element in alias array MUST BE a language package name
const SUPPORTED_LANGUAGES = {
  '1c': ['1c', '1с'], // Allow cyrillic
  bash: ['bash', 'sh'],
  c: ['c', 'h'],
  cpp: ['cpp', 'cc', 'c++', 'h++', 'hpp', 'hh', 'hxx', 'cxx'],
  csharp: ['chasp', 'cs', 'c#'],
  css: ['css'],
  erlang: ['erlang', 'erl'],
  elixir: ['elixir', 'ex', 'exs'],
  go: ['go', 'golang'],
  handlebars: ['handlebars', 'hbs', 'html.hbs', 'html.handlebars', 'htmlbars'],
  haskell: ['haskell', 'hs'],
  ini: ['ini', 'toml'],
  java: ['java', 'jsp'],
  javascript: ['javascript', 'js', 'jsx', 'mjs', 'cjs'],
  json: ['json'],
  kotlin: ['kotlin', 'kt', 'kts'],
  lisp: ['lisp'],
  lua: ['lua'],
  makefile: ['makefile', 'mk', 'mak', 'make'],
  markdown: ['markdown', 'md', 'mkdown', 'mkd'],
  matlab: ['matlab'],
  objectivec: ['objectivec', 'mm', 'objc', 'obj-c', 'obj-c++', 'objective-c++'],
  perl: ['perl', 'pl', 'pm'],
  php: ['php'],
  python: ['python', 'py', 'gyp', 'ipython'],
  r: ['r'],
  ruby: ['ruby', 'rb', 'gemspec', 'podspec', 'thor', 'irb'],
  rust: ['rust', 'rs'],
  scss: ['scss'],
  sql: ['sql'],
  swift: ['swift'],
  twig: ['twig', 'craftcms'],
  typescript: ['typescript', 'ts', 'tsx'],
  xml: ['xml', 'html', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist', 'wsf', 'svg'],
  yaml: ['yaml', 'yml'],
};

const languagePromises = new Map<string, Promise<void>>();

export default async function highlightCode(text: string, language: string) {
  const lowLang = language.toLowerCase();
  const result = await ensureLanguage(lowLang);
  if (!result) return undefined;
  const tree = lowlight.highlight(lowLang, text);
  return treeToElements(tree);
}

function getLanguageName(alias: string) {
  return Object.values(SUPPORTED_LANGUAGES).find((codes) => codes.includes(alias))?.[0];
}

async function ensureLanguage(language: string) {
  if (lowlight.registered(language)) {
    return true;
  }

  const langCode = getLanguageName(language);
  if (!langCode) {
    return false;
  }

  if (languagePromises.has(langCode)) {
    await languagePromises.get(langCode);
    return true;
  }

  // Funky webpack bug https://github.com/webpack/webpack/issues/13865
  const languagePromise = import(
    /* webpackChunkName: "Highlight for [request]" */
    `../../node_modules/highlight.js/lib/languages/${langCode}`
  );
  languagePromises.set(langCode, languagePromise);
  // Allow errors to help debugging wrong language names
  const syntax = await languagePromise;
  lowlight.registerLanguage(langCode, syntax.default);
  if (langCode === '1c') {
    lowlight.registerAlias('1c', '1с'); // Allow cyrillic
  }
  return true;
}

function treeToElements(tree: Element | Root): TeactNode {
  const children = tree.children.map((child) => {
    if (child.type === 'text') {
      return child.value;
    }
    if (child.type === 'element') {
      return treeToElements(child);
    }
    return undefined;
  }).filter(Boolean);

  if (tree.type === 'root') {
    return Teact.createElement('code', { className: 'hljs custom-scroll-x' }, children) as unknown as TeactNode;
  }

  const name = tree.tagName;
  const classNameArray = tree.properties?.className as string[];
  const className = classNameArray?.join(' ');

  return Teact.createElement(name, { className }, children) as unknown as TeactNode;
}
