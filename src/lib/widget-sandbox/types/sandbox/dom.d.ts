export declare const SVG_NS = "http://www.w3.org/2000/svg";
/**
 * Scripts created by fragment parsing (innerHTML, outerHTML,
 * insertAdjacentHTML) never execute, exactly like in browsers. Without this a
 * script doing `document.body.innerHTML += …` would re-create and re-run
 * itself forever.
 */
export declare const SCRIPT_INERT: unique symbol;
export declare const document: any;
export declare const linkedomWindow: any;
/** Set on a node once script could have obtained a reference to it. */
export declare const EXPOSED: unique symbol;
/** Hooks the capture layer fills in. */
export declare const domHooks: {
    observing: () => boolean;
    markDirty: (_node: any) => void;
};
/** Runs `fn` as the shim's own bookkeeping: node reads inside it do not count as script exposure. */
export declare function quietly<T>(fn: () => T): T;
export declare function exposeNode<T>(n: T): T;
/** A Range, TreeWalker, NodeIterator or Selection can reach any node: stop updating text nodes in place for good. */
export declare function exposeAll(): void;
export declare function setInPlaceText(enabled: boolean): void;
/** Append linkedom nodes for the children of a parse5 node. */
export declare function build(p5: any, parent: any, inertScripts?: boolean): void;
/** Parse a full document or a bare fragment into the (single) widget document. */
export declare function loadDocument(html: string): void;
/** Parse `html` as the children of `context` (innerHTML semantics). */
export declare function parseInto(context: any, html: string, target?: any): void;
export declare function setAttrFast(enabled: boolean): void;
/**
 * Installed after dirty tracking. getAttribute('class') normally goes through the
 * className getter and the dirty-marking classList wrapper; when the class
 * attribute and the cached classList hold the same single token it returns the
 * attribute value directly. Writing the class an element already has returns
 * before dirty marking when nothing could observe the write (no MutationObserver,
 * no attributeChangedCallback).
 */
export declare function installAttributeFastPaths(): void;
