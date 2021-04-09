declare const process: NodeJS.Process;

declare namespace React {
  interface HTMLAttributes {
    // Optimization for DOM nodes prepends and inserts
    teactFastList?: boolean;
  }

  interface Attributes {
    // Optimization for DOM nodes reordering. Requires `teactFastList` for parent
    teactOrderKey?: number;
  }

  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    loading?: 'auto' | 'eager' | 'lazy';
  }
}

type AnyLiteral = Record<string, any>;
type AnyClass = new (...args: any[]) => any;
type AnyFunction = (...args: any) => any;
type AnyToVoidFunction = (...args: any) => void;
type NoneToVoidFunction = () => void;

type Country = {
  id: string;
  name: string;
  flag: string;
  code: string;
};

type EmojiCategory = {
  id: string;
  name: string;
  emojis: string[];
};

type Emoji = {
  id: string;
  colons: string;
  native: string;
  image: string;
  skin?: number;
};

type EmojiWithSkins = Record<number, Emoji>;

type AllEmojis = Record<string, Emoji | EmojiWithSkins>;

declare module '*.png';

declare module 'pako/dist/pako_inflate' {
  function inflate(...args: any[]): string;
}

type WindowWithPerf = typeof window & { perf: AnyLiteral };

declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}

declare module 'service-worker-loader!*' {
  const register: import('service-worker-loader/types').ServiceWorkerRegister;
  const ServiceWorkerNoSupportError: import('service-worker-loader/types').ServiceWorkerNoSupportError;
  const scriptUrl: import('service-worker-loader/types').ScriptUrl;
  export default register;
  export {
    ServiceWorkerNoSupportError,
    scriptUrl,
  };
}

interface IWebpWorker extends Worker {
  wasmReady?: boolean;
  requests: Map<string, (value?: PromiseLike<TEncodedImage>) => void>;
}

interface Window {
  ClipboardItem?: any;
  requestIdleCallback: (cb: AnyToVoidFunction) => void;
}

interface Clipboard { write?: any }

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
