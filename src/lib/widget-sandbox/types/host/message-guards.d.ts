/** Shape checks for messages crossing the worker and renderer boundaries; anything else is dropped. */
export declare function isTypedMessage(value: unknown): value is {
    type: string;
} & Record<string, unknown>;
export declare function finiteNumber(value: unknown): number | undefined;
