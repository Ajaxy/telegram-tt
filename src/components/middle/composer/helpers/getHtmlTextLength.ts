import { fixImageContent } from '../../../../util/parseHtmlAsFormattedText';

const div = document.createElement('div');

export function getHtmlTextLength(html: string) {
  div.innerHTML = html;
  fixImageContent(div);
  div.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });
  return div.textContent?.trim().length || 0;
}
