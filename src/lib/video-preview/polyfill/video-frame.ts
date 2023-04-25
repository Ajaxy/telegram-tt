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

// A canvas element used to convert CanvasImageSources to buffers
let offscreenCanvas: HTMLCanvasElement = null;

export class VideoFrame {
  constructor(data: CanvasImageSource | BufferSource, init: VideoFrameInit | VideoFrameBufferInit) {
    if (data instanceof ArrayBuffer || (<any>data).buffer instanceof ArrayBuffer) {
      this._constructBuffer(<BufferSource>data, <VideoFrameBufferInit>init);
    } else {
      this._constructCanvas(<CanvasImageSource>data, <VideoFrameInit>init);
    }
  }

  private _constructCanvas(image: any, init: VideoFrameInit) {
    if (offscreenCanvas === null) {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.style.display = 'none';
      document.body.appendChild(offscreenCanvas);
    }

    // Convert it to a buffer

    // Get the width and height
    let width = 0;
    let height = 0;
    if (image.naturalWidth) {
      width = image.naturalWidth;
      height = image.naturalHeight;
    } else if (image.videoWidth) {
      width = image.videoWidth;
      height = image.videoHeight;
    } else if (image.width) {
      width = image.width;
      height = image.height;
    }
    if (!width || !height) {
      throw new DOMException('Could not determine dimensions', 'InvalidStateError');
    }

    // Draw it
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx = offscreenCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);
    this._constructBuffer(ctx.getImageData(0, 0, width, height).data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: init.timestamp,
      duration: init.duration || 0,
      layout: [
        {
          offset: 0,
          stride: width * 4
        }
      ],
      displayWidth: init.displayWidth || width,
      displayHeight: init.displayHeight || height
    });
  }

  private _constructBuffer(data: BufferSource, init: VideoFrameBufferInit) {
    const format = (this.format = init.format);
    const width = (this.codedWidth = init.codedWidth);
    const height = (this.codedHeight = init.codedHeight);
    this.visibleRect = new DOMRect(0, 0, width, height);

    const dWidth = (this.displayWidth = init.displayWidth || init.codedWidth);
    const dHeight = (this.displayHeight = init.displayHeight || init.codedHeight);

    // Account for non-square pixels
    if (dWidth !== width || dHeight !== height) {
      // Dubious (but correct) SAR calculation
      this._nonSquarePixels = true;
      this._sar_num = dWidth * height;
      this._sar_den = dHeight * width;
    } else {
      this._nonSquarePixels = false;
    }

    this.timestamp = init.timestamp;
    if (init.duration) {
      this.duration = init.duration;
    }

    if (init.layout) {
      this._layout = init.layout; // FIXME: Make sure it's the right size
    } else {
      const numPlanes_ = numPlanes(format);
      const layout: PlaneLayout[] = [];
      let offset = 0;
      for (let i = 0; i < numPlanes_; i++) {
        const sampleWidth = horizontalSubSamplingFactor(format, i);
        const sampleHeight = verticalSubSamplingFactor(format, i);
        const stride = ~~(width / sampleWidth);
        layout.push({
          offset,
          stride
        });
        offset += stride * ~~(height / sampleHeight);
      }
      this._layout = layout;
    }

    this._data = new Uint8Array((<any>data).buffer || data, (<any>data).byteOffset || 0);
  }

  /* NOTE: These should all be readonly, but the constructor style above
   * doesn't work with that */
  format: VideoPixelFormat;

  codedWidth: number;

  codedHeight: number;

  codedRect: DOMRectReadOnly;

  visibleRect: DOMRectReadOnly;

  displayWidth: number;

  displayHeight: number;

  duration: number; // microseconds

  timestamp: number; // microseconds

  colorSpace: VideoColorSpace;

  private _layout: PlaneLayout[];

  private _data: Uint8Array;

  /**
   * (Internal) Does this use non-square pixels?
   */
  _nonSquarePixels: boolean;

  /**
   * (Internal) If non-square pixels, the SAR (sample/pixel aspect ratio)
   */
  _sar_num: number;

  _sar_den: number;

  // Internal
  _libavGetData() {
    return this._data;
  }

  allocationSize(options: VideoFrameCopyToOptions = {}): number {
    // 1. If [[Detached]] is true, throw an InvalidStateError DOMException.
    if (this._data === null) {
      throw new DOMException('Detached', 'InvalidStateError');
    }

    // 2. If [[format]] is null, throw a NotSupportedError DOMException.
    if (this.format === null) {
      throw new DOMException('Not supported', 'NotSupportedError');
    }

    /* 3. Let combinedLayout be the result of running the Parse
     * VideoFrameCopyToOptions algorithm with options. */
    // 4. If combinedLayout is an exception, throw combinedLayout.
    const combinedLayout = this._parseVideoFrameCopyToOptions(options);

    // 5. Return combinedLayout’s allocationSize.
    return combinedLayout.allocationSize;
  }

  private _parseVideoFrameCopyToOptions(options: VideoFrameCopyToOptions) {
    /* 1. Let defaultRect be the result of performing the getter steps for
     * visibleRect. */
    const defaultRect = this.visibleRect;

    // 2. Let overrideRect be undefined.
    // 3. If options.rect exists, assign its value to overrideRect.
    const overrideRect: DOMRectReadOnly = options.rect
      ? new DOMRect(options.rect.x, options.rect.y, options.rect.width, options.rect.height)
      : null;

    /* 4. Let parsedRect be the result of running the Parse Visible Rect
     * algorithm with defaultRect, overrideRect, [[coded width]], [[coded
     * height]], and [[format]]. */
    // 5. If parsedRect is an exception, return parsedRect.
    const parsedRect = this._parseVisibleRect(defaultRect, overrideRect);

    // 6. Let optLayout be undefined.
    // 7. If options.layout exists, assign its value to optLayout.
    const optLayout = options.layout || null;

    /* 8. Let combinedLayout be the result of running the Compute Layout
     * and Allocation Size algorithm with parsedRect, [[format]], and
     * optLayout. */
    const combinedLayout = this._computeLayoutAndAllocationSize(parsedRect, optLayout);

    // 9. Return combinedLayout.
    return combinedLayout;
  }

  private _parseVisibleRect(defaultRect: DOMRectReadOnly, overrideRect: DOMRectReadOnly) {
    // 1. Let sourceRect be defaultRect
    let sourceRect = defaultRect;

    // 2. If overrideRect is not undefined:
    if (overrideRect) {
      /* 1. If either of overrideRect.width or height is 0, return a
       * TypeError. */
      if (overrideRect.width === 0 || overrideRect.height === 0) {
        throw new TypeError('Invalid rectangle');
      }

      /* 2. If the sum of overrideRect.x and overrideRect.width is
       * greater than [[coded width]], return a TypeError. */
      if (overrideRect.x + overrideRect.width > this.codedWidth) {
        throw new TypeError('Invalid rectangle');
      }

      /* 3. If the sum of overrideRect.y and overrideRect.height is
       * greater than [[coded height]], return a TypeError. */
      if (overrideRect.y + overrideRect.height > this.codedHeight) {
        throw new TypeError('Invalid rectangle');
      }

      // 4. Assign overrideRect to sourceRect.
      sourceRect = overrideRect;
    }

    /* 3. Let validAlignment be the result of running the Verify Rect
     * Sample Alignment algorithm with format and sourceRect. */
    const validAlignment = this._verifyRectSampleAlignment(sourceRect);

    // 4. If validAlignment is false, throw a TypeError.
    if (!validAlignment) {
      throw new TypeError('Invalid alignment');
    }

    // 5. Return sourceRect.
    return sourceRect;
  }

  private _computeLayoutAndAllocationSize(parsedRect: DOMRectReadOnly, layout: PlaneLayout[]) {
    // 1. Let numPlanes be the number of planes as defined by format.
    const numPlanes_ = numPlanes(this.format);

    /* 2. If layout is not undefined and its length does not equal
     * numPlanes, throw a TypeError. */
    if (layout && layout.length !== numPlanes_) {
      throw new TypeError('Invalid layout');
    }

    // 3. Let minAllocationSize be 0.
    let minAllocationSize = 0;

    // 4. Let computedLayouts be a new list.
    const computedLayouts: ComputedPlaneLayout[] = [];

    // 5. Let endOffsets be a new list.
    const endOffsets = [];

    // 6. Let planeIndex be 0.
    let planeIndex = 0;

    // 7. While planeIndex < numPlanes:
    while (planeIndex < numPlanes_) {
      /* 1. Let plane be the Plane identified by planeIndex as defined by
       * format. */

      // 2. Let sampleBytes be the number of bytes per sample for plane.
      const sampleBytes_ = sampleBytes(this.format, planeIndex);

      /* 3. Let sampleWidth be the horizontal sub-sampling factor of each
       * subsample for plane. */
      const sampleWidth = horizontalSubSamplingFactor(this.format, planeIndex);

      /* 4. Let sampleHeight be the vertical sub-sampling factor of each
       * subsample for plane. */
      const sampleHeight = verticalSubSamplingFactor(this.format, planeIndex);

      /* 5. Let sampleWidthBytes be the product of multiplying
       * sampleWidth by sampleBytes. */
      const sampleWidthBytes = sampleWidth * sampleBytes_;

      // 6. Let computedLayout be a new computed plane layout.
      const computedLayout: ComputedPlaneLayout = {
        destinationOffset: 0,
        destinationStride: 0,

        /* 7. Set computedLayout’s sourceTop to the result of the
         * integer division of truncated parsedRect.y by sampleHeight. */
        sourceTop: ~~(parsedRect.y / sampleHeight),

        /* 8. Set computedLayout’s sourceHeight to the result of the
         * integer division of truncated parsedRect.height by
         * sampleHeight */
        sourceHeight: ~~(parsedRect.height / sampleHeight),

        /* 9. Set computedLayout’s sourceLeftBytes to the result of the
         * integer division of truncated parsedRect.x by
         * sampleWidthBytes. */
        sourceLeftBytes: ~~(parsedRect.x / sampleWidthBytes),

        /* 10. Set computedLayout’s sourceWidthBytes to the result of
         * the integer division of truncated parsedRect.width by
         * sampleWidthBytes. */
        sourceWidthBytes: ~~(parsedRect.width / sampleWidthBytes)
      };

      // 11. If layout is not undefined:
      if (layout) {
        /* 1. Let planeLayout be the PlaneLayout in layout at position
         * planeIndex. */
        const planeLayout = layout[planeIndex];

        /* 2. If planeLayout.stride is less than computedLayout’s
         * sourceWidthBytes, return a TypeError. */
        if (planeLayout.stride < computedLayout.sourceWidthBytes) {
          throw new TypeError('Invalid stride');
        }

        /* 3. Assign planeLayout.offset to computedLayout’s
         * destinationOffset. */
        computedLayout.destinationOffset = planeLayout.offset;

        /* 4. Assign planeLayout.stride to computedLayout’s
         * destinationStride. */
        computedLayout.destinationStride = planeLayout.stride;

        // 12. Otherwise:
      } else {
        /* 1. Assign minAllocationSize to computedLayout’s
         * destinationOffset. */
        computedLayout.destinationOffset = minAllocationSize;

        /* 2. Assign computedLayout’s sourceWidthBytes to
         * computedLayout’s destinationStride. */
        computedLayout.destinationStride = computedLayout.sourceWidthBytes;
      }

      /* 13. Let planeSize be the product of multiplying computedLayout’s
       * destinationStride and sourceHeight. */
      const planeSize = computedLayout.destinationStride * computedLayout.sourceHeight;

      /* 14. Let planeEnd be the sum of planeSize and computedLayout’s
       * destinationOffset. */
      const planeEnd = planeSize + computedLayout.destinationOffset;

      /* 15. If planeSize or planeEnd is greater than maximum range of
       * unsigned long, return a TypeError. */
      if (planeSize >= 0x100000000 || planeEnd >= 0x100000000) {
        throw new TypeError('Plane too large');
      }

      // 16. Append planeEnd to endOffsets.
      endOffsets.push(planeEnd);

      /* 17. Assign the maximum of minAllocationSize and planeEnd to
       * minAllocationSize. */
      if (planeEnd > minAllocationSize) {
        minAllocationSize = planeEnd;
      }

      // 18. Let earlierPlaneIndex be 0.
      let earlierPlaneIndex = 0;

      // 19. While earlierPlaneIndex is less than planeIndex.
      while (earlierPlaneIndex < planeIndex) {
        // 1. Let earlierLayout be computedLayouts[earlierPlaneIndex].
        const earlierLayout = computedLayouts[earlierPlaneIndex];

        /* 2. If endOffsets[planeIndex] is less than or equal to
         * earlierLayout’s destinationOffset or if
         * endOffsets[earlierPlaneIndex] is less than or equal to
         * computedLayout’s destinationOffset, continue. */
        if (
          planeEnd <= earlierLayout.destinationOffset ||
          endOffsets[earlierPlaneIndex] <= computedLayout.destinationOffset
        ) {
          // 3. Otherwise, return a TypeError.
        } else {
          throw new TypeError('Invalid plane layout');
        }

        // 4. Increment earlierPlaneIndex by 1.
        earlierPlaneIndex++;
      }

      // 20. Append computedLayout to computedLayouts.
      computedLayouts.push(computedLayout);

      // 21. Increment planeIndex by 1.
      planeIndex++;
    }

    /* 8. Let combinedLayout be a new combined buffer layout, initialized
     * as follows: */
    const combinedLayout = {
      // 1. Assign computedLayouts to computedLayouts.
      computedLayouts,

      // 2. Assign minAllocationSize to allocationSize.
      allocationSize: minAllocationSize
    };

    // 9. Return combinedLayout.
    return combinedLayout;
  }

  private _verifyRectSampleAlignment(rect: DOMRectReadOnly) {
    // 1. If format is null, return true.
    if (!this.format) {
      return true;
    }

    // 2. Let planeIndex be 0.
    let planeIndex = 0;

    // 3. Let numPlanes be the number of planes as defined by format.
    const numPlanes_ = numPlanes(this.format);

    // 4. While planeIndex is less than numPlanes:
    while (planeIndex < numPlanes_) {
      /* 1. Let plane be the Plane identified by planeIndex as defined by
       * format. */

      /* 2. Let sampleWidth be the horizontal sub-sampling factor of each
       * subsample for plane. */
      const sampleWidth = horizontalSubSamplingFactor(this.format, planeIndex);

      /* 3. Let sampleHeight be the vertical sub-sampling factor of each
       * subsample for plane. */
      const sampleHeight = verticalSubSamplingFactor(this.format, planeIndex);

      /* 4. If rect.x and rect.width are not both multiples of
       * sampleWidth, return false. */
      const xw = rect.x / sampleWidth;
      if (xw !== ~~xw) {
        return false;
      }
      const ww = rect.width / sampleWidth;
      if (ww !== ~~ww) {
        return false;
      }

      /* 5. If rect.y and rect.height are not both multiples of
       * sampleHeight, return false. */
      const yh = rect.y / sampleHeight;
      if (yh !== ~~yh) {
        return false;
      }
      const hh = rect.height / sampleHeight;
      if (hh !== ~~hh) {
        return false;
      }

      // 6. Increment planeIndex by 1.
      planeIndex++;
    }

    // 5. Return true.
    return true;
  }

  async copyTo(
    destination: BufferSource,
    options: VideoFrameCopyToOptions = {}
  ): Promise<PlaneLayout[]> {
    const destBuf = new Uint8Array(
      (<any>destination).buffer || destination,
      (<any>destination).byteOffset || 0
    );

    // 1. If [[Detached]] is true, throw an InvalidStateError DOMException.
    if (this._data === null) {
      throw new DOMException('Detached', 'InvalidStateError');
    }

    // 2. If [[format]] is null, throw a NotSupportedError DOMException.
    if (!this.format) {
      throw new DOMException('No format', 'NotSupportedError');
    }

    /* 3. Let combinedLayout be the result of running the Parse
     * VideoFrameCopyToOptions algorithm with options. */
    /* 4. If combinedLayout is an exception, return a promise rejected with
     * combinedLayout. */
    const combinedLayout = this._parseVideoFrameCopyToOptions(options);

    /* 5. If destination.byteLength is less than combinedLayout’s
     * allocationSize, return a promise rejected with a TypeError. */
    if (destination.byteLength < combinedLayout.allocationSize) {
      throw new TypeError('Insufficient space');
    }

    // 6. Let p be a new Promise.
    /* 7. Let copyStepsQueue be the result of starting a new parallel
     * queue. */
    // 8. Enqueue the following steps to copyStepsQueue:
    // NOTE: This is an async function anyway, so we can just do these.
    const ret: PlaneLayout[] = [];

    /* 1. Let resource be the media resource referenced by [[resource
     * reference]]. */

    // 2. Let numPlanes be the number of planes as defined by [[format]].
    const numPlanes_ = numPlanes(this.format);

    // 3. Let planeIndex be 0.
    let planeIndex = 0;

    // 4. While planeIndex is less than combinedLayout’s numPlanes:
    while (planeIndex < combinedLayout.computedLayouts.length) {
      /* 1. Let sourceStride be the stride of the plane in resource as
       * identified by planeIndex. */
      const sourceStride = this._layout[planeIndex].stride;

      /* 2. Let computedLayout be the computed plane layout in
       * combinedLayout’s computedLayouts at the position of planeIndex */
      const computedLayout = combinedLayout.computedLayouts[planeIndex];

      /* 3. Let sourceOffset be the product of multiplying
       * computedLayout’s sourceTop by sourceStride */
      let sourceOffset = computedLayout.sourceTop * sourceStride;

      // 4. Add computedLayout’s sourceLeftBytes to sourceOffset.
      sourceOffset += computedLayout.sourceLeftBytes;

      // 5. Let destinationOffset be computedLayout’s destinationOffset.
      let destinationOffset = computedLayout.destinationOffset;

      // 6. Let rowBytes be computedLayout’s sourceWidthBytes.
      const rowBytes = computedLayout.sourceWidthBytes;

      // 7. Let row be 0.
      let row = 0;

      // 8. While row is less than computedLayout’s sourceHeight:
      while (row < computedLayout.sourceHeight) {
        /* 1. Copy rowBytes bytes from resource starting at
         * sourceOffset to destination starting at destinationOffset. */
        destBuf.set(this._data.subarray(sourceOffset, sourceOffset + rowBytes), destinationOffset);

        // 2. Increment sourceOffset by sourceStride.
        sourceOffset += sourceStride;

        /* 3. Increment destinationOffset by computedLayout’s
         * destinationStride. */
        destinationOffset += computedLayout.destinationStride;

        // 4. Increment row by 1.
        row++;
      }

      // 9. Increment planeIndex by 1.
      planeIndex++;
      ret.push({
        offset: computedLayout.destinationOffset,
        stride: computedLayout.destinationStride
      });
    }

    // 5. Queue a task on the control thread event loop to resolve p.
    // 6. Return p.
    return ret;
  }

  clone(): VideoFrame {
    return new VideoFrame(this._data, {
      format: this.format,
      codedWidth: this.codedWidth,
      codedHeight: this.codedHeight,
      timestamp: this.timestamp,
      duration: this.duration,
      layout: this._layout
    });
  }

  close(): void {
    this._data = null;
  }
}

