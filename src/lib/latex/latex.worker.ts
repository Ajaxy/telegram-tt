export type LatexRequest = {
  type: 'init';
  moduleUrl: string;
} | {
  type: 'render';
  source: string;
  isBlock?: boolean;
};

export type LatexResponse = {
  type: 'ready';
} | {
  type: 'result';
  markup?: string;
} | {
  type: 'error';
};

type TemmlModule = typeof import('temml');

const MAX_MARKUP_LENGTH = 64 * 1024; // 64KB
const MAX_NODE_COUNT = 1024;
const MARKUP_TOKEN_REGEX = /<[^>]*>|[^<]+/g;

let temml: TemmlModule['default'];

self.onmessage = ({ data }: MessageEvent<LatexRequest>) => {
  if (data.type === 'init') {
    void initializeTemml(data.moduleUrl);
    return;
  }

  self.postMessage({
    type: 'result',
    markup: renderLatex(data.source, data.isBlock),
  } satisfies LatexResponse);
};

async function initializeTemml(moduleUrl: string) {
  try {
    // Vite breaks Temml on build. https://github.com/ronkok/Temml/pull/128
    temml = ((await import(/* @vite-ignore */ moduleUrl)) as TemmlModule).default;
    self.postMessage({ type: 'ready' } satisfies LatexResponse);
  } catch {
    self.postMessage({ type: 'error' } satisfies LatexResponse);
  }
}

function renderLatex(source: string, isBlock?: boolean) {
  try {
    const markup = temml.renderToString(source, {
      displayMode: isBlock,
      throwOnError: true,
      trust: false,
    });

    if (markup.length > MAX_MARKUP_LENGTH) return undefined;

    // Temml escapes text and attributes, so each opening tag or text run represents one DOM node
    let nodeCount = 0;
    for (const [token] of markup.matchAll(MARKUP_TOKEN_REGEX)) {
      if (token.startsWith('</')) continue;
      nodeCount++;
      if (nodeCount > MAX_NODE_COUNT) return undefined;
    }

    return markup;
  } catch {
    return undefined;
  }
}
