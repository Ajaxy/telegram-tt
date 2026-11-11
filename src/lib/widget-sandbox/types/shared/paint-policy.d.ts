/** Heavy boxes a widget may have at once. */
export declare const PAINT_HEAVY_BOXES = 16;
/** Of them, boxes with `backdrop-filter` (it blurs whatever is under it: the most expensive effect per pixel). */
export declare const PAINT_BACKDROP_BOXES = 2;
export type PaintLimitCode = 'paint-limit' | 'backdrop-limit';
export declare const PAINT_LIMIT_CODES: readonly PaintLimitCode[];
/** The computed values a box is judged by (CSS serialisation; an empty string or a missing value is the initial one). */
export interface PaintStyle {
    display?: string;
    /** ::before / ::after only: its `content`. */
    content?: string;
    boxShadow?: string;
    filter?: string;
    backdropFilter?: string;
    opacity?: string | number;
    /**
     * The element is a `<button>` with the `disabled` attribute (`disabled`) or held down (`pressed`, `:active`): its
     * `opacity` is the button's own dimming and does not make it heavy. Absent for anything else, and ignored for a
     * pseudo-element (a button's ::before is a box of its own).
     */
    button?: 'disabled' | 'pressed';
}
/** What one box adds: to the heavy count, and to the backdrop-filter count. */
export interface BoxPaint {
    heavy: boolean;
    backdrop: boolean;
}
export interface PaintVerdict {
    code: PaintLimitCode;
    count: number;
}
/** Rule 1: whether a computed `box-shadow` has a layer with a blur radius above 0. */
export declare function boxShadowBlurred(value: string | undefined): boolean;
/** The layers of a `box-shadow` without the blurred ones ('none' when nothing is left): what a stopped widget keeps. */
export declare function boxShadowWithoutBlur(value: string | undefined): string;
/** `display: none` on an element: neither it nor anything under it builds a box. */
export declare function hidesSubtree(display: string | undefined): boolean;
/**
 * The box an element (or, with `pseudo`, its ::before / ::after) builds and what it adds, from its computed values;
 * null when it builds none (`display: none` or `contents`; a pseudo-element whose content is none / normal). Rules 1–4
 * (a disabled or pressed `<button>`'s opacity aside); a running animation (rule 5) is PaintCounter's.
 */
export declare function boxPaint(style: PaintStyle, pseudo?: boolean): BoxPaint | null;
/**
 * One keyframe as `getKeyframes()` gives it: property → value (CSS or camelCase names), with its `offset` (0–1;
 * `computedOffset` when the offset is implicit). `easing` and `composite` are no properties.
 */
export type PaintKeyframe = Record<string, unknown>;
/**
 * Rule 5: what an animation with these keyframes adds to its box while it runs; null when it changes none of
 * filter, backdrop-filter and opacity, and box-shadow only between layers without blur (every keyframe from the first
 * to the last sets it, none with a blurred layer; a value that is not a string is unknown, so blurred).
 */
export declare function animationPaint(keyframes: readonly PaintKeyframe[]): BoxPaint | null;
/** The reason a host stops the widget with (`onDead`, the diagnostics), the same on every platform. */
export declare function paintLimitMessage(code: PaintLimitCode, count: number): string;
/** A renderer's `limit` report as the host takes it: a known code and a count (a whole number from 0); null otherwise. */
export declare function checkPaintLimit(code: unknown, count: unknown): PaintVerdict | null;
/**
 * The renderer's ledger of heavy boxes, by any key it gives a box (the core uses node id × 4 + 0 / 1 / 2 for the
 * element, ::before, ::after). It keeps the two counts current as boxes change and animations start and end, and gives
 * the verdict when the renderer is about to draw: the first one past a limit sticks (the widget stops there).
 */
export declare class PaintCounter<K = number | string> {
    private boxes;
    private heavyBoxes;
    private backdropBoxes;
    private stopped;
    /** The most heavy boxes there were at once, and with backdrop-filter. */
    peakHeavy: number;
    peakBackdrop: number;
    get heavy(): number;
    get backdrop(): number;
    private contribution;
    /** Applies `change` to the box of `key` and keeps the counts in step. */
    private update;
    /** The box's computed values (`boxPaint`), or null: it builds no box now (display contents, a pseudo-element without content); its animations stay. */
    setBox(key: K, paint: BoxPaint | null): void;
    /** The box is not rendered (`display: none` on it or an ancestor), or its node left the document: its CSS animations are cancelled with it. */
    removeBox(key: K): void;
    /** An animation of rule 5 started on the box (`animationPaint` of its properties); `id` tells it from the box's others. */
    startAnimation(key: K, id: string, paint: BoxPaint): void;
    /** That animation ended or was cancelled (an end without a start, a cancel during its delay, changes nothing). */
    endAnimation(key: K, id: string): void;
    /** Whether the box of `key` has running animations under `id`. */
    animating(key: K, id: string): boolean;
    /**
     * The verdict before a frame is drawn: null while both counts are within their limits; the first time one is past
     * its limit, `paint-limit` with the heavy count (checked first) or `backdrop-limit` with the backdrop count, and the
     * same verdict from then on.
     */
    check(): PaintVerdict | null;
}
