/** Movement (CSS px, from the pointerdown) below which a press is still a tap or a hold. */
export declare const TOUCH_SLOP_PX = 10;
/** A touch held this long within the slop is a hold: the bubble's message menu, or the widget's on `none`. */
export declare const HOLD_MS = 500;
/** A second tap whose pointerdown comes at most this long after the first tap's pointerup is a double tap. */
export declare const DOUBLE_TAP_MS = 300;
/** ... and lands at most this far (CSS px) from the first tap's pointerdown. */
export declare const DOUBLE_TAP_SLOP_PX = 40;
/** Presses that start this close (CSS px) to the widget's leading edge take no claim: the system back gesture starts there. */
export declare const EDGE_STRIP_PX = 20;
/** What the widget takes of a press beyond its taps and double taps, from `touch-action` (and a learned `preventDefault` on pointerdown). */
export interface GestureClaim {
    /** Horizontal drags (no swipe-to-reply or back). */
    x: boolean;
    /**
     * Always false since v0.1.3: vertical drags are the chat's (the list scrolls), and
     * the arbiter ignores it. Kept so that code written for v0.1.2 still builds.
     */
    y: boolean;
    /** Holds, and a right click with a mouse: no message menu; the widget gets `contextmenu`. */
    hold: boolean;
}
export declare const NO_CLAIM: GestureClaim;
/**
 * The claim of a press from the computed `touch-action` of the target and of each
 * ancestor up to the root (the widget's `<html>`) included, target first, and whether the widget
 * prevented pointerdown on the target before. `none` anywhere claims horizontal
 * drags and holds; a value without a horizontal pan (`pan-x`, `pan-left`,
 * `pan-right`) claims `x`; `auto` and `manipulation` claim nothing, and so does a
 * value with a horizontal pan (`pan-x`: vertical drags cannot be claimed). A
 * prevented pointerdown claims `x`, never holds: only `touch-action: none` does.
 * `y` is always false.
 */
export declare function claimOf(touchActions: readonly string[], prevented?: boolean): GestureClaim;
/** `mouse` has no holds, no swipes and no edge strip; `touch` and `pen` have all of them. */
export type PointerKind = 'touch' | 'pen' | 'mouse';
/**
 * What a press is so far: `press` (undecided), `tap`, `double-tap` (the second tap),
 * `hold`, `drag-x` / `drag-y` (past the slop, by the dominant axis), `menu-click`
 * (the secondary mouse button).
 */
export type Gesture = 'press' | 'tap' | 'double-tap' | 'hold' | 'drag-x' | 'drag-y' | 'menu-click';
/** What the bubble does with a press it takes (a double tap over the widget never is the bubble's: no reaction). */
export type BubbleAction = 'menu' | 'swipe' | 'scroll' | 'back';
export interface GestureVerdict {
    owner: 'pending' | 'widget' | 'bubble';
    gesture: Gesture;
    /**
     * Once, in the verdict where the bubble takes a press the widget has had since its
     * pointerdown: end it for the widget now, `pointercancel` and nothing more of this
     * pointer (no pointerup, no click).
     */
    cancel: boolean;
    /** Owner `bubble`: what the bubble does with the press. */
    action?: BubbleAction;
    /** Once, at a double tap and when the widget wins a hold: deliver this event after the press's own events. */
    event?: 'dblclick' | 'contextmenu';
    /** The press started in the leading edge strip, where the widget's claim does not apply. */
    edge?: true;
}
/**
 * One pointer's presses over one widget, in order. `x` is measured from the
 * widget's leading edge (the left one in a left-to-right UI, the right one in a
 * right-to-left UI: pass `width - x` there), `y` from its top, CSS px; `t` in ms on
 * one clock. Calls with a `t` past the hold deadline decide the hold first, so a
 * late `tick` changes nothing.
 */
export declare class GestureArbiter {
    private press;
    private lastTap;
    /** A primary pointerdown. `button` 2 with a mouse is the secondary click. A press still open is replaced. */
    down(t: number, x: number, y: number, claim: GestureClaim, pointer?: PointerKind, button?: number): GestureVerdict;
    /** A move of the press's pointer. Null when no press is open. */
    move(t: number, x: number, y: number): GestureVerdict | null;
    /** The hold timer: call it at `holdDeadline()`. Null when no press is open. */
    tick(t: number): GestureVerdict | null;
    /** The pointerup. A press still undecided is a tap, or the second tap of a double tap. Null when no press is open. */
    up(t: number, x: number, y: number): GestureVerdict | null;
    /** The platform cancelled the press (a scroll, the client's own recognizer): it is over, and no double tap continues it. */
    cancel(): void;
    /** When `tick` may turn the open press into a hold, or null. */
    holdDeadline(): number | null;
    private holdFirst;
    private decide;
    private verdict;
}
