const SELECTED_APPENDIX_BACKGROUND = Promise.resolve('rgba(255,255,255,1)');

export default function getCustomAppendixBg(src: string, isOwn: boolean, inSelectMode?: boolean, isSelected?: boolean) {
  return isSelected ? SELECTED_APPENDIX_BACKGROUND : getAppendixColorFromImage(src, isOwn);
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
