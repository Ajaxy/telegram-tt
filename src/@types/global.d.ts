declare const process: NodeJS.Process;

declare namespace React {
  interface HTMLAttributes {
    // Optimization for DOM nodes prepends and inserts
    teactFastList?: boolean;
  }

  // Teact feature
  interface CSSProperties extends String {}

  interface Attributes {
    // Optimization for DOM nodes reordering. Requires `teactFastList` for parent
    teactOrderKey?: number;
  }

  interface VideoHTMLAttributes {
    srcObject?: MediaStream;
  }

  interface MouseEvent {
    offsetX: number;
    offsetY: number;
  }
}

type AnyLiteral = Record<string, any>;
type AnyClass = new (...args: any[]) => any;
type AnyFunction = (...args: any[]) => any;
type AnyToVoidFunction = (...args: any[]) => void;
type NoneToVoidFunction = () => void;

type EmojiCategory = {
  id: string;
  name: string;
  emojis: string[];
};

type Emoji = {
  id: string;
  names: string[];
  native: string;
  image: string;
  skin?: number;
};

type EmojiWithSkins = Record<number, Emoji>;

type AllEmojis = Record<string, Emoji | EmojiWithSkins>;

// Declare supported for import formats as modules
declare module '*.png';
declare module '*.svg';
declare module '*.tgs';

declare module '*.txt' {
  const content: string;
  export default content;
}

declare module 'pako/dist/pako_inflate' {
  function inflate(...args: any[]): string;
}

declare module 'opus-recorder' {
  export interface IOpusRecorder extends Omit<MediaRecorder, 'start' | 'ondataavailable'> {
    new(options: AnyLiteral): IOpusRecorder;

    start(stream?: MediaStreamAudioSourceNode): void;

    sourceNode: MediaStreamAudioSourceNode;

    ondataavailable: (typedArray: Uint8Array) => void;
  }

  const recorder: IOpusRecorder;
  export default recorder;
}

interface TEncodedImage {
  result: Uint8ClampedArray;
  width: number;
  height: number;
}

interface IWebpWorker extends Worker {
  wasmReady?: boolean;
  requests: Map<string, (value: PromiseLike<TEncodedImage>) => void>;
}

interface Document {
  mozFullScreenElement: any;
  webkitFullscreenElement: any;
  mozCancelFullScreen?: () => Promise<void>;
  webkitCancelFullScreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
}

interface HTMLElement {
  mozRequestFullScreen?: () => Promise<void>;
  webkitEnterFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
}

interface Navigator {
  // PWA badging extensions https://w3c.github.io/badging/
  setAppBadge?(count: number): Promise<void>;
}

// Fix to make Boolean() work as !!
// https://github.com/microsoft/TypeScript/issues/16655
type Falsy = false | 0 | '' | null | undefined;

interface BooleanConstructor {
  new<T>(value: T | Falsy): value is T;
  <T>(value: T | Falsy): value is T;
  readonly prototype: Boolean;
}

interface Array<T> {
  filter<S extends T>(predicate: BooleanConstructor, thisArg?: any): Exclude<S, Falsy>[];
}
interface ReadonlyArray<T> {
  filter<S extends T>(predicate: BooleanConstructor, thisArg?: any): Exclude<S, Falsy>[];
}
