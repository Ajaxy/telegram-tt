let isWebpSupportedCache: boolean | undefined;

export function isWebpSupported() {
  return Boolean(isWebpSupportedCache);
}

function testWebp(): Promise<boolean> {
  return new Promise((resolve) => {
    const webp = new Image();
    // eslint-disable-next-line max-len
    webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    const handleLoadOrError = () => {
      resolve(webp.height === 2);
    };
    webp.onload = handleLoadOrError;
    webp.onerror = handleLoadOrError;
  });
}

testWebp().then((hasWebp) => {
  isWebpSupportedCache = hasWebp;
});
