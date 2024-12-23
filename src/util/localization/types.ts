import type { TeactNode } from '../../lib/teact/teact';

import type {
  LangPackStringValue,
  LangPackStringValueDeleted,
  LangPackStringValuePlural,
  LangPackStringValueRegular,
} from '../../api/types';
import type { TextFilter } from '../../components/common/helpers/renderText';
import type {
  LangPairPluralWithVariables,
  LangPairWithVariables,
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

type RegularLangFnParametersWithoutVariables = {
  key: RegularLangKey;
  variables?: undefined;
  options?: LangFnOptions;
};

type RegularLangFnParametersWithVariables<T = LangPairWithVariables> = {
  [K in keyof T]: {
    key: K;
    variables: T[K];
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
    variables: T[K];
    options: LangFnOptionsWithPlural;
  }
}[keyof T];

type RegularLangFnParameters =
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

type AdvancedLangFnParameters =
| AdvancedLangFnParametersWithoutVariables
| AdvancedLangFnParametersWithVariables
| AdvancedLangFnPluralParameters
| AdvancedLangFnPluralParametersWithVariables;

export type LangFnParameters = RegularLangFnParameters | AdvancedLangFnParameters;

export type LangFn = {
  <K extends RegularLangKey = RegularLangKey>(
    key: K, variables?: undefined, options?: LangFnOptions,
  ): string;
  <K extends PluralLangKey = PluralLangKey>(
    key: K, variables: undefined, options: LangFnOptionsWithPlural,
  ): string;
  <K extends RegularLangKeyWithVariables = RegularLangKeyWithVariables, V = LangPairWithVariables[K]>(
    key: K, variables: V, options?: LangFnOptions,
  ): string;
  <K extends PluralLangKeyWithVariables = PluralLangKeyWithVariables, V = LangPairPluralWithVariables[K]>(
    key: K, variables: V, options: LangFnOptionsWithPlural,
  ): string;

  <K extends RegularLangKey = RegularLangKey>(
    key: K, variables?: undefined, options?: AdvancedLangFnOptions,
  ): TeactNode;
  <K extends PluralLangKey = PluralLangKey>(
    key: K, variables: undefined, options: AdvancedLangFnOptionsWithPlural,
  ): TeactNode;
  <K extends RegularLangKeyWithVariables = RegularLangKeyWithVariables, V = LangPairWithVariables[K]>(
    key: K, variables: V, options: AdvancedLangFnOptions,
  ): TeactNode;
  <K extends PluralLangKeyWithVariables = PluralLangKeyWithVariables, V = LangPairPluralWithVariables[K]>(
    key: K, variables: V, options: AdvancedLangFnOptionsWithPlural,
  ): TeactNode;

  with: (params: LangFnParameters) => TeactNode;
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
  return 'withNodes' in params && Boolean(params.withNodes);
}
