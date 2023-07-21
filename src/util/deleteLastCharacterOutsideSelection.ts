export default function deleteLastCharacterOutsideSelection(html: string) {
  const tempInput = document.createElement('div');
  tempInput.contentEditable = 'true';
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-10000px';
  tempInput.style.top = '-10000px';
  tempInput.innerHTML = html;
  tempInput.className = 'allow-selection'; // Patch for Safari
  document.body.appendChild(tempInput);
  let element = tempInput.lastChild!;

  if (element.lastChild) {
    // Selects the last and the deepest child of the element.
    while (element.lastChild) {
      element = element.lastChild;
    }
  }

  // Gets length of the element's content.
  const textLength = element.textContent!.length;
  const range = document.createRange();
  const selection = window.getSelection()!;

  // Sets selection position to the end of the element.
  range.setStart(element, textLength);
  range.setEnd(element, textLength);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand('delete', false);

  const result = tempInput.innerHTML;
  document.body.removeChild(tempInput);

  return result;
}
