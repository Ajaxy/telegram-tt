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

export class EncodedAudioChunk {
  constructor(init: EncodedAudioChunkInit) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration || 0;
    const data = (this._data = new Uint8Array(
      (<any>init.data).buffer || init.data,
      (<any>init.data).byteOffset || 0
    ));
    this.byteLength = data.byteLength;
  }

  readonly type: EncodedAudioChunkType;

  readonly timestamp: number; // microseconds

  readonly duration?: number; // microseconds

  readonly byteLength: number;

  private _data: Uint8Array;

  // Internal
  _libavGetData() {
    return this._data;
  }

  copyTo(destination: BufferSource) {
    new Uint8Array(
      (<any>destination).buffer || destination,
      (<any>destination).byteOffset || 0
    ).set(this._data);
  }
}

export interface EncodedAudioChunkInit {
  type: EncodedAudioChunkType;
  timestamp: number; // microseconds
  duration?: number; // microseconds
  data: BufferSource;
}

export type EncodedAudioChunkType = 'key' | 'delta';
