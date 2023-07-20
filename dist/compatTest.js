function compatTest() {
  var hasPromise = typeof Promise !== 'undefined';
  var hasWebSockets = typeof WebSocket !== 'undefined';
  var hasWebCrypto = window.crypto && typeof window.crypto.subtle !== 'undefined';
  var hasObjectFromEntries = typeof Object.fromEntries !== 'undefined';

  var isCompatible = hasPromise && hasWebSockets && hasWebCrypto && hasObjectFromEntries;

  if (isCompatible || (window.localStorage && window.localStorage.getItem('tt-ignore-compat'))) {
    window.isCompatTestPassed = true;
    return;
  }

  if (window.console && console.warn) {
    console.warn('Compatibility test report:');
    console.warn('Promise', hasPromise);
    console.warn('WebSocket', hasWebSockets);
    console.warn('WebCrypto', hasWebCrypto);
    console.warn('Object.fromEntries', hasObjectFromEntries);
  }

  document.body.innerHTML = '<iframe src="./unsupported.html" width="100%" height="100%">';
}

compatTest();
