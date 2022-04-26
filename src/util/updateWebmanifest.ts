// Original idea was found here
// https://medium.com/@alshakero/how-to-setup-your-web-app-manifest-dynamically-using-javascript-f7fbee899a61

import { DEBUG } from '../config';
import { IS_MAC_OS } from './environment';

export default function updateWebmanifest() {
  const manifest = document.getElementById('the-manifest-placeholder');
  if (!manifest) {
    return;
  }

  const url = `site${IS_MAC_OS ? '_apple' : ''}${DEBUG ? '_dev' : ''}.webmanifest`;
  manifest.setAttribute('href', url);
}
