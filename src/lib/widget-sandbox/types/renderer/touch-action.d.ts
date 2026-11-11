/** The custom property that keeps the widget's own `touch-action` next to the engine's (it inherits, so an ancestor's value reaches its descendants, as `claimOf` reads the chain). */
export declare const TOUCH_ACTION_CLAIM = "--tw-touch-action";
/**
 * The `touch-action` the engine gets for the widget's `value`: vertical panning in both directions is always allowed.
 * `auto`, `manipulation`, the CSS-wide keywords and a value with `pan-y` stay; `none` becomes `pan-y`; `pan-up` and
 * `pan-down` become `pan-y`; any other value gains `pan-y` (`pan-x` → `pan-x pan-y`, `pinch-zoom` → `pinch-zoom pan-y`).
 */
export declare function engineTouchAction(value: string): string;
