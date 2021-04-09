let fileSelector: HTMLInputElement;

export function openSystemFilesDialog(accept = '*', callback: (e: Event) => void, noMultiple = false) {
  if (!fileSelector) {
    fileSelector = document.createElement('input');
    fileSelector.setAttribute('type', 'file');
  }

  fileSelector.setAttribute('accept', accept);

  if (noMultiple) {
    fileSelector.removeAttribute('multiple');
  } else {
    fileSelector.setAttribute('multiple', 'multiple');
  }

  // eslint-disable-next-line no-null/no-null
  fileSelector.onchange = null;
  fileSelector.value = '';
  fileSelector.onchange = callback;

  fileSelector.click();
}
