import { ISettings } from '../../../../types';

const SELECTED_APPENDIX_COLORS = {
  dark: {
    outgoing: 'rgb(135,116,225)',
    incoming: 'rgb(33,33,33)',
  },
  light: {
    outgoing: 'rgb(238,255,222)',
    incoming: 'rgb(255,255,255)',
  },
};

export default function getCustomAppendixBg(
  src: string, isOwn: boolean, inSelectMode?: boolean, isSelected?: boolean, theme?: ISettings['theme'],
) {
  if (isSelected) {
    return Promise.resolve(SELECTED_APPENDIX_COLORS[theme || 'light'][isOwn ? 'outgoing' : 'incoming']);
  }
  return getAppendixColorFromImage(src, isOwn);
}

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
