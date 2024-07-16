import type { TeactNode } from '../../lib/teact/teact';

import type {
  LangPackStringValue,
  LangPackStringValueDeleted,
  LangPackStringValuePlural,
  LangPackStringValueRegular,
} from '../../api/types';
import type { TextFilter } from '../../components/common/helpers/renderText';
import type { LangKey, LangPair } from '../../types/language';

type ReplaceTypeValues<T, R> = {
  [K in keyof T]: R;
};

export interface LangFnOptions {
  pluralValue?: number;
  withNodes?: never;
}

export interface AdvancedLangFnOptions {
  pluralValue?: number;
  withNodes: true;
  withMarkdown?: boolean;
  renderTextFilters?: TextFilter[];
  specialReplacement?: Record<string, TeactNode>;
}

type LangPairWithNodes = {
  [K in keyof LangPair]: LangPair[K] extends object ? ReplaceTypeValues<LangPair[K], TeactNode> : LangPair[K];
};

type RegularLangFnParameters<T = LangPair> = {
  [K in keyof T]: {
    key: K;
    variables: T[K];
    options?: LangFnOptions;
  }
}[keyof T];

type AdvancedLangFnParameters<T = LangPairWithNodes> = {
  [K in keyof T]: {
    key: K;
    variables: T[K];
    options: AdvancedLangFnOptions;
  }
}[keyof T];

export type LangFnParameters = RegularLangFnParameters | AdvancedLangFnParameters;

export type LangFnWithFunction = {
  (params: RegularLangFnParameters): string;
  (params: AdvancedLangFnParameters): TeactNode;
};

export type LangFn = {
  <K extends LangKey = LangKey, V extends LangPair[K] = LangPair[K]>(
    key: K, variables?: V, options?: LangFnOptions,
  ): string;
  <K extends LangKey = LangKey, V extends LangPairWithNodes[K] = LangPairWithNodes[K]>(
    key: K, variables: V, options: AdvancedLangFnOptions,
  ): TeactNode;
  with: LangFnWithFunction;
  region: (code: string) => string | undefined;
  conjunction: (list: string[]) => string;
  disjunction: (list: string[]) => string;
  number: (value: number) => string;
  isRtl?: boolean;
  code: string;
  pluralCode: string;
};

type ListFormat = Pick<Intl.ListFormat, 'format'>;

export type LangFormatters = {
  pluralRules: Intl.PluralRules;
  region: Intl.DisplayNames;
  conjunction: ListFormat;
  disjunction: ListFormat;
  number: Intl.NumberFormat;
};

/* GUARDS */

export function isDeletedLangString(string: LangPackStringValue): string is LangPackStringValueDeleted {
  return typeof string === 'object' && 'isDeleted' in string;
}

export function isRegularLangString(string: LangPackStringValue): string is LangPackStringValueRegular {
  return typeof string === 'string';
}

export function isPluralLangString(string: LangPackStringValue): string is LangPackStringValuePlural {
  return !isRegularLangString(string) && !isDeletedLangString(string);
}

export function isLangFnParam(object: unknown): object is LangFnParameters {
  return Boolean(object) && typeof object === 'object' && 'key' in object! && !('type' in object);
}

export function areAdvancedLangFnOptions(
  params: LangFnOptions | AdvancedLangFnOptions,
): params is AdvancedLangFnOptions {
  return 'withNodes' in params;
}
