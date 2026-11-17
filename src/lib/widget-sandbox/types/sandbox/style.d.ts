export interface Decl {
    value: string;
    important: boolean;
}
/** Split a declaration list, respecting quotes, parentheses and escapes. */
export declare function parseDeclarations(text: string): Map<string, Decl>;
export declare function serializeDeclarations(map: Map<string, Decl>): string;
export declare function toKebab(prop: string): string;
/** Style declarations written through the fast path since the last flush. */
export declare const pendingStyles: Set<StyleImpl>;
export declare function setRawAttrValueSetter(set: (attr: any, value: string) => void): void;
/** A property name the parser returns unchanged. */
export declare function canonicalKey(name: string): boolean;
/** A value that serializes and re-parses to itself: no `;`, `!`, quotes or escapes, flat balanced parentheses. */
export declare function canonicalValue(value: string): boolean;
export declare function canonicalMap(map: Map<string, Decl>): boolean;
export declare function styleImplOf(el: any): StyleImpl | undefined;
/** The host's copy of this element's style no longer comes from a fast-path record. */
export declare function forgetSentStyle(el: any): void;
export declare class StyleImpl {
    _el: any;
    _text: string | null;
    _map: Map<string, Decl>;
    /** The element's style Attr while it is owned by the element. */
    _attr: any;
    /** The property map and attribute text the host was last told, when canonical. */
    _sent: Map<string, Decl> | null;
    _sentText: string | null;
    /** Properties written through the fast path since the last flush. */
    _keys: string | Set<string> | null;
    /** The map was re-parsed from a text written some other way since the host was told. */
    _reparsed: boolean;
    constructor(el: any);
    _attrText(): string | null;
    _read(): Map<string, Decl>;
    _write(key?: string): void;
    getPropertyValue(name: string): string;
    getPropertyPriority(name: string): string;
    setProperty(name: string, value: unknown, priority?: string): void;
    removeProperty(name: string): string;
    item(i: number): string;
    get length(): number;
    get cssText(): string;
    set cssText(v: string);
    [Symbol.iterator](): MapIterator<string>;
}
export declare function styleOf(el: any): any;
