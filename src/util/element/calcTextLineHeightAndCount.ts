export default function calcTextLineHeightAndCount(textContainer: HTMLElement) {
  const lineHeight = parseInt(getComputedStyle(textContainer).lineHeight, 10);

  const totalLines = textContainer.scrollHeight / lineHeight;

  return {
    totalLines,
    lineHeight,
  };
}
