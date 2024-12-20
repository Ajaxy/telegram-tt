/* eslint-disable no-bitwise */

// eslint-disable-next-line max-len
const TEMPLATE = '<?xml version="1.0" encoding="utf-8"?><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {{width}} {{height}}" xml:space="preserve"><path fill-opacity="0.1" d="{{path}}" /></svg>';
const LOOKUP = 'AACAAAAHAAALMAAAQASTAVAAAZaacaaaahaaalmaaaqastava.az0123456789-,';

export function pathBytesToSvg(bytes: Buffer, width: number, height: number) {
  return TEMPLATE
    .replace('{{path}}', buildSvgPath(bytes))
    .replace('{{width}}', String(width))
    .replace('{{height}}', String(height));
}

export function buildSvgPath(bytes: Buffer) {
  let path = 'M';

  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    const num = bytes[i];
    if (num >= 128 + 64) {
      path += LOOKUP[num - 128 - 64];
    } else {
      if (num >= 128) {
        path += ',';
      } else if (num >= 64) {
        path += '-';
      }
      path += String(num & 63);
    }
  }

  path += 'z';

  return path;
}
