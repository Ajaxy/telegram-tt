export declare function cssPropertyInProfile(name: string): boolean;
export declare const cssFunctionInProfile: (name: string) => boolean;
export declare const cssUnitInProfile: (unit: string) => boolean;
export declare const cssPseudoClassInProfile: (name: string) => boolean;
export declare const cssPseudoElementInProfile: (name: string) => boolean;
export declare const isGenericFont: (name: string) => boolean;
/** The family part of a `font` shorthand: everything after the size (and `/ line-height`), or null when there is none. */
export declare function fontShorthandFamilyStart<T>(items: T[], kind: (t: T) => {
    size: boolean;
    slash: boolean;
}): number;
/** `CSS.supports(property, value)`: would the validator keep `property: value` as written? */
export declare function supportsDeclaration(property: string, value: string): boolean;
/** `CSS.supports('selector(…)')`: every pseudo-class and pseudo-element in the profile, no nesting selector. */
export declare function supportsSelector(selector: string): boolean;
/**
 * A `@supports` condition / `CSS.supports(conditionText)`: `not`, `and`, `or`,
 * parentheses, `(property: value)`, `selector(…)`. Anything else (font-tech(),
 * font-format(), unknown functions, general enclosed) is false.
 */
export declare function supportsCondition(text: string): boolean;
/** `CSS.supports(a)` / `CSS.supports(a, b)`. */
export declare function cssSupports(...args: unknown[]): boolean;
