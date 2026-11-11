export declare const MINI_HTML: {
    readonly zlib: 4096;
    readonly raw: 32768;
    readonly warnZlib: 3800;
};
/** Bytes after zlib compression (level 9 in the harness), and of the HTML as UTF-8. */
export interface WidgetSize {
    zlib: number;
    raw: number;
}
/** `size: 2134 B zlib / 9.8 KB raw (limit 4096 / 32768)`. */
export declare function sizeLine(s: WidgetSize): string;
/** What to tell the author: nothing, a warning close to the compressed limit, or an error past a limit. */
export declare function sizeVerdict(s: WidgetSize): {
    level: 'ok' | 'warning' | 'error';
    message: string | null;
};
