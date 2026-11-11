export * from 'css-select';
export declare const pseudoHooks: Record<string, (el: any) => boolean>;
/** Rename state pseudo-classes outside of quoted strings. */
export declare function rewriteSelector(selector: string): string;
export declare function compile(selector: any, options?: any): any;
export declare function is(element: any, selector: any, options?: any): any;
export declare function selectAll(query: any, elements: any, options?: any): any;
export declare function selectOne(query: any, elements: any, options?: any): any;
