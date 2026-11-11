/**
 * Elements that are never rendered, together with their whole subtree, whatever
 * the profile says. (`style` is not here: it is handled separately through the
 * CSS sanitizer.) `audio`/`video`/`source`/`track` are dropped on purpose: a chat
 * bubble has no use for media playback, and `data:` media would hand the
 * platform's codec stack to the widget (and autoplay / battery).
 */
export declare const SECURITY_DROPPED_TAGS: Set<string>;
/** HTML elements rendered as-is. */
export declare const HTML_TAGS: Set<string>;
/** HTML elements outside the profile that keep their content: rendered as this element, with `data-tg-tag` naming the original. */
export declare const REPLACED_TAGS: Map<string, string>;
/** Elements dropped with their subtree: the security list and the profile's (form controls). */
export declare const DROPPED_TAGS: Set<string>;
/** Canonical (case-sensitive) names of allowed SVG elements, keyed by lowercase. */
export declare const SVG_TAGS: Map<string, string>;
/** HTML attributes allowed on any element (lowercase); `data-*`, `aria-*` and `style` are handled apart. */
export declare const HTML_ATTRS: Set<string>;
export declare const SVG_ALLOWED_ATTRS: Set<string>;
/** Every attribute allowed in either namespace. */
export declare const ALLOWED_ATTRS: Set<string>;
/** lowercase → canonical case for SVG attributes (HTML-parser style adjustment). */
export declare const SVG_ATTR_CASE: Map<string, string>;
/**
 * Every attribute that can carry a URL. None of these is ever passed through
 * unchecked; unlisted (tag, attr) combinations are dropped. See validator.ts.
 */
export declare const URL_ATTRS: Set<string>;
/** Attributes whose value is CSS and may contain url(): parsed by the CSS sanitizer. */
export declare const CSS_VALUE_ATTRS: Set<string>;
/** Attribute names an SVG animation element may target. URL-like ones are excluded. */
export declare const ANIMATION_VALUE_ATTRS: Set<string>;
/** Attributes dropped silently (noise, not worth a diagnostic). */
export declare const SILENT_DROP_ATTRS: Set<string>;
export declare const PROPS: Record<string, {
    type: "string" | "number" | "boolean";
    tags: Set<string> | null;
}>;
export declare const METHODS: Record<string, number>;
/** Canvas 2D: methods that may be replayed (the profile's). Nothing here takes a URL. */
export declare const CANVAS_METHODS: Set<string>;
/** Canvas 2D: settable properties (the profile's). */
export declare const CANVAS_PROPS: Set<string>;
/** Canvas 2D calls and properties the shim may send that are outside the profile: dropped with a `profile` diagnostic, not a protocol violation. */
export declare const CANVAS_OUT_OF_PROFILE: Set<string>;
/** Gradient kinds in the profile; a conic gradient or a pattern becomes a gradient that paints nothing. */
export declare const CANVAS_GRADIENTS: Set<string>;
export declare const CANVAS_PATH_METHODS: Set<string>;
export declare const SVG_QUERY_METHODS: Set<string>;
export declare const CANVAS_QUERY_METHODS: Set<string>;
