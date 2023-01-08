import type { Element, Root } from 'hast';
import { lowlight } from 'lowlight/lib/core';
import type { TeactNode } from '../lib/teact/teact';
import Teact from '../lib/teact/teact';

const SUPPORTED_LANGUAGES: Record<string, string[]> = {
  '1c': ['1с'], // Allow cyrillic
  bash: ['sh'],
  c: ['h'],
  cpp: ['cc', 'c++', 'h++', 'hpp', 'hh', 'hxx', 'cxx'],
  csharp: ['cs', 'c#'],
  css: [],
  erlang: ['erl'],
  elixir: ['ex', 'exs'],
  go: ['golang'],
  handlebars: ['hbs', 'html.hbs', 'html.handlebars', 'htmlbars'],
  haskell: ['hs'],
  ini: ['toml'],
  java: ['jsp'],
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  json: [],
  kotlin: ['kt', 'kts'],
  lisp: [],
  lua: [],
  makefile: ['mk', 'mak', 'make'],
  markdown: ['md', 'mkdown', 'mkd'],
  matlab: [],
  objectivec: ['mm', 'objc', 'obj-c', 'obj-c++', 'objective-c++'],
  perl: ['pl', 'pm'],
  php: [],
  python: ['py', 'gyp', 'ipython'],
  r: [],
  ruby: ['rb', 'gemspec', 'podspec', 'thor', 'irb'],
  rust: ['rs'],
  scheme: [],
  scss: [],
  smalltalk: ['st'],
  sql: [],
  swift: [],
  twig: ['craftcms'],
  typelanguage: ['tl'],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist', 'wsf', 'svg'],
  yaml: [],
};

const THIRD_PARTY_LANGUAGES = ['typelanguage'];

const languagePromises = new Map<string, Promise<any>>();

export default async function highlightCode(text: string, language: string) {
  const lowLang = language.toLowerCase();
  const result = await ensureLanguage(lowLang);
  if (!result) return undefined;
  const tree = lowlight.highlight(lowLang, text);
  return treeToElements(tree);
}

function getLanguageName(alias: string) {
  return Object.entries(SUPPORTED_LANGUAGES)
    .find(([langName, aliases]) => langName === alias || aliases.includes(alias))?.[0];
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

  const languagePromise = THIRD_PARTY_LANGUAGES.includes(langCode)
    ? loadThirdPartyLanguage(langCode) : loadFirstPartyLanguage(langCode);
  if (!languagePromise) return false;

  const syntax = await languagePromise;
  lowlight.registerLanguage(langCode, syntax.default);
  if (langCode === '1c') {
    lowlight.registerAlias('1c', '1с'); // Allow cyrillic
  }
  return true;
}

function loadFirstPartyLanguage(langCode: string) {
  // Funky webpack bug https://github.com/webpack/webpack/issues/13865
  const languagePromise = import(
    /* webpackChunkName: "Highlight for [request]" */
    `../../node_modules/highlight.js/lib/languages/${langCode}`
  );
  languagePromises.set(langCode, languagePromise);
  return languagePromise;
}

function loadThirdPartyLanguage(langCode: string) {
  if (langCode === 'typelanguage') {
    const langPromise = import('../lib/hljs-tl/typelanguage');
    languagePromises.set(langCode, langPromise);
    return langPromise;
  }
  return undefined;
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
