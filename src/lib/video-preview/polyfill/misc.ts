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

export type CodecState = 'unconfigured' | 'configured' | 'closed';

export type WebCodecsErrorCallback = (error: DOMException) => void;

/**
 * Clone this configuration. Just copies over the supported/recognized fields.
 */
export function cloneConfig(config: any, fields: string[]): any {
  const ret: any = {};
  for (const field of fields) {
    if (field in config) {
      ret[field] = config[field];
    }
  }
  return ret;
}
