const RE_BR = /(<br>|<br\s?\/>)/g;
const RE_SPACE = /(&nbsp;|\u00A0)/g;
const RE_CLEAN_HTML = /(<div>|<\/div>)/gi;
const RE_EXTRA_NEW_LINE = /\n$/i;

export function prepareForRegExp(html: string) {
  return html
    .replace(RE_SPACE, ' ')
    .replace(RE_BR, '\n')
    .replace(RE_CLEAN_HTML, '')
    .replace(RE_EXTRA_NEW_LINE, '');
}
