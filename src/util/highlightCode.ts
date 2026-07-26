import type { Element, Root } from 'hast';
import { createLowlight } from 'lowlight';
import type { TeactNode } from '../lib/teact/teact';
import Teact from '../lib/teact/teact';

import { createCallbackManager } from './callbacks';
import { getCodeLanguageName } from './codeLanguages';

const THIRD_PARTY_LANGUAGES = ['typelanguage'];

const LANGUAGE_MODULES = import.meta.glob('../../node_modules/highlight.js/es/languages/*.js') as Record<
  string,
  () => Promise<{ default: any }>
>;

const {
  addCallback: subscribeToCodeLanguageLoad,
  runCallbacks: runLanguageLoadCallbacks,
} = createCallbackManager<NoneToVoidFunction>();
const languagePromises = new Map<string, Promise<any>>();
export const lowlight = createLowlight({});
export { subscribeToCodeLanguageLoad };

export function requestCodeBlockHighlightRefresh() {
  runLanguageLoadCallbacks();
}

export default async function highlightCode(text: string, language: string) {
  const lowLang = language.toLowerCase();
  const langCode = getCodeLanguageName(lowLang);
  if (!langCode) return undefined;

  const result = await ensureCodeLanguage(langCode);
  if (!result) return undefined;
  const tree = lowlight.highlight(langCode, text);
  return treeToElements(tree);
}

export async function ensureCodeLanguage(language: string) {
  if (lowlight.registered(language)) {
    return true;
  }

  const langCode = getCodeLanguageName(language);
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
  lowlight.register(langCode, syntax.default);
  if (langCode === '1c') {
    lowlight.registerAlias('1c', '1с'); // Allow cyrillic
  }
  notifyLanguageLoad();
  return true;
}

function notifyLanguageLoad() {
  runLanguageLoadCallbacks();
}

function loadFirstPartyLanguage(langCode: string) {
  const loadLanguageModule = LANGUAGE_MODULES[`../../node_modules/highlight.js/es/languages/${langCode}.js`];
  if (!loadLanguageModule) return undefined;

  const languagePromise = loadLanguageModule();
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
