export declare function setCanvasLimits(strict: boolean): void;
export declare function setCanvasRectFast(on: boolean): void;
export declare function enableCanvasWords(on: boolean): void;
/** capture hook: append one `canvas` op per canvas with buffered commands. */
export declare function flushCanvases(push: (op: any) => void): void;
declare class CanvasGradient {
    _id: number;
    /** The command that makes it and its color stops, and the canvases it is made on (local patch, NOTICE.md). */
    _create: any[];
    _stops: any[][];
    _canvases: any[];
    constructor(canvas: any);
    addColorStop(offset: number, color: string): void;
}
declare class CanvasPattern {
    _id: number;
    _create: any[];
    _stops: any[][];
    _canvases: any[];
    constructor(canvas: any);
    setTransform(): void;
}
export declare class Path2D {
    _id: number;
    _d: string | null;
    _cmds: any[][];
    _sent: WeakMap<object, number>;
    constructor(init?: any);
    addPath(p: Path2D): void;
    /** Make sure the renderer-side Path2D for `canvas` is up to date. */
    _materialize(canvas: any): void;
}
export declare class ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    colorSpace: string;
    constructor(a: any, b: number, c?: number);
}
export declare class Context2D {
    canvas: any;
    _s: Record<string, any>;
    _stack: any[];
    _dash: number[];
    [k: string]: any;
    constructor(canvas: any);
    _enc(a: any): any;
    _push(cmd: any[]): void;
    setLineDash(d: number[]): void;
    getLineDash(): number[];
    createLinearGradient(...a: number[]): CanvasGradient;
    createRadialGradient(...a: number[]): CanvasGradient;
    createConicGradient(...a: number[]): CanvasGradient;
    _gradient(type: string, a: number[]): CanvasGradient;
    createPattern(image: any, repetition: string): CanvasPattern;
    measureText(text: string): any;
    /** Pixel read-back is outside the widget profile: transparent pixels. */
    getImageData(_x: number, _y: number, w: number, h: number): ImageData;
    createImageData(w: any, h?: number): ImageData;
    putImageData(img: ImageData, x: number, y: number, ...rest: number[]): void;
    _call(method: string, args: any[]): any;
    isPointInPath(...a: any[]): boolean;
    isPointInStroke(...a: any[]): boolean;
    getTransform(): any;
    getContextAttributes(): {
        alpha: boolean;
        colorSpace: string;
        desynchronized: boolean;
        willReadFrequently: boolean;
    };
    drawFocusIfNeeded(): void;
}
export declare function installCanvas(canvasProto: any): void;
export {};
