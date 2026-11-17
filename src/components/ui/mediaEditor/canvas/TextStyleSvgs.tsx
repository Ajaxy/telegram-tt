/* eslint-disable @stylistic/max-len */

const LETTER_PATH = 'M12 5.67c.34 0 .64.2.77.52l4.5 11a.83.83 0 0 1-1.54.62l-1.22-2.98H9.5l-1.22 2.98a.83.83 0 0 1-1.54-.62l4.5-11 .06-.12c.15-.24.42-.4.71-.4m-1.83 7.5h3.66L12 8.69z';
const FRAME_PATH = 'M15.7 3.5c1.68 0 2.52 0 3.16.33a3 3 0 0 1 1.31 1.3c.33.65.33 1.49.33 3.17v7.4c0 1.68 0 2.52-.33 3.16a3 3 0 0 1-1.3 1.31c-.65.33-1.49.33-3.17.33H8.3c-1.68 0-2.52 0-3.16-.33a3 3 0 0 1-1.31-1.3c-.33-.65-.33-1.49-.33-3.17V8.3c0-1.68 0-2.52.33-3.16a3 3 0 0 1 1.3-1.31c.65-.33 1.49-.33 3.17-.33zM12 5.67c-.3 0-.56.16-.71.4l-.06.12-4.5 11a.83.83 0 0 0 1.54.62l1.22-2.98h5.02l1.22 2.98a.83.83 0 0 0 1.54-.62l-4.5-11a.8.8 0 0 0-.77-.52m1.83 7.5h-3.66L12 8.69z';

export function TextPlainSvg() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
      <path d={LETTER_PATH} />
    </svg>
  );
}

export function TextFilledSvg() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
      <path d={FRAME_PATH} />
    </svg>
  );
}

export function TextSemiSvg() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
      <path d={FRAME_PATH} fill-opacity="0.4" />
      <path d={LETTER_PATH} />
    </svg>
  );
}
