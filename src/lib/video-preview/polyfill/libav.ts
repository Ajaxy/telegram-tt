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

declare let LibAV: LibAVJS.LibAVWrapper;

// Currently available libav instances
const libavs: LibAVJS.LibAV[] = [];

// Options required to create a LibAV instance
let libavOptions: any = {};

/**
 * Supported decoders.
 */
export let decoders: string[] = null;

/**
 * libav.js-specific codec request, used to bypass the codec registry and use
 * anything your implementation of libav.js supports.
 */
export interface LibAVJSCodec {
  codec: string;
  ctx?: LibAVJS.AVCodecContextProps;
  options?: Record<string, string>;
}

/**
 * Set the libav loading options.
 */
export function setLibAVOptions(to: any) {
  libavOptions = to;
}

/**
 * Get a libav instance.
 */
export async function get(): Promise<LibAVJS.LibAV> {
  if (libavs.length) {
    return libavs.shift();
  }
  return LibAV.LibAV(libavOptions);
}

/**
 * Free a libav instance for later reuse.
 */
export function free(libav: LibAVJS.LibAV) {
  libavs.push(libav);
}

/**
 * Get the list of encoders/decoders supported by libav (which are also
 * supported by this polyfill)
 */
async function codecs(): Promise<string[]> {
  const libav = await get();
  const ret: string[] = [];

  for (const [avname, codec] of [
    ['libaom-av1', 'av01'],
    ['h264', 'avc1'],
    ['hevc', 'hvc1'],
  ]) {
    if (await libav.avcodec_find_decoder_by_name(avname)) {
      ret.push(codec);
    }
  }

  free(libav);
  return ret;
}

/**
 * Load the lists of supported decoders and encoders.
 */
export async function load() {
  decoders = await codecs();
}

/**
 * Convert a decoder from the codec registry (or libav.js-specific parameters)
 * to libav.js. Returns null if unsupported.
 */
export function decoder(codec: string | { libavjs: LibAVJSCodec }): LibAVJSCodec {
  if (typeof codec === 'string') {
    codec = codec.replace(/\..*/, '');

    let outCodec: string = codec;
    switch (codec) {
      // Video
      case 'av01':
        outCodec = 'libaom-av1';
        break;
      case 'avc1':
        outCodec = 'h264';
        break;

      case 'hvc1':
        outCodec = 'hevc';
        break;

      // Unrecognized
      default:
        return null;
    }

    // Check whether we actually support this codec
    if (!(decoders.indexOf(codec) >= 0)) {
      return null;
    }

    return { codec: outCodec };
  } else {
    return codec.libavjs;
  }
}
