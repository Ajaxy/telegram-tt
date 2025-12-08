/// <reference types="user-agent-data-types" />

declare const process: NodeJS.Process;

declare module '*.module.scss';

declare const APP_VERSION: string;
declare const APP_REVISION: string;
declare const CHANGELOG_DATETIME: number | undefined;

declare namespace React {
  interface HTMLAttributes {
    // Optimization for DOM nodes prepends and inserts
    teactFastList?: boolean;
    teactExperimentControlled?: boolean;
  }

  // Teact features
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-wrapper-object-types
  interface CSSProperties extends String {}

  interface ClassAttributes<T> extends RefAttributes<T> {
    ref?: ((instance: T | undefined) => void) | React.RefObject<T | undefined> | undefined; // Teact ref
  }

  interface Attributes {
    // Optimization for DOM nodes reordering. Requires `teactFastList` for parent
    teactOrderKey?: number;
  }

  interface VideoHTMLAttributes {
    srcObject?: MediaStream;
    defaultMuted?: boolean;
  }

  interface MouseEvent {
    offsetX: number;
    offsetY: number;
  }

  interface KeyboardEvent {
    isComposing: boolean;
  }
}

type AnyLiteral = Record<string, any>;
type AnyClass = new (...args: any[]) => any;
type AnyFunction = (...args: any[]) => any;
type AnyToVoidFunction = (...args: any[]) => void;
type BooleanToVoidFunction = (value: boolean) => void;
type NoneToVoidFunction = () => void;

type StringAutocomplete<T> = T | (string & {});

type Complete<T> = {
  [P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : (T[P] | undefined);
};

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

// Declare supported formats as modules
declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.jpg' {
  const url: string;
  export default url;
}
declare module '*.svg' {
  const url: string;
  export default url;
}
declare module '*.txt' {
  const url: string;
  export default url;
}
declare module '*.tgs' {
  const url: string;
  export default url;
}
declare module '*.wasm' {
  const url: string;
  export default url;
}
declare module '*.strings' {
  const url: string;
  export default url;
}

declare module 'pako/dist/pako_inflate' {
  function inflate(...args: any[]): string;
}

declare module 'opus-recorder' {
  export interface IOpusRecorder extends Omit<MediaRecorder, 'start' | 'ondataavailable'> {
    // eslint-disable-next-line @typescript-eslint/no-misused-new
    new(options: AnyLiteral): IOpusRecorder;

    start(stream?: MediaStreamAudioSourceNode): Promise<void>;

    sourceNode: MediaStreamAudioSourceNode;

    ondataavailable: (typedArray: Uint8Array<ArrayBuffer>) => void;
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
  mozFullScreenElement: HTMLElement;
  webkitFullscreenElement: HTMLElement;
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

type Undefined<T> = {
  [K in keyof T]: undefined;
};
type OptionalCombine<A, B> = (A & B) | (A & Undefined<B>);

type CommonProperties<T, U> = {
  [K in keyof T & keyof U]: T[K] & U[K];
};

// Fix to make Boolean() work as !!
// https://github.com/microsoft/TypeScript/issues/16655
type Falsy = false | 0 | '' | null | undefined;

interface BooleanConstructor {
  new<T>(value: T | Falsy): value is T;
  <T>(value: T | Falsy): value is T;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  readonly prototype: Boolean;
}

interface Array<T> {
  filter<S extends T>(predicate: BooleanConstructor, thisArg?: unknown): Exclude<S, Falsy>[];
}
interface ReadonlyArray<T> {
  filter<S extends T>(predicate: BooleanConstructor, thisArg?: unknown): Exclude<S, Falsy>[];
}

// Missing type definitions for OPFS (Origin Private File System) API
// https://github.com/WICG/file-system-access/blob/main/AccessHandle.md#accesshandle-idl
interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}

interface FileSystemSyncAccessHandle {
  read: (buffer: BufferSource, options: FilesystemReadWriteOptions) => number;
  write: (buffer: BufferSource, options: FilesystemReadWriteOptions) => number;

  truncate: (size: number) => Promise<undefined>;
  getSize: () => Promise<number>;
  flush: () => Promise<undefined>;
  close: () => Promise<undefined>;
}

type FilesystemReadWriteOptions = {
  at: number;
};
