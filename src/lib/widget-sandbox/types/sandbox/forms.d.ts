export declare function pointerEventTarget(target: any, event: any): any;
export declare function finishPointerEvent(event: any): void;
/** capture hook: emit `prop` ops for properties scripts have set. */
export declare function emitProps(el: any, id: number, push: (op: any) => void, isNew: boolean): void;
export declare function activateFormControl(target: any): void;
/** Update the mirror from a renderer event (no ops are generated). */
export declare function applyEventState(el: any, ev: any): void;
/** Is a checkbox/radio currently checked (mirror or default attribute)? */
export declare function isChecked(el: any): boolean;
export declare function controlValue(el: any): string;
export declare class FormData {
    _e: [string, any][];
    constructor(form?: any);
    append(k: string, v: any): void;
    set(k: string, v: any): void;
    delete(k: string): void;
    get(k: string): any;
    getAll(k: string): any[];
    has(k: string): boolean;
    forEach(cb: (v: any, k: string, fd: FormData) => void): void;
    entries(): ArrayIterator<any[]>;
    keys(): ArrayIterator<string>;
    values(): ArrayIterator<any>;
    [Symbol.iterator](): ArrayIterator<any[]>;
}
export declare function installForms(protoOf: (tagName: string) => any, HTMLElementProto: any, ElementProto: any): void;
/** Toggle state for a script-initiated el.click() on a checkbox/radio (the renderer is told via prop op). */
export declare function syntheticToggle(el: any): boolean;
