export declare function createWebAnimations(api: any): any;
export declare function setWebAnimations(on: boolean): void;
/** Strict (the default): 64 live script animations, as the validator; compat: 1024. */
export declare function setAnimationLimit(strict: boolean): void;
export declare function webAnimationsEnabled(): boolean;
export declare function webAnimations(): any;
/** Sends script animation state changed in this task; a no-op until a widget animates. */
export declare function flushPendingAnimations(): void;
