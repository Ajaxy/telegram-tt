export type Diag = (kind: string, detail: string) => void;
/**
 * The host decides the colour scheme (the chat theme), not the renderer's OS
 * setting: `prefers-color-scheme` media queries, `color-scheme: light dark`
 * and `light-dark()` are evaluated here against it.
 */
export interface CssEnv {
    colorScheme: 'light' | 'dark';
    nativeScrolling?: boolean;
    /**
     * 'shadow': the renderer is a shadow root in the host page (ShadowDomRenderer
     * prototype), not a document of its own. Selectors that would reach the host
     * (`:host`, `:host-context`, `::slotted`, `::part`, `:scope`) are dropped,
     * `:root` becomes the renderer's `[data-tw-root]`, width/height media queries
     * become `@container tw` queries on the bubble and viewport units become
     * container units. Default: 'document' (iframe, native WebViews), untouched.
     */
    scope?: 'document' | 'shadow';
    /**
     * Strict policy: `attr()` may only read attributes the validator's text budgets
     * count (`isTextAttr`), so no other attribute can become visible text.
     */
    strict?: boolean;
    /** The client's answer to `prefers-reduced-motion` (the OS setting); default: no preference. */
    reducedMotion?: boolean;
}
export declare const DEFAULT_ENV: CssEnv;
/**
 * Attributes whose values count against the strict text budgets: the ones a
 * renderer draws as text, plus `data-*` and `aria-*`, which `attr()` may read.
 */
export declare function isTextAttr(name: string): boolean;
export declare const TEXT_ATTRS: string[];
export declare const TEXT_ATTR_PREFIXES: string[];
/**
 * The contents of the string tokens in sanitized CSS: what `content`, `quotes`,
 * `list-style` or a custom property substituted into them can draw. The input is
 * this sanitizer's output, so escapes are already decoded except `\"` and `\\`.
 * NativeValidator.cssStringText is the same loop over UTF-16 units.
 */
export declare function cssStringText(css: string): string;
/** A font-family list or `font` shorthand outside a stylesheet (SVG `font-family`, canvas `font`, measureText): the same reduction. */
export declare function sanitizeFontValue(prop: 'font' | 'font-family', value: string, diag: Diag): string | null;
/**
 * Shadow scope: a media query list that only asks about the viewport's size
 * (what the iframe's viewport was: the bubble) as a container query on the
 * bubble, e.g. `screen and (max-width: 480px), (orientation: portrait)` →
 * `tw (max-width: 480px) or (orientation: portrait)`. Null when it asks
 * anything else (hover, pointer, print, resolution…): left as a media query.
 */
export declare function mediaToContainer(text: string): string | null;
/**
 * A `mediaToContainer` query on a box of `width` × `height`, as `@container tw` answers it: what matchMedia gives a
 * widget in the shadow scope (local patch, NOTICE.md). A feature it cannot read (a unit other than px or em) does not match.
 */
export declare function containerMatches(container: string, width: number, height: number): boolean;
/**
 * Does a media query list ask only what the profile answers: the media types
 * `all` and `screen`, the bubble's width and orientation, and the two
 * preferences the client answers? (No height: the bubble's height comes from
 * the content; no hover, pointer, print, resolution…)
 */
export declare function mediaInProfile(text: string): boolean;
/**
 * Evaluate the preferences in a media query list against the client's answers
 * (the chat theme, the OS reduced-motion setting); a query outside the profile
 * never matches.
 */
export declare function rewriteMediaQuery(text: string, env: CssEnv): string;
export declare function clearStylesheetCache(): void;
export declare function sanitizeStylesheet(css: string, diag: Diag, env?: CssEnv): string;
/** Sanitize the value of a style="" attribute. */
export declare function sanitizeStyleAttribute(css: string, diag: Diag, env?: CssEnv): string;
/** Tests and benchmarks only: false sends every style op through css-tree (the reference the fast path is checked against). */
export declare function setCssFastPath(on: boolean): void;
/**
 * The fast path of `sanitizeStyleProperty` (see above): the clean value of a simple declaration, exactly as the full
 * path would return it with no diagnostic, or undefined when the full path has to decide (an empty value included).
 */
export declare function fastStyleValue(name: string, value: string): string | undefined;
/** Sanitize a single property set via CSSOM. Returns null if it must be dropped. */
export declare function sanitizeStyleProperty(name: string, value: string, diag: Diag, env?: CssEnv): {
    name: string;
    value: string;
} | null;
/** `sanitizeStyleProperty` through css-tree alone (the reference of the fast path). */
export declare function sanitizeStylePropertyFull(name: string, value: string, diag: Diag, env?: CssEnv): {
    name: string;
    value: string;
} | null;
/**
 * Sanitize a free-standing CSS value, e.g. an SVG presentation attribute
 * (fill="url(#g)") or a canvas `filter`. Returns null if it must be dropped.
 */
export declare function sanitizeCssValue(value: string, diag: Diag, where?: string, env?: CssEnv): string | null;
