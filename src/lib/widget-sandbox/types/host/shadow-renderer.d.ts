import { type RendererEnv } from '../renderer/core';
import type { HostToRenderer, RendererToHost } from '../shared/protocol';
import type { Renderer, RendererFactory } from './renderer';
export declare class ShadowDomRenderer implements Renderer {
    static readonly factory: RendererFactory;
    /** The client's emoji images for every widget, `RendererEnv.emoji` (local patch, NOTICE.md). */
    static emoji: RendererEnv['emoji'];
    /** Tells WidgetHost to run the validator in shadow scope (`:root`, `:host`, `@media`, viewport units). */
    readonly cssScope: "shadow";
    readonly element: HTMLDivElement;
    onMessage: ((msg: RendererToHost) => void) | null;
    onDiag: ((kind: string, detail: string) => void) | null;
    readonly shadow: ShadowRoot;
    private readonly html;
    private readonly reset;
    private core;
    private queued;
    private destroyed;
    constructor(container: HTMLElement, theme: 'light' | 'dark');
    private env;
    load(): void;
    send(msg: HostToRenderer): void;
    setTheme(theme: 'light' | 'dark'): void;
    destroy(): void;
}
