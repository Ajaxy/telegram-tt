import { getAverageColor, getColorLuma } from './colors';

const LUMA_THRESHOLD = 240;

export function scaleImage(image: string | Blob, ratio: number, outputType: string = 'image/png'): Promise<string> {
  const url = image instanceof Blob ? URL.createObjectURL(image) : image;
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      scale(img, img.width * ratio, img.height * ratio, outputType)
        .then((blob) => {
          if (!blob) throw new Error('Image resize failed!');
          return URL.createObjectURL(blob);
        })
        .then(resolve)
        .finally(() => {
          if (image instanceof Blob) {
            URL.revokeObjectURL(url); // Revoke blob url that we created
          }
        });
    };
    img.src = url;
  });
}

export function resizeImage(
  image: string | Blob, width: number, height: number, outputType: string = 'image/png',
): Promise<string> {
  const url = image instanceof Blob ? URL.createObjectURL(image) : image;
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      scale(img, width, height, outputType)
        .then((blob) => {
          if (!blob) throw new Error('Image resize failed!');
          return URL.createObjectURL(blob);
        })
        .then(resolve)
        .finally(() => {
          if (image instanceof Blob) {
            URL.revokeObjectURL(url); // Revoke blob url that we created
          }
        });
    };
    img.src = url;
  });
}

async function scale(
  img: HTMLImageElement, width: number, height: number, outputType: string = 'image/png',
): Promise<Blob | null> {
  // Safari does not have built-in resize method with quality control
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await window.createImageBitmap(img,
        { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
      if (bitmap.height !== height || bitmap.width !== width) {
        throw new Error('Image bitmap resize not supported!'); // FF93 added support for options, but not resize
      }
      const averageColor = await getAverageColor(img.src);
      const fillColor = getColorLuma(averageColor) < LUMA_THRESHOLD ? '#fff' : '#000';
      return await new Promise((res) => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx2D = canvas.getContext('2d')!;
        ctx2D.fillStyle = fillColor;
        ctx2D.fillRect(0, 0, canvas.width, canvas.height);
        const ctx = canvas.getContext('bitmaprenderer');
        if (ctx) {
          ctx.transferFromImageBitmap(bitmap);
        } else {
          ctx2D.drawImage(bitmap, 0, 0);
        }
        canvas.toBlob(res, outputType);
      });
    } catch (e) {
      // Fallback. Firefox below 93 does not recognize `createImageBitmap` with 2 parameters
      return steppedScale(img, width, height, undefined, outputType);
    }
  } else {
    return steppedScale(img, width, height, undefined, outputType);
  }
}

async function steppedScale(
  img: HTMLImageElement, width: number, height: number, step: number = 0.5, outputType: string = 'image/png',
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const oc = document.createElement('canvas');
  const octx = oc.getContext('2d')!;

  canvas.width = width;
  canvas.height = height;

  if (img.width * step > width) { // For performance avoid unnecessary drawing
    const mul = 1 / step;
    let cur = {
      width: Math.floor(img.width * step),
      height: Math.floor(img.height * step),
    };

    oc.width = cur.width;
    oc.height = cur.height;

    octx.drawImage(img, 0, 0, cur.width, cur.height);

    while (cur.width * step > width) {
      cur = {
        width: Math.floor(cur.width * step),
        height: Math.floor(cur.height * step),
      };
      octx.drawImage(oc, 0, 0, cur.width * mul, cur.height * mul, 0, 0, cur.width, cur.height);
    }

    ctx.drawImage(oc, 0, 0, cur.width, cur.height, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  const averageColor = await getAverageColor(img.src);
  const fillColor = getColorLuma(averageColor) < LUMA_THRESHOLD ? '#fff' : '#000';
  ctx.fillStyle = fillColor;
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, outputType);
  });
}