export interface VideoFrameInit {
  duration?: number; // microseconds
  timestamp: number; // microseconds
  // FIXME: AlphaOption alpha = "keep";

  // Default matches image. May be used to efficiently crop. Will trigger
  // new computation of displayWidth and displayHeight using image’s pixel
  // aspect ratio unless an explicit displayWidth and displayHeight are given.
  visibleRect?: DOMRectInit;

  // Default matches image unless visibleRect is provided.
  displayWidth?: number;
  displayHeight?: number;
}

export interface VideoFrameBufferInit {
  format: VideoPixelFormat;
  codedWidth: number;
  codedHeight: number;
  timestamp: number; // microseconds
  duration?: number; // microseconds

  // Default layout is tightly-packed.
  layout?: PlaneLayout[];

  // Default visible rect is coded size positioned at (0,0)
  visibleRect?: DOMRectInit;

  // Default display dimensions match visibleRect.
  displayWidth?: number;
  displayHeight?: number;

  // FIXME: Not used
  colorSpace?: VideoColorSpaceInit;
}

export type VideoPixelFormat =
  // 4:2:0 Y, U, V
  | 'I420'
  // 4:2:0 Y, U, V, A
  | 'I420A'
  // 4:2:2 Y, U, V
  | 'I422'
  // 4:4:4 Y, U, V
  | 'I444'
  // 4:2:0 Y, UV
  | 'NV12'
  // 32bpp RGBA
  | 'RGBA'
  // 32bpp RGBX (opaque)
  | 'RGBX'
  // 32bpp BGRA
  | 'BGRA'
  // 32bpp BGRX (opaque)
  | 'BGRX';

