function compatTest() {
  var hasPromise = typeof Promise !== 'undefined';
  var hasWebSockets = typeof WebSocket !== 'undefined';
  var hasWebCrypto = window.crypto && typeof window.crypto.subtle !== 'undefined';
  var hasObjectFromEntries = typeof Object.fromEntries !== 'undefined';
  var hasResizeObserver = typeof window.ResizeObserver !== 'undefined';
  var hasCssSupports = window.CSS && typeof window.CSS.supports === 'function';
  var hasIntl = typeof window.Intl !== 'undefined';
  var hasDisplayNames = hasIntl && typeof Intl.DisplayNames !== 'undefined';

  var isCompatible = hasPromise && hasWebSockets && hasWebCrypto && hasObjectFromEntries && hasResizeObserver
    && hasCssSupports && hasDisplayNames;

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
    console.warn('ResizeObserver', hasResizeObserver);
    console.warn('CSS.supports', hasCssSupports);
    console.warn('Intl.DisplayNames', hasDisplayNames);
  }

  // Hardcoded page because server forbids iframe embedding
  document.title = 'Unsupported Browser';
  document.body.setAttribute('style', 'height: 100%; margin: 0; font-family: Arial, Helvetica, sans-serif;');
  document.body.innerHTML = '<table style="width:100%;height:100%;border-collapse:collapse"><tr><td style="vertical-align:middle;text-align:center"><div style="display:inline-block"><img src=./unsupported.png><h3>Your browser is not supported</h3><p>Please, update it or use our <a href="http://telegram.org/dl" target="_blank">native clients</a>.</p><a id="ignore" href="#">I\'m Feeling Lucky</a></div></table>';

  if (!window.ignore) return;
  if (!window.ignore.addEventListener) {
    window.ignore.style.display = 'none';
    return;
  }

  window.ignore.addEventListener('click', function() {
    window.localStorage.setItem('tt-ignore-compat', '1');
    window.location.reload();
  });
}

compatTest();
