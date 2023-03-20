// Original idea was found here
// https://medium.com/@alshakero/how-to-setup-your-web-app-manifest-dynamically-using-javascript-f7fbee899a61

import { DEBUG } from '../config';
import { IS_MAC_OS } from './windowEnvironment';

export default function updateWebmanifest() {
  if (!IS_MAC_OS) {
    return;
  }

  const manifest = document.getElementById('the-manifest-placeholder');
  if (!manifest) {
    return;
  }

  const url = `site_apple${DEBUG ? '_dev' : ''}.webmanifest`;
  manifest.setAttribute('href', url);
}