/**
 * Number of planes in the given format.
 * @param format  The format
 */
export function numPlanes(format: VideoPixelFormat) {
  switch (format) {
    case 'I420':
    case 'I422':
    case 'I444':
      return 3;

    case 'I420A':
      return 4;

    case 'NV12':
      return 2;

    case 'RGBA':
    case 'RGBX':
    case 'BGRA':
    case 'BGRX':
      return 1;

    default:
      throw new DOMException('Unsupported video pixel format', 'NotSupportedError');
  }
}

/**
 * Number of bytes per sample in the given format and plane.
 * @param format  The format
 * @param planeIndex  The plane index
 */
export function sampleBytes(format: VideoPixelFormat, planeIndex: number) {
  switch (format) {
    case 'I420':
    case 'I420A':
    case 'I422':
    case 'I444':
      return 1;

    case 'NV12':
      if (planeIndex === 1) {
        return 2;
      } else {
        return 1;
      }

    case 'RGBA':
    case 'RGBX':
    case 'BGRA':
    case 'BGRX':
      return 4;

    default:
      throw new DOMException('Unsupported video pixel format', 'NotSupportedError');
  }
}

/**
 * Horizontal sub-sampling factor for the given format and plane.
 * @param format  The format
 * @param planeIndex  The plane index
 */
