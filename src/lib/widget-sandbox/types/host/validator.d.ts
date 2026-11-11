import { type CssEnv, type Diag } from './css-sanitizer';
import { type AnimRecord, type CanvasCmd, type Query, type RenderOp } from '../shared/protocol';
export declare function textWork(text: string): number;
export declare function chargesChurn(text: string): boolean;
/**
 * The allowlists, limits and placeholder this validator enforces, as data, so a
 * native host's own node model (Swift `NativeValidator`) applies the same rules
 * from one source of truth instead of a copy.
 */
export type ValidatorPolicy = 'compat' | 'strict';
/**
 * `stop`: a counted cap stops the widget (strict) instead of dropping the op with a diagnostic (compat);
 * `maxCssRules` / `maxKeyframes` 0 = no cap.
 */
export declare function policyLimits(policy: ValidatorPolicy): {
    maxText: number;
    maxCanvasString: number;
    maxAttr: number;
    maxOps: number;
    maxCanvasCmds: number;
    maxNodes: number;
    maxCssRules: number;
    maxKeyframes: number;
    maxLiveAnims: number;
    maxCanvasPixels: number;
    complexTextBudget: number;
    textBudget: number;
    stop: boolean;
};
/**
 * Style rules and `@keyframes` blocks in a sanitized stylesheet: a rule inside `@media` / `@supports` / `@container` /
 * `@layer` counts, the keyframe selectors inside `@keyframes` do not.
 */
export declare function countCssRules(css: string): {
    rules: number;
    keyframes: number;
};
export declare function validatorTables(policy?: ValidatorPolicy): unknown;
export declare class Validator {
    private nodes;
    private adopted;
    private dirtyStyles;
    private complexText;
    private totalText;
    private cssRules;
    private cssKeyframes;
    /** Each canvas's bitmap size (width, height), and their pixels together: the strict cap is on the sum. */
    private canvasSizes;
    private canvasPixels;
    private stopReason;
    private churnTokens;
    private churnAt;
    private clock;
    setClock(clock: () => number): void;
    /**
     * Until the host says the widget has loaded (`markLoaded`), inserted text is not charged to the churn bucket: building
     * the document in the loading tasks, in any number of batches, is bounded by the document's caps alone, so a load never
     * drops text they allow (a 48 K document of paragraphs lost them past ~45 K, silently, on every host).
     */
    private loading;
    /** The host's word that the loading tasks are over (their ops are in): from now on text changes are rate-limited. */
    markLoaded(): void;
    private takeChurn;
    private overChurn;
    private policyName;
    private limits;
    get policy(): ValidatorPolicy;
    /**
     * Set once a counted cap was passed under strict: the reason the host stops the widget with (`die`), as it does for
     * memory or CPU. From then on every batch is refused whole, so the renderer keeps the last render that fit.
     */
    get stopped(): string | null;
    /** A cap passed: strict stops the widget (diagnostic `limit`, the host acts on it); compat only rejects the op. */
    private stop;
    private tooLongText;
    private tooLongAttr;
    /**
     * The document's counted totals (its text, CSS rules, `@keyframes`) after a whole batch, not op by op: a subtree
     * replaced in one task (`innerHTML`, `replaceChildren`) or two sheets rewritten in one task pass through a sum of the
     * old and the new that the document never holds. False when a total is over its cap (the widget stops).
     */
    private checkTotals;
    /**
     * Canvas `id` takes the bitmap `w` × `h` (an attribute, its removal, the shim's `r` command, a new canvas's 300 × 150);
     * false when the widget's canvases would hold more pixels together than strict allows (the widget stops).
     */
    private sizeCanvas;
    /** A canvas's `width` or `height` attribute set to `value` (null: removed), by HTML's rules for non-negative integers. */
    private sizeCanvasAttr;
    setPolicy(policy: ValidatorPolicy): void;
    private out;
    private diag;
    private env;
    constructor(diag: Diag, env?: CssEnv);
    get nodeCount(): number;
    /** The host theme changed: re-evaluate every stylesheet against it. */
    setTheme(colorScheme: CssEnv['colorScheme']): RenderOp[];
    private styleText;
    private get budgeted();
    /** The text an attribute value can put on screen under the strict budgets, or null if none. */
    private attrText;
    /** Media query strings from matchMedia(): prefers-color-scheme is answered from the host theme. */
    rewriteMediaQuery(query: string): string;
    /** Would a `canvas` op for `id` be accepted (a known `<canvas>` element)? Native hosts check this before validating canvas words themselves. */
    isCanvas(id: unknown): boolean;
    /**
     * A native host that keeps the node model itself (Swift `NativeValidator`) answers
     * "which rendered element is `id`" for the checks still done here (queries,
     * Web Animations): the tag, or null.
     */
    private nodeLookup;
    setNodeLookup(lookup: ((id: number) => string | null) | null): void;
    get cssEnv(): CssEnv;
    get diagnostics(): Diag;
    /** Validated canvas commands, with the same diagnostics as a `canvas` op. */
    canvasCommands(cmds: unknown): CanvasCmd[];
    /** Does `id` name an element the renderer knows about? (Used to validate queries.) */
    private renderedElement;
    processOps(batch: unknown): RenderOp[];
    private applyOp;
    private newNode;
    private opEl;
    private opCharData;
    private opData;
    private opInsert;
    private unlink;
    private opRemove;
    private opAttr;
    private opRemoveAttr;
    private canonAttrName;
    /**
     * The attribute gate. Returns the attribute(s) to set in the renderer:
     * usually one, none if the attribute is dropped.
     */
    private sanitizeAttr;
    private sanitizeUrlAttr;
    private opStyle;
    private opProp;
    private updateTextSlot;
    private releaseTextSlot;
    private opCall;
    private opCanvas;
    private tooManyCanvasCmds;
    /** A canvas argument: finite number, short string, boolean, null, flat number array, or object ref. */
    private canvasArg;
    private canvasArgs;
    /** A canvas call or property outside the profile: dropped with a `profile` diagnostic (once per name and canvas op). */
    private outOfProfile;
    private canvasCmd;
    /** Validate a sync query. Returns a clean copy, or null to answer with an error. */
    validateQuery(q: unknown): Query | null;
    private liveAnims;
    validateAnim(list: unknown): AnimRecord[];
    /** Event types the sandbox wants forwarded. */
    validateListen(types: unknown): string[];
    /** "Learned preventDefault" keys: `${nodeId}:${eventType}`. */
    validatePreventDefault(keys: unknown): string[];
}
