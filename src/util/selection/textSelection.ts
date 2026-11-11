type TextSelectionNode = {
  node: Node;
  text: string;
  isAtomic: boolean;
};

export type TextSpan = [start: number, end: number];

export function getTextSelectionNodes(root: Node): TextSelectionNode[] {
  const nodes: TextSelectionNode[] = [];
  visitNode(root);
  return nodes;

  function visitNode(node: Node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : undefined;
    if (element?.matches('.code-overlay, .code-title, [data-rich-copy-ignore], [aria-hidden="true"], canvas')) return;
    if (node !== root && element?.hasAttribute('data-rich-quote-index')) return;

    const atomicText = element?.dataset.textContent ?? element?.dataset.source ?? element?.dataset.alt
      ?? (element?.tagName === 'IMG' ? (element as HTMLImageElement).alt : undefined);
    const text = atomicText ?? (element?.tagName === 'BR' ? '\n'
      : node.nodeType === Node.TEXT_NODE ? node.textContent! : undefined);
    if (text === undefined) {
      node.childNodes.forEach(visitNode);
    } else if (text.length) {
      nodes.push({ node, text, isAtomic: node.nodeType !== Node.TEXT_NODE });
    }
  }
}

// Spans must be sorted by start
export function buildTextSelectionRanges(root: Node, source: string, spans: TextSpan[]) {
  const ranges: Range[] = [];
  const normalizedSource = source.replace(/\u00a0/g, ' ');
  let offset = 0;
  let spanIndex = 0;
  getTextSelectionNodes(root).forEach(({ node, text, isAtomic }) => {
    const index = normalizedSource.indexOf(text.replace(/\u00a0/g, ' '), offset);
    if (index < 0) return;
    offset = index + text.length;
    while (spanIndex < spans.length && spans[spanIndex][1] <= index) spanIndex++;

    for (let i = spanIndex; i < spans.length && spans[i][0] < offset; i++) {
      const [start, end] = spans[i];
      const range = document.createRange();
      if (isAtomic) {
        range.selectNode(node);
      } else {
        range.setStart(node, Math.max(0, start - index));
        range.setEnd(node, Math.min(text.length, end - index));
      }
      ranges.push(range);
    }
  });
  return ranges;
}