export function horizontalSubSamplingFactor(format: VideoPixelFormat, planeIndex: number) {
  // First plane (often luma) is always full
  if (planeIndex === 0) {
    return 1;
  }

  switch (format) {
    case 'I420':
    case 'I422':
      return 2;

    case 'I420A':
      if (planeIndex === 3) {
        return 1;
      } else {
        return 2;
      }

    case 'I444':
      return 1;

    case 'NV12':
      return 2;

    case 'RGBA':
    case 'RGBX':
    case 'BGRA':
    case 'BGRX':
      return 1;

    default:
      throw new DOMException('Unsupported video pixel format', 'NotSupportedError');
  }
}

/**
 * Vertical sub-sampling factor for the given format and plane.
 * @param format  The format
 * @param planeIndex  The plane index
 */
export function verticalSubSamplingFactor(format: VideoPixelFormat, planeIndex: number) {
  // First plane (often luma) is always full
  if (planeIndex === 0) {
    return 1;
  }

  switch (format) {
    case 'I420':
      return 2;

    case 'I420A':
      if (planeIndex === 3) {
        return 1;
      } else {
        return 2;
      }

    case 'I422':
    case 'I444':
      return 1;

    case 'NV12':
      return 2;

    case 'RGBA':
    case 'RGBX':
    case 'BGRA':
    case 'BGRX':
      return 1;

    default:
      throw new DOMException('Unsupported video pixel format', 'NotSupportedError');
  }
}

/**
 * NOTE: Color space is not actually supported
 */
export type VideoColorSpace = any;
export type VideoColorSpaceInit = any;

export interface PlaneLayout {
  offset: number;
  stride: number;
}

export interface VideoFrameCopyToOptions {
  rect?: DOMRectInit;
  layout?: PlaneLayout[];
}

interface ComputedPlaneLayout {
  destinationOffset: number;
  destinationStride: number;
  sourceTop: number;
  sourceHeight: number;
  sourceLeftBytes: number;
  sourceWidthBytes: number;
}
