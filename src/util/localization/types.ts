import type { TeactNode } from '../../lib/teact/teact';

import type {
  ApiLanguage,
  LangPackStringValue,
  LangPackStringValueDeleted,
  LangPackStringValuePlural,
  LangPackStringValueRegular,
} from '../../api/types';
import type { TextFilter } from '../../components/common/helpers/renderText';
import type { TimeFormat } from '../../types';
import type {
  LangKey,
  LangKeyGroups,
  LangPairPluralWithVariables,
  LangPairWithVariables,
  LangPluralKeyGroups,
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

// A separate generic alias defers resolving nested parameters, which would otherwise be circular
type LangFnVariables<V extends string, R = LangVariable | RegularLangFnParameters> = Record<V, R>;

type LangFnGroupedVariables<G, R> = [R] extends [never]
  ? LangFnVariables<G & string>
  : LangFnVariables<G & string, R>;

// Each key occurs once per rendering mode, keeping TypeScript's discriminant lookup available.
// Combining the modes repeats keys and loses that lookup, as does adding `variables?: undefined`.
type LangFnParametersUnion<
  O,
  P,
  R = never,
> =
  | { key: RegularLangKey; options?: O }
  | { key: PluralLangKey; options: P }
  | {
    [G in keyof LangKeyGroups]: {
      key: LangKeyGroups[G]['keys'];
      variables: LangFnGroupedVariables<LangKeyGroups[G]['variables'], R>;
      options?: O;
    };
  }[keyof LangKeyGroups]
  | {
    [G in keyof LangPluralKeyGroups]: {
      key: LangPluralKeyGroups[G]['keys'];
      variables: LangFnGroupedVariables<LangPluralKeyGroups[G]['variables'], R>;
      options: P;
    };
  }[keyof LangPluralKeyGroups];

export type RegularLangFnParameters = LangFnParametersUnion<LangFnOptions, LangFnOptionsWithPlural>;
// `with` selects node rendering; stored options can omit the redundant `withNodes` flag
type StoredAdvancedLangFnOptions = Omit<AdvancedLangFnOptions, 'withNodes'> & { withNodes?: true };
export type AdvancedLangFnParameters = LangFnParametersUnion<
  StoredAdvancedLangFnOptions, StoredAdvancedLangFnOptions & { pluralValue: number },
  TeactNode | RegularLangFnParameters
>;

// Common shape of parameter objects for the implementation, which does not need per-key checks
export type LangFnParametersShape<O = StoredAdvancedLangFnOptions> = {
  key: LangKey;
  variables?: Record<string, TeactNode | LangFnParametersShape<LangFnOptions>>;
  options?: O;
};

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

  withRegular: (params: RegularLangFnParameters) => string;
  with: (params: AdvancedLangFnParameters) => TeactNode;
  region: (code: string) => string | undefined;
  currency: (code: string) => string | undefined;
  conjunction: (list: string[]) => string;
  disjunction: (list: string[]) => string;
  number: (value: number) => string;
  preciseNumber: (value: number) => string;
  timeFormat: TimeFormat;
  internalFormatters: LangFormatters;
  isRtl?: boolean;
  rawCode: string;
  code: string;
  languageInfo?: ApiLanguage;
};

// Allow basic polyfill
type ListFormat = Pick<Intl.ListFormat, 'format' | 'formatToParts'>;

export type LangFormatters = {
  pluralRules: Intl.PluralRules;
  region: Intl.DisplayNames;
  currency: Intl.DisplayNames;
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

export function areAdvancedLangFnOptions(
  params: LangFnOptions | AdvancedLangFnOptions,
): params is AdvancedLangFnOptions {
  return 'withNodes' in params && Boolean(params.withNodes);
}

// React/Teact elements are also objects and have a `key`, but they always have `type` as well
export function isLangFnParam(
  object: TeactNode | LangFnParametersShape<LangFnOptions>,
): object is LangFnParametersShape<LangFnOptions> {
  return Boolean(object) && typeof object === 'object' && 'key' in object && !('type' in object);
}
