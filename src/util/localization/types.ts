import type { TeactNode } from '../../lib/teact/teact';

import type {
  ApiLanguage,
  LangPackStringValue,
  LangPackStringValueDeleted,
  LangPackStringValuePlural,
  LangPackStringValueRegular,
} from '../../api/types';
import type { TextFilter } from '../../components/common/helpers/renderText';
import type {
  LangPairPluralWithVariables,
  LangPairWithVariables,
  LangVariable,
  PluralLangKey,
  PluralLangKeyWithVariables,
  RegularLangKey,
  RegularLangKeyWithVariables,
} from '../../types/language';

export interface LangFnOptionsRegular {
  withNodes?: never;
  withMarkdown?: never;
  pluralValue?: never;
}

export type LangFnOptionsWithPlural = Omit<LangFnOptionsRegular, 'pluralValue'> & {
  pluralValue: number;
};

export type LangFnOptions = LangFnOptionsRegular | LangFnOptionsWithPlural;

export interface AdvancedLangFnOptionsRegular {
  withNodes: true;
  withMarkdown?: boolean;
  pluralValue?: never;
  renderTextFilters?: TextFilter[];
  specialReplacement?: Record<string, TeactNode>;
}

export type AdvancedLangFnOptionsWithPlural = Omit<AdvancedLangFnOptionsRegular, 'pluralValue'> & {
  pluralValue: number;
};

export type AdvancedLangFnOptions = AdvancedLangFnOptionsRegular | AdvancedLangFnOptionsWithPlural;

type LangPairWithNodes = LangPairWithVariables<TeactNode | undefined>;
type LangPairPluralWithNodes = LangPairPluralWithVariables<TeactNode | undefined>;

// Helpers for merged overloads
type AllKeysOf<T> = T extends any ? keyof T : never;

type AnyLangOptions = LangFnOptions | AdvancedLangFnOptions;
type AnyLangPluralOptions = LangFnOptionsWithPlural | AdvancedLangFnOptionsWithPlural;

// Maps unknown option keys to `never`, catching typos even through generics
type StrictLangOptions<O> = O & Record<Exclude<keyof O & string, AllKeysOf<AnyLangOptions>>, never>;

type LangFnReturnType<O> = O extends AdvancedLangFnOptions ? TeactNode : string;

type PrepVariablesType<K extends RegularLangKeyWithVariables, O> =
  O extends AdvancedLangFnOptions
    ? LangPairWithNodes[K]
    : LangPairWithVariables[K];

type PrepPluralVariablesType<K extends PluralLangKeyWithVariables, O> =
  O extends AdvancedLangFnOptions
    ? LangPairPluralWithNodes[K]
    : LangPairPluralWithVariables[K];

type RegularLangFnParametersWithoutVariables = {
  key: RegularLangKey;
  variables?: undefined;
  options?: LangFnOptions;
};

type RegularLangFnParametersWithVariables<T = LangPairWithVariables> = {
  [K in keyof T]: {
    key: K;
    variables: {
      [key in keyof T[K]]: LangVariable | RegularLangFnParameters;
    };
    options?: LangFnOptions;
  }
}[keyof T];

type RegularLangFnPluralParameters = {
  key: PluralLangKey;
  variables?: undefined;
  options: LangFnOptionsWithPlural;
};

type RegularLangFnPluralParametersWithVariables<T = LangPairPluralWithVariables> = {
  [K in keyof T]: {
    key: K;
    variables: {
      [key in keyof T[K]]: LangVariable | RegularLangFnParameters;
    };
    options: LangFnOptionsWithPlural;
  }
}[keyof T];

export type RegularLangFnParameters =
  | RegularLangFnParametersWithoutVariables
  | RegularLangFnParametersWithVariables
  | RegularLangFnPluralParameters
  | RegularLangFnPluralParametersWithVariables;

type AdvancedLangFnParametersWithoutVariables = {
  key: RegularLangKey;
  variables?: undefined;
  options: AdvancedLangFnOptions;
};

type AdvancedLangFnParametersWithVariables<T = LangPairWithNodes> = {
  [K in keyof T]: {
    key: K;
    variables: T[K];
    options: AdvancedLangFnOptions;
  }
}[keyof T];

type AdvancedLangFnPluralParameters = {
  key: PluralLangKey;
  variables?: undefined;
  options: AdvancedLangFnOptionsWithPlural;
};

type AdvancedLangFnPluralParametersWithVariables<T = LangPairPluralWithNodes> = {
  [K in keyof T]: {
    key: K;
    variables: T[K];
    options: AdvancedLangFnOptionsWithPlural;
  }
}[keyof T];

export type AdvancedLangFnParameters =
  | AdvancedLangFnParametersWithoutVariables
  | AdvancedLangFnParametersWithVariables
  | AdvancedLangFnPluralParameters
  | AdvancedLangFnPluralParametersWithVariables;

export type LangFnParameters = RegularLangFnParameters | AdvancedLangFnParameters;

export type LangFn = {
  <K extends PluralLangKeyWithVariables, O extends AnyLangPluralOptions>(
    key: K, variables: PrepPluralVariablesType<K, O>, options: StrictLangOptions<O>,
  ): LangFnReturnType<O>;
  <K extends RegularLangKeyWithVariables, O extends AnyLangOptions = LangFnOptionsRegular>(
    key: K, variables: PrepVariablesType<K, O>, options?: StrictLangOptions<O>,
  ): LangFnReturnType<O>;
  <K extends PluralLangKey, O extends AnyLangPluralOptions>(
    key: K, variables: undefined, options: StrictLangOptions<O>,
  ): LangFnReturnType<O>;
  <K extends RegularLangKey, O extends AnyLangOptions = LangFnOptionsRegular>(
    key: K, variables?: undefined, options?: StrictLangOptions<O>,
  ): LangFnReturnType<O>;

  with: (params: LangFnParameters) => TeactNode;
  withRegular: (params: RegularLangFnParameters) => string;
  withAdvanced: (params: AdvancedLangFnParameters) => TeactNode;
  region: (code: string) => string | undefined;
  conjunction: (list: string[]) => string;
  disjunction: (list: string[]) => string;
  number: (value: number) => string;
  preciseNumber: (value: number) => string;
  internalFormatters: LangFormatters;
  isRtl?: boolean;
  rawCode: string;
  code: string;
  languageInfo: ApiLanguage;
};

// Allow basic polyfill
type ListFormat = Pick<Intl.ListFormat, 'format' | 'formatToParts'>;

export type LangFormatters = {
  pluralRules: Intl.PluralRules;
  region: Intl.DisplayNames;
  conjunction: ListFormat;
  disjunction: ListFormat;
  number: Intl.NumberFormat;
  preciseNumber: Intl.NumberFormat;
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
  return 'withNodes' in params && Boolean(params.withNodes);
}
