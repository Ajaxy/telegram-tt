export declare class DOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
    get top(): number;
    get left(): number;
    get right(): number;
    get bottom(): number;
    toJSON(): {
        x: number;
        y: number;
        width: number;
        height: number;
        top: number;
        left: number;
        right: number;
        bottom: number;
    };
    static fromRect(r?: any): DOMRect;
}
export declare class DOMPoint {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    matrixTransform(m: DOMMatrix): DOMPoint;
}
/** 2D-only DOMMatrix (enough for d3-interpolate, d3-zoom and SVG CTMs). */
export declare class DOMMatrix {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    constructor(init?: any);
    get m11(): number;
    get m12(): number;
    get m21(): number;
    get m22(): number;
    get m41(): number;
    get m42(): number;
    get is2D(): boolean;
    get isIdentity(): boolean;
    multiply(o: any): DOMMatrix;
    inverse(): DOMMatrix;
    translate(x?: number, y?: number): DOMMatrix;
    scale(x?: number, y?: number): DOMMatrix;
    rotate(deg?: number): DOMMatrix;
    transformPoint(p?: any): DOMPoint;
    toString(): string;
}
/** Parse an SVG / CSS 2D transform list into matrix components. */
export declare function parseTransform(text: string): {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};
/** Query about an element; detached / unknown elements get `fallback` without a round trip. */
export declare function elQuery(el: any, q: Record<string, unknown>, fallback: any): any;
export declare function getComputedStyle(el: any, pseudo?: string | null): any;
export declare function installLayout(ElementProto: any, HTMLElementProto: any, SVGElementProto: any, pushProp: (el: any, name: string, value: number) => void): void;
export declare function elementFromPoint(x: number, y: number): any;
