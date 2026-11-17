export declare class OpWriter {
    private readonly send;
    private w;
    private n;
    private count;
    private strings;
    private interned;
    private tableSize;
    private flushes;
    private resetPending;
    constructor(send: (words: Int32Array, strings: string) => void);
    get length(): number;
    private room;
    /** Interned reference (-k-1), defining it in-stream on first use, or NOT_INTERNED. */
    private intern;
    private inline;
    private field;
    boxNeutral: boolean;
    push(o: any): void;
    private record;
    /** Hands the batch to the glue. Ill-formed UTF-16 becomes U+FFFD: the renderer could not carry it anyway. */
    flush(): void;
}
