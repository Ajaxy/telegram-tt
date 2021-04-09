// eslint-disable-next-line max-len
const SAMPLE_OWN = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" id="b"/></defs><g fill="none" fill-rule="evenodd"><use fill="#000" filter="url(#a)" xlink:href="#b"/><use fill="{FILL}" xlink:href="#b"/></g></svg>';
// eslint-disable-next-line max-len
const SAMPLE_NOT_OWN = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" id="b"/></defs><g fill="none" fill-rule="evenodd"><use fill="#000" filter="url(#a)" xlink:href="#b"/><use fill="{FILL}" xlink:href="#b"/></g></svg>';
// eslint-disable-next-line max-len
const SAMPLE_OWN_SELECTED = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter><path d="M6 17.5H0V0c .193 3.84.876 5.767 2.05 9.782.904 2.325 2.446 4.485 4.925 6.95A1 1 0 017 17.5z" id="b" stroke="white" stroke-width="1" stroke-dasharray="36 15" stroke-dashoffset="30"/></defs><g fill="none" fill-rule="evenodd"><use fill="#000" filter="url(#a)" xlink:href="#b"/><use fill="{FILL}" xlink:href="#b"/></g></svg>';
// eslint-disable-next-line max-len
const SAMPLE_NOT_OWN_SELECTED = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter><path d="M3 17.5h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17.5z" id="b" stroke="white" stroke-width="1" stroke-dasharray="36 15" stroke-dashoffset="30"/></defs><g fill="none" fill-rule="evenodd"><use fill="#000" filter="url(#a)" xlink:href="#b"/><use fill="{FILL}" xlink:href="#b"/></g></svg>';

const SELECTED_APPENDIX_BACKGROUND = 'rgba(255,255,255,1)';

export default async (src: string, isOwn: boolean, inSelectMode?: boolean, isSelected?: boolean) => {
  const color = isSelected ? SELECTED_APPENDIX_BACKGROUND : await getAppendixColorFromImage(src, isOwn);
  let svg;
  if (inSelectMode) {
    svg = (isOwn ? SAMPLE_OWN_SELECTED : SAMPLE_NOT_OWN_SELECTED);
  } else {
    svg = (isOwn ? SAMPLE_OWN : SAMPLE_NOT_OWN);
  }
  svg = svg.replace('{FILL}', color);
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
};

async function getAppendixColorFromImage(src: string, isOwn: boolean) {
  const img = new Image();
  img.src = src;

  if (!img.width) {
    await new Promise((resolve) => {
      img.onload = resolve;
    });
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0, img.width, img.height);

  const x = isOwn ? img.width - 1 : 0;
  const y = img.height - 1;

  const pixel = Array.from(ctx.getImageData(x, y, 1, 1).data);
  return `rgba(${pixel.join(',')})`;
}
