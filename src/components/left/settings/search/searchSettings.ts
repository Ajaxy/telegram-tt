import type { IconName } from '../../../../types/icons';
import type { LangFn } from '../../../../util/localization';
import type { IconBackdropColor } from '../../../gili/primitives/IconBackdrop';
import { type SettingsHighlight, SettingsScreens } from '../../../../types';

import { getSettingsLink } from '../../../../util/settingsLinks';
import {
  SETTINGS_SEARCH_ENTRIES,
  SETTINGS_SEARCH_SECTIONS,
  type SettingsSearchFlag,
  type SettingsSearchSection,
} from './registry';

type SettingsSearchFlags = Record<SettingsSearchFlag, boolean | undefined>;

export type SettingsSearchItem = {
  id: string;
  screen: SettingsScreens;
  title: string;
  path: string;
  depth: number;
  categoryScreen?: SettingsScreens;
  icon?: IconName;
  iconBg?: IconBackdropColor;
  highlight?: SettingsHighlight;
  link?: string;
  isSection?: boolean;
  titleVariants: string[];
  titleWords: string[];
  keywordWords: string[];
};

const PATH_SEPARATOR = ' › ';
const KEYWORDS_SEPARATOR = ',';
const WORDS_SEPARATOR = ' ';
const SCORE_TITLE_START = 0;
const SCORE_TITLE = 1;
const SCORE_KEYWORDS = 2;

const RE_COMBINING_MARKS = /\p{M}+/gu;
const RE_NOT_WORD = /[^\p{L}\p{N}]+/u;
const UNSEGMENTED_SCRIPTS = ['Han', 'Hiragana', 'Katakana', 'Thai', 'Lao', 'Khmer', 'Myanmar'];
const RE_UNSEGMENTED_SCRIPT = new RegExp(
  `[${UNSEGMENTED_SCRIPTS.map((script) => `\\p{Script=${script}}`).join('')}]`, 'u',
);

export function buildSettingsSearchIndex(lang: LangFn, flags: SettingsSearchFlags) {
  const sectionByScreen = new Map<SettingsScreens, SettingsSearchSection>();
  SETTINGS_SEARCH_SECTIONS.forEach((section) => {
    sectionByScreen.set(section.screen, section);
    if (section.screenWhen) sectionByScreen.set(section.screenWhen.screen, section);
  });

  function getChain(screen: SettingsScreens) {
    const chain: SettingsSearchSection[] = [];
    let section = sectionByScreen.get(screen);
    while (section) {
      chain.unshift(section);
      section = sectionByScreen.get(section.parent);
    }
    return chain;
  }

  function buildPath(chain: SettingsSearchSection[]) {
    return chain.map(({ titleKey }) => lang(titleKey)).join(PATH_SEPARATOR);
  }

  function buildKeywordWords(keywordsKey?: SettingsSearchSection['keywordsKey']) {
    if (!keywordsKey) return [];
    return lang(keywordsKey).split(KEYWORDS_SEPARATOR).flatMap(splitWords);
  }

  const items: SettingsSearchItem[] = [];
  const sectionLabelsByScreen = new Map<SettingsScreens, Set<string>>();

  function addSectionLabel(screen: SettingsScreens, label: string) {
    const labels = sectionLabelsByScreen.get(screen);
    if (labels) {
      labels.add(label);
    } else {
      sectionLabelsByScreen.set(screen, new Set([label]));
    }
  }

  SETTINGS_SEARCH_SECTIONS.forEach((section) => {
    const chain = getChain(section.screen);
    if (chain.some(({ requires }) => requires && !flags[requires])) return;

    const title = lang(section.titleKey);
    const variantWords = [splitWords(title)];
    if (section.aliasKey) variantWords.push(splitWords(lang(section.aliasKey)));
    const titleVariants = variantWords.map((words) => words.join(WORDS_SEPARATOR));

    titleVariants.forEach((label) => {
      addSectionLabel(section.parent, label);
      addSectionLabel(section.screen, label);
      if (section.screenWhen) addSectionLabel(section.screenWhen.screen, label);
    });

    const topSection = chain[0];
    items.push({
      id: SettingsScreens[section.screen],
      screen: section.screenWhen && flags[section.screenWhen.flag] ? section.screenWhen.screen : section.screen,
      title,
      path: buildPath(chain.slice(0, -1)),
      depth: chain.length,
      categoryScreen: topSection.screen,
      icon: topSection.icon,
      iconBg: topSection.iconBg,
      link: getSettingsLink(section.screen),
      isSection: true,
      titleVariants,
      titleWords: variantWords.flat(),
      keywordWords: buildKeywordWords(section.keywordsKey),
    });
  });

  SETTINGS_SEARCH_ENTRIES.forEach((entry) => {
    if (entry.requires && !flags[entry.requires]) return;

    const chain = getChain(entry.screen);
    if (chain.some(({ requires }) => requires && !flags[requires])) return;

    const title = lang(entry.titleKey);
    const titleWords = splitWords(title);
    const normalizedTitle = titleWords.join(WORDS_SEPARATOR);
    if (!normalizedTitle || sectionLabelsByScreen.get(entry.screen)?.has(normalizedTitle)) return;

    const topSection = chain.length ? chain[0] : undefined;
    const section = chain.length ? chain[chain.length - 1] : undefined;
    items.push({
      id: `${SettingsScreens[entry.screen]}/${entry.titleKey}`,
      screen: entry.screen,
      title,
      path: buildPath(chain),
      depth: chain.length,
      categoryScreen: topSection?.screen,
      icon: topSection ? topSection.icon : entry.icon,
      iconBg: topSection ? topSection.iconBg : entry.iconBg,
      highlight: { langKey: entry.titleKey, isInHeaderMenu: entry.isInHeaderMenu },
      link: getSettingsLink(entry.screen, entry.titleKey) || (section && getSettingsLink(section.screen)),
      titleVariants: [normalizedTitle],
      titleWords,
      keywordWords: buildKeywordWords(entry.keywordsKey),
    });
  });

  return items;
}

