// @ts-nocheck

/*
 * This file is part of the libav.js WebCodecs Polyfill implementation. The
 * interface implemented is derived from the W3C standard. No attribution is
 * required when using this library.
 *
 * Copyright (c) 2021 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import type * as LibAVJS from '../libav.types';
import * as vf from './video-frame';

declare let LibAV: LibAVJS.LibAVWrapper;

/* A non-threaded libav.js instance for scaling. This is an any because the
 * type definitions only expose the async versions, but this API requires the
 * _sync methods. */
let scalerSync: any = null;

// A synchronous libav.js instance for scaling.
let scalerAsync: LibAVJS.LibAV = null;

// The original drawImage
const origDrawImage: any = null;

// The original createImageBitmap
let origCreateImageBitmap: any = null;

/**
 * Load rendering capability.
 * @param libavOptions  Options to use while loading libav, only asynchronous
 * @param polyfill  Set to polyfill CanvasRenderingContext2D.drawImage
 */
export async function load(libavOptions: any, polyfill: boolean) {
  // Get our scalers
  scalerSync = await LibAV.LibAV({ noworker: true });
  scalerAsync = await LibAV.LibAV(libavOptions);

  // Polyfill createImageBitmap
  origCreateImageBitmap = global.createImageBitmap;
  if (polyfill) {
    (<any>global).createImageBitmap = createImageBitmap;
  }
}

/**
 * Create an ImageBitmap from this drawable, asynchronously. NOTE:
 * Sub-rectangles are not implemented for VideoFrames, so only options is
 * available, and there, only scaling is available.
 * @param image  VideoFrame (or anything else) to draw
 * @param options  Other options
 */
export function createImageBitmap(
  image: vf.VideoFrame,
  opts: {
    resizeWidth?: number;
    resizeHeight?: number;
  } = {},
): Promise<ImageBitmap> {
  if (!(image instanceof vf.VideoFrame)) {
    // Just use the original
    return origCreateImageBitmap.apply(global, arguments);
  }

  // Convert the format to libav.js
  let format: number = scalerAsync.AV_PIX_FMT_RGBA;
  switch (image.format) {
    case 'I420':
      format = scalerAsync.AV_PIX_FMT_YUV420P;
      break;

    case 'I420A':
      format = scalerAsync.AV_PIX_FMT_YUVA420P;
      break;

    case 'I422':
      format = scalerAsync.AV_PIX_FMT_YUV422P;
      break;

    case 'I444':
      format = scalerAsync.AV_PIX_FMT_YUV444P;
      break;

    case 'NV12':
      format = scalerAsync.AV_PIX_FMT_NV12;
      break;

    case 'RGBA':
    case 'RGBX':
      format = scalerAsync.AV_PIX_FMT_RGBA;
      break;

    case 'BGRA':
    case 'BGRX':
      format = scalerAsync.AV_PIX_FMT_BGRA;
      break;
  }

  // Normalize arguments
  const dWidth = typeof opts.resizeWidth === 'number' ? opts.resizeWidth : image.displayWidth;
  const dHeight = typeof opts.resizeHeight === 'number' ? opts.resizeHeight : image.displayHeight;

  // Convert the frame
  const frameData = new ImageData(dWidth, dHeight);

  return (async () => {
    const [sctx, inFrame, outFrame] = await Promise.all([
      scalerAsync.sws_getContext(
        image.codedWidth,
        image.codedHeight,
        format,
        dWidth,
        dHeight,
        scalerAsync.AV_PIX_FMT_RGBA,
        2,
        0,
        0,
        0,
      ),
      scalerAsync.av_frame_alloc(),
      scalerAsync.av_frame_alloc(),
    ]);

    // Convert the data (FIXME: duplication)
    const rawU8 = image._libavGetData();
    let rawIdx = 0;
    const raw: Uint8Array[][] = [];
    const planes = vf.numPlanes(image.format);
    for (let p = 0; p < planes; p++) {
      const plane: Uint8Array[] = [];
      raw.push(plane);
      const sb = vf.sampleBytes(image.format, p);
      const hssf = vf.horizontalSubSamplingFactor(image.format, p);
      const vssf = vf.verticalSubSamplingFactor(image.format, p);
      const w = ~~((image.codedWidth * sb) / hssf);
      const h = ~~(image.codedHeight / vssf);
      for (let y = 0; y < h; y++) {
        plane.push(rawU8.subarray(rawIdx, rawIdx + w));
        rawIdx += w;
      }
    }

    const [, , frame] = await Promise.all([
      // Copy it in
      scalerAsync.ff_copyin_frame(inFrame, {
        data: raw,
        format,
        width: image.codedWidth,
        height: image.codedHeight,
      }),

      // Rescale
      scalerAsync.sws_scale_frame(sctx, outFrame, inFrame),

      // Get the data back out again
      scalerAsync.ff_copyout_frame(outFrame),

      // And clean up
      scalerAsync.av_frame_free_js(outFrame),
      scalerAsync.av_frame_free_js(inFrame),
      scalerAsync.sws_freeContext(sctx),
    ]);

    // Transfer all the data
    let idx = 0;
    for (let i = 0; i < frame.data.length; i++) {
      const plane = frame.data[i];
      for (let y = 0; y < plane.length; y++) {
        const row = plane[y].subarray(0, image.codedWidth * 4);
        frameData.data.set(row, idx);
        idx += row.length;
      }
    }

    // And make the ImageBitmap
    return await origCreateImageBitmap(frameData);
  })();
}
