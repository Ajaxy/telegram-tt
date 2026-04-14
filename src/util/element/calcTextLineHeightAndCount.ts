export default function calcTextLineHeightAndCount(
  textContainer: HTMLElement,
  shouldSubtractPadding?: boolean,
) {
  const DEFAULT_LINE_HEIGHT_RATIO = 1.2; // CSS spec default for line-height: normal

  const style = getComputedStyle(textContainer);
  const lineHeight = style.lineHeight === 'normal'
    ? parseFloat(style.fontSize) * DEFAULT_LINE_HEIGHT_RATIO
    : parseFloat(style.lineHeight);

  let contentHeight = textContainer.scrollHeight;
  if (shouldSubtractPadding) {
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    contentHeight -= paddingTop + paddingBottom;
  }

  const totalLines = Math.round(contentHeight / lineHeight);

  return {
    totalLines,
    lineHeight,
  };
}
