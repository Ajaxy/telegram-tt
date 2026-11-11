/** A privileged call must reach the host this soon after its gesture was issued. */
export declare const GESTURE_TTL_MS = 5000;
type GestureEvent = {
    type?: unknown;
    detail?: unknown;
};
/** A pointer press or release, or a click with a click count. Keys never count. */
export declare function isUserActivation(ev: GestureEvent): boolean;
/**
 * One physical pointer press (pointerdown … click / dblclick) is one gesture.
 * A click without a click count (`detail` 0: what Enter or Space on a focused
 * control produces) is a gesture only as the end of a press already open.
 */
export declare class GestureCounter {
    private n;
    private pressOpen;
    private lastType;
    /** The gesture number for this event, 0 when it is not a user activation. */
    gestureFor(ev: GestureEvent): number;
    /**
     * A primary press began: the renderer's `gesture` claim, sent for every one, whether the widget listens or not, and
     * before the press's own events. What follows is a new gesture, not the end of an open one: a finger's pointerdown is
     * not `trusted` (it may become the chat's scroll), so without this its release continued a press that had ended
     * without a click (a drag), whose gesture was spent.
     */
    pressBegan(): void;
}
/** Host side: gestures handed to the worker, and the last one a privileged call consumed. */
export declare class HostActivationGate {
    private issued;
    private consumed;
    issue(gesture: number, now: number): void;
    /** True once per issued gesture, while the widget is visible and the gesture is recent. */
    accept(gesture: unknown, now: number, visible: boolean): boolean;
    /** What `accept` would say, without consuming the gesture (a request consumes it only when it goes out as a press's). */
    available(gesture: unknown, now: number, visible: boolean): boolean;
}
export {};
