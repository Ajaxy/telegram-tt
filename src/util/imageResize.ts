export function scaleImage(image: string | Blob, ratio: number, outputType: string = 'image/png'): Promise<string> {
  const url = image instanceof Blob ? URL.createObjectURL(image) : image;
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      scale(img, img.width * ratio, img.height * ratio, outputType)
        .then((blob) => URL.createObjectURL(blob))
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
        .then((blob) => URL.createObjectURL(blob))
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
) {
  // Safari does not have built-in resize method with quality control
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await window.createImageBitmap(img,
        { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
      return await new Promise((res) => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('bitmaprenderer');
        if (ctx) {
          ctx.transferFromImageBitmap(bitmap);
        } else {
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        }
        canvas.toBlob(res, outputType);
      });
    } catch (e) {
      // Fallback. Firefox below 93 does not recognize `createImageBitmap` with 2 parameters
      return steppedScale(img, width, height, 0.5, outputType);
    }
  } else {
    return steppedScale(img, width, height, 0.5, outputType);
  }
}

function steppedScale(
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

  return new Promise((resolve) => {
    canvas.toBlob(resolve, outputType);
  });
}