export function searchSettings(index: SettingsSearchItem[], query: string) {
  const queryWords = splitWords(query);
  if (!queryWords.length) return [];

  const normalizedQuery = queryWords.join(WORDS_SEPARATOR);
  const wordMatchers = queryWords.map((queryWord) => (
    RE_UNSEGMENTED_SCRIPT.test(queryWord)
      ? (word: string) => word.includes(queryWord)
      : (word: string) => word.startsWith(queryWord)
  ));

  const matches = index.reduce<{ item: SettingsSearchItem; score: number }[]>((acc, item) => {
    let hasKeywordMatch = false;
    const isMatch = wordMatchers.every((matchesWord) => {
      if (item.titleWords.some(matchesWord)) return true;
      if (!item.keywordWords.some(matchesWord)) return false;
      hasKeywordMatch = true;
      return true;
    });
    if (!isMatch) return acc;

    const score = hasKeywordMatch ? SCORE_KEYWORDS
      : item.titleVariants.some((variant) => variant.startsWith(normalizedQuery))
        ? SCORE_TITLE_START : SCORE_TITLE;
    acc.push({ item, score });
    return acc;
  }, []);

  matches.sort((a, b) => (
    a.score - b.score
    || Number(!a.item.isSection) - Number(!b.item.isSection)
    || a.item.depth - b.item.depth
    || a.item.title.localeCompare(b.item.title)
  ));

  const groups = new Map<SettingsScreens | undefined, SettingsSearchItem[]>();
  matches.forEach(({ item }) => {
    const group = groups.get(item.categoryScreen);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.categoryScreen, [item]);
    }
  });

  return Array.from(groups.values()).flatMap((group) => [
    ...group.filter(({ isSection }) => isSection),
    ...group.filter(({ isSection }) => !isSection),
  ]);
}

function splitWords(text: string) {
  return text.toLowerCase().normalize('NFD').replace(RE_COMBINING_MARKS, '').split(RE_NOT_WORD).filter(Boolean);
}
