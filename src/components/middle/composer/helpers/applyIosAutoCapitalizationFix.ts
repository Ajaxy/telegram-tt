import { IS_IOS } from '../../../../util/windowEnvironment';

let resetInput: HTMLInputElement;

if (IS_IOS) {
  resetInput = document.createElement('input');
  resetInput.classList.add('for-ios-autocapitalization-fix');
  document.body.appendChild(resetInput);
}

// https://stackoverflow.com/a/55652503
export default function applyIosAutoCapitalizationFix(inputEl: HTMLElement) {
  resetInput.focus();
  inputEl.focus();
}
