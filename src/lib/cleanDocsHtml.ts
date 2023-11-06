// Utility for cleaning html code from Google Docs.
// Original source from DocsSoap:
// https://www.npmjs.com/package/docs-soap

const GDOCS_ELEMENT_ID_REGEXP = /id="docs-internal-guid/i;

const GDOCS_STYLES = {
  BOLD: '700',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKETHROUGH: 'line-through',
  SUPERSCRIPT: 'super',
  SUBSCRIPT: 'sub',
};

const ELEMENTS = {
  ANCHOR: 'a',
  BOLD: 'strong',
  ITALIC: 'em',
  UNDERLINE: 'u',
  BLOCKQUOTE: 'blockquote',
  STRIKETHROUGH: 'del',
  SUPERSCRIPT: 'sup',
  SUBSCRIPT: 'sub',
};

const headers = [
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
];

function parseHtml(html: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return doc.body;
}

function wrapNodeAnchor(node: Node, href: string): HTMLAnchorElement {
  const anchor = document.createElement(ELEMENTS.ANCHOR) as HTMLAnchorElement;
  anchor.href = href;
  anchor.appendChild(node.cloneNode(true));

  return anchor;
}

function wrapNodeInline(node: Node, style: string): Node {
  const el = document.createElement(style);
  el.appendChild(node.cloneNode(true));

  return el;
}

function wrapNode(inner: HTMLElement, result: Node): Node {
  let newNode = result.cloneNode(true);
  if (!inner) {
    return newNode;
  }
  if (inner.style && inner.style.fontWeight === GDOCS_STYLES.BOLD) {
    newNode = wrapNodeInline(newNode, ELEMENTS.BOLD);
  }
  if (inner.style && inner.style.fontStyle === GDOCS_STYLES.ITALIC) {
    newNode = wrapNodeInline(newNode, ELEMENTS.ITALIC);
  }
  if (inner.style && inner.style.textDecoration === GDOCS_STYLES.UNDERLINE) {
    newNode = wrapNodeInline(newNode, ELEMENTS.UNDERLINE);
  }
  if (inner.style && inner.style.textDecoration === GDOCS_STYLES.STRIKETHROUGH) {
    newNode = wrapNodeInline(newNode, ELEMENTS.STRIKETHROUGH);
  }
  if (inner.style && inner.style.verticalAlign === GDOCS_STYLES.SUPERSCRIPT) {
    newNode = wrapNodeInline(newNode, ELEMENTS.SUPERSCRIPT);
  }
  if (inner.style && inner.style.verticalAlign === GDOCS_STYLES.SUBSCRIPT) {
    newNode = wrapNodeInline(newNode, ELEMENTS.SUBSCRIPT);
  }

  return newNode;
}

function applyBlockStyles(dirty: Node): Node {
  const node = dirty.cloneNode(true);
  let newNode = document.createTextNode(node.textContent || '') as Node;
  let styledNode = document.createTextNode('') as Node;
  if ('style' in node.childNodes[0] && Boolean(node.childNodes[0].style)) {
    styledNode = node.childNodes[0];
  }
  if (node.childNodes[0] && node.childNodes[0].nodeName === 'A') {
    newNode = wrapNodeAnchor(newNode.cloneNode(true), (node.childNodes[0] as HTMLAnchorElement).href);
    styledNode = node.childNodes[0].childNodes[0];
  }
  newNode = wrapNode(styledNode as HTMLElement, newNode);
  return newNode;
}

function applyInlineStyles(dirty: Node): Node {
  const node = dirty.cloneNode(true);
  let newNode = document.createTextNode(node.textContent || '') as Node;
  let styledNode = node;
  if (node.nodeName === 'A') {
    newNode = wrapNodeAnchor(newNode, (node as HTMLAnchorElement).href);
    if ('style' in node.childNodes[0] && Boolean(node.childNodes[0].style)) {
      styledNode = node.childNodes[0];
    }
  }
  newNode = wrapNode(styledNode as HTMLElement, newNode);
  return newNode;
}

function getCleanNode(node: Node): Node[] {
  if (node.childNodes && (node.childNodes.length <= 1 || node.nodeName === 'OL' || node.nodeName === 'UL')) {
    let newWrapper: Node | undefined;
    let newNode = document.createTextNode(node.textContent || '') as Node;
    if (node.nodeName === 'UL' || node.nodeName === 'OL' || node.nodeName === 'LI') {
      newWrapper = document.createElement(node.nodeName);
      newNode = document.createDocumentFragment();
      const items = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        items.push(...getCleanNode(node.childNodes[i]));
      }
      items.map((i: Node): Node => newNode.appendChild(i));
    } else if (headers.indexOf(node.nodeName) !== -1) {
      newWrapper = document.createElement(node.nodeName);
      newNode = applyInlineStyles(node.childNodes[0]);
    } else if (node.nodeName === 'P') {
      newWrapper = document.createElement('p');
      newNode = applyBlockStyles(node);
    } else if (node.nodeName === 'BR') {
      newNode = node;
    } else {
      newWrapper = document.createElement('span');
      newNode = applyInlineStyles(node);
    }
    if (newWrapper) {
      newWrapper.appendChild(newNode);
      return [newWrapper];
    }

    return [node.cloneNode(true)];
  }

  if (node.childNodes) {
    const nodes = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      nodes.push(...getCleanNode(node.childNodes[i]));
    }
    return nodes;
  }

  return [node];
}

function filterNode(node: Node): boolean {
  return node.nodeType !== 8; // Node.COMMENT_NODE = 8
}

function getCleanDocument(dirty: HTMLElement): HTMLElement {
  const body = document.createElement('body');
  const nodes = dirty.childNodes;
  const filteredNodes = Array.from(nodes).filter(filterNode);
  const cleanNodes = [];

  for (const node of filteredNodes) {
    cleanNodes.push(...getCleanNode(node));
  }

  for (let i = 0; i < cleanNodes.length; i++) {
    body.appendChild(cleanNodes[i].cloneNode(true));
  }

  return body;
}

export default function cleanDocsHtml(clipboardContent: string): string {
  if (!clipboardContent.match(GDOCS_ELEMENT_ID_REGEXP)) {
    return parseHtml(clipboardContent.replace(/(\r\n|\n|\r)/, '')).innerHTML;
  }

  return getCleanDocument(parseHtml(clipboardContent.replace(/(\r\n|\n|\r)/, ''))).innerHTML;
}
