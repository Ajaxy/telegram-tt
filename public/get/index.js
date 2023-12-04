const REPO = 'ulu-telegram/app';
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_RELEASE_WEB_URL = `https://github.com/${REPO}/releases/latest`;
const WEB_APP_URL = location.pathname.startsWith('/a/') ? '/a/' : '/';

const platform = getPlatform();
const currentPage = location.href.includes('mac.html')
  ? 'mac'
  : location.href.includes('unsupported.html')
    ? 'unsupported'
    : 'index';

// Request the latest release information from GitHub
const packagesPromise = fetch(LATEST_RELEASE_API_URL)
  .then(response => response.json())
  .then(data => {
    return data.assets.reduce((acc, {
      name,
      browser_download_url,
    }) => {
      if (name.endsWith('.exe')) {
        acc['win'] = browser_download_url;
      } else if (name.endsWith('.AppImage')) {
        acc['linux'] = browser_download_url;
      } else if (name.endsWith('.dmg')) {
        acc[`mac-${name.includes('arm') ? 'arm' : 'x64'}`] = browser_download_url;
      }

      return acc;
    }, {
      $version: data.name,
    });
  })
  .catch((error) => {
    console.error('Error:', error);
  });

(function init() {
  if (platform === 'Windows' || platform === 'Linux') {
    if (currentPage === 'index') {
      setupDownloadButton();
      setupVersion();
    }
  } else if (platform === 'macOS') {
    if (currentPage !== 'mac') {
      redirectToMac();
    } else {
      setupVersion();
    }
  } else if (currentPage !== 'unsupported') {
    redirectToUnsupported();
  }
}());

function getPlatform() {
  const {
    userAgent,
    platform,
  } = window.navigator;

  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  if (
    iosPlatforms.indexOf(platform) !== -1
    // For new IPads with M1 chip and IPadOS platform returns "MacIntel"
    || (platform === 'MacIntel' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 2))
  ) {
    return 'iOS';
  }

  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  if (macosPlatforms.indexOf(platform) !== -1) return 'macOS';

  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  if (windowsPlatforms.indexOf(platform) !== -1) return 'Windows';

  if (/Android/.test(userAgent)) return 'Android';

  if (/Linux/.test(platform)) return 'Linux';

  return undefined;
}

function setupDownloadButton() {
  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.querySelector('.download-btn');
    downloadBtn.innerHTML += ` for ${platform}`;
  });
}

function setupVersion() {
  document.addEventListener('DOMContentLoaded', () => {
    packagesPromise.then((packages) => {
      const versionEl = document.querySelector('.version');
      versionEl.innerHTML = `v. ${packages.$version} · `;
    });
  });
}

function redirectToMac() {
  location.href = './mac.html';
}

function redirectToUnsupported() {
  location.href = './unsupported.html';
}

function redirectToWeb() {
  location.href = WEB_APP_URL;
}

function redirectToFullList() {
  location.href = LATEST_RELEASE_WEB_URL;
}

function downloadDefault() {
  if (platform === 'Windows') {
    download('win');
  } else if (platform === 'Linux') {
    download('linux');
  } else if (platform === 'macOS') {
    redirectToMac();
  } else {
    redirectToUnsupported();
  }
}

function download(platform) {
  packagesPromise.then((packages) => {
    location.href = packages[platform];
  });
}
