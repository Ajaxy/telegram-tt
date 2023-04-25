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

import type * as eac from './encoded-audio-chunk';
import * as evc from './encoded-video-chunk';
import * as vf from './video-frame';
import * as vdec from './video-decoder';

/**
 * A VideoDecoder environment.
 */
export interface VideoDecoderEnvironment {
  VideoDecoder: typeof vdec.VideoDecoder;
  EncodedVideoChunk: typeof evc.EncodedVideoChunk;
  VideoFrame: typeof vf.VideoFrame;
}

/**
 * Error thrown to indicate a configuration is unsupported.
 */
export class UnsupportedException extends Error {
  constructor() {
    super('The requested configuration is not supported');
  }
}

/**
 * Get an VideoDecoder environment that supports this configuration. Throws an
 * UnsupportedException if no environment supports the configuration.
 * @param config  Video decoder configuration
 */
export async function getVideoDecoder(
  config: vdec.VideoDecoderConfig,
): Promise<VideoDecoderEnvironment> {
  try {
    if (
      typeof (<any>global).VideoDecoder !== 'undefined'
      && (await (<any>global).VideoDecoder.isConfigSupported(config)).supported
    ) {
      return {
        VideoDecoder: (<any>global).VideoDecoder,
        EncodedVideoChunk: (<any>global).EncodedVideoChunk,
        VideoFrame: (<any>global).VideoFrame,
      };
    }
  } catch (ex) {}

  if ((await vdec.VideoDecoder.isConfigSupported(config)).supported) {
    return {
      VideoDecoder: vdec.VideoDecoder,
      EncodedVideoChunk: evc.EncodedVideoChunk,
      VideoFrame: vf.VideoFrame,
    };
  }

  throw new UnsupportedException();
}
