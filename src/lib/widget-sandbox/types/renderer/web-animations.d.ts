import type { AnimRecord } from '../shared/protocol';
/**
 * One per renderer instance: the shadow-DOM renderer puts many widgets in one
 * page, and a widget must neither see nor drive another widget's animations.
 */
export declare class AnimationState {
    readonly scripted: Map<number, Animation>;
    readonly cssIds: WeakMap<Animation, number>;
    readonly cssById: Map<number, WeakRef<Animation>>;
    cssSeq: number;
}
export declare function cssAnimationList(state: AnimationState, el: Element, subtree: boolean, idOf: (n: Node | null) => number): unknown[];
export declare function applyAnims(state: AnimationState, now: number, anims: AnimRecord[], nodeById: (id: number) => Node | undefined): void;
