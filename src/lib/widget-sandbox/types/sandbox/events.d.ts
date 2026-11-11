export declare function setEventRoots(window: any, document: any): void;
export declare function setErrorReporter(fn: (e: unknown) => void): void;
export declare function noteInterest(type: string): void;
export declare function flushInterest(): void;
export declare class Event {
    static NONE: number;
    static CAPTURING_PHASE: number;
    static AT_TARGET: number;
    static BUBBLING_PHASE: number;
    NONE: number;
    CAPTURING_PHASE: number;
    AT_TARGET: number;
    BUBBLING_PHASE: number;
    type: string;
    bubbles: boolean;
    cancelable: boolean;
    composed: boolean;
    target: any;
    srcElement: any;
    currentTarget: any;
    eventPhase: number;
    defaultPrevented: boolean;
    isTrusted: boolean;
    timeStamp: number;
    _stop: boolean;
    _stopNow: boolean;
    _path: any[];
    _dispatching: boolean;
    constructor(type: string, init?: any);
    preventDefault(): void;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
    composedPath(): any[];
    get cancelBubble(): boolean;
    set cancelBubble(v: boolean);
    get returnValue(): boolean;
    set returnValue(v: boolean);
    initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void;
}
export declare class CustomEvent extends Event {
    detail: any;
    constructor(type: string, init?: any);
    initCustomEvent(type: string, bubbles?: boolean, cancelable?: boolean, detail?: any): void;
}
export declare class UIEvent extends Event {
    view: any;
    detail: number;
    constructor(type: string, init?: any);
}
export declare class MouseEvent extends UIEvent {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    relatedTarget: any;
    [k: string]: any;
    constructor(type: string, init?: any);
    get x(): any;
    get y(): any;
    get layerX(): any;
    get layerY(): any;
    get which(): any;
    getModifierState(key: string): boolean;
}
export declare class PointerEvent extends MouseEvent {
    constructor(type: string, init?: any);
    getCoalescedEvents(): this[];
}
export declare class WheelEvent extends MouseEvent {
    constructor(type: string, init?: any);
}
export declare class KeyboardEvent extends UIEvent {
    [k: string]: any;
    constructor(type: string, init?: any);
    getModifierState(key: string): boolean;
}
export declare class InputEvent extends UIEvent {
    data: string | null;
    inputType: string;
    isComposing: boolean;
    constructor(type: string, init?: any);
}
export declare class FocusEvent extends UIEvent {
    relatedTarget: any;
    constructor(type: string, init?: any);
}
export declare class TouchEvent extends UIEvent {
    [k: string]: any;
    constructor(type: string, init?: any);
}
export declare class SubmitEvent extends Event {
    submitter: any;
    constructor(type: string, init?: any);
}
export declare class ErrorEvent extends Event {
    [k: string]: any;
    constructor(type: string, init?: any);
}
export declare class AnimationEvent extends Event {
    animationName: string;
    elapsedTime: number;
    constructor(type: string, init?: any);
}
export declare class TransitionEvent extends Event {
    propertyName: string;
    elapsedTime: number;
    constructor(type: string, init?: any);
}
export declare function addEventListener(this: any, type: string, fn: any, options?: any): void;
export declare function removeEventListener(this: any, type: string, fn: any, options?: any): void;
export declare function dispatchEvent(this: any, event: Event): boolean;
/** Install addEventListener & friends plus on<event> accessors on a prototype or object. */
export declare function installEventTarget(obj: any): void;
/** Standalone EventTarget (for `new EventTarget()` and internal objects such as MediaQueryList). */
export declare class EventTarget {
    addEventListener(type: string, fn: any, options?: any): void;
    removeEventListener(type: string, fn: any, options?: any): void;
    dispatchEvent(event: Event): boolean;
}
/** Build the right Event subclass for an event forwarded by the renderer. */
export declare function eventFromHost(ev: any, lookup: (id: number) => any): Event;
