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
import * as eac from './encoded-audio-chunk';

import * as evc from './encoded-video-chunk';
import * as vf from './video-frame';
import * as vdec from './video-decoder';

import * as rendering from './rendering';

import * as config from './config';
import * as libav from './libav';
import type * as misc from './misc';

declare let LibAV: LibAVJS.LibAVWrapper;

/**
 * Load LibAV-WebCodecs-Polyfill.
 */
export async function load(
  options: {
    polyfill?: boolean;
    libavOptions?: any;
  } = {},
) {
  // Set up libavOptions
  const libavOptions: any = {};
  if (options.libavOptions) {
    Object.assign(libavOptions, options.libavOptions);
  }

  // And load the libav handler
  libav.setLibAVOptions(libavOptions);
  await libav.load();

  if (options.polyfill) {
    for (const exp of [
      'EncodedVideoChunk',
      'VideoFrame',
      'VideoDecoder',
    ]) {
      if (!(global as any)[exp]) {
        (global as any)[exp] = (this as any)[exp];
      }
    }
  }

  await rendering.load(libavOptions, !!options.polyfill);
}

// EncodedVideoChunk
export type EncodedVideoChunk = evc.EncodedVideoChunk;
export const EncodedVideoChunk = evc.EncodedVideoChunk;
export type EncodedVideoChunkInit = evc.EncodedVideoChunkInit;

// VideoFrame
export type VideoFrame = vf.VideoFrame;
export const VideoFrame = vf.VideoFrame;
export type VideoFrameInit = vf.VideoFrameInit;
export type VideoFrameBufferInit = vf.VideoFrameBufferInit;
export type VideoPixelFormat = vf.VideoPixelFormat;
export type PlaneLayout = vf.PlaneLayout;
export type VideoFrameCopyToOptions = vf.VideoFrameCopyToOptions;

// VideoDecoder
export type VideoDecoder = vdec.VideoDecoder;
export const VideoDecoder = vdec.VideoDecoder;
export type VideoDecoderInit = vdec.VideoDecoderInit;
export type VideoFrameOutputCallback = vdec.VideoFrameOutputCallback;
export type VideoDecoderConfig = vdec.VideoDecoderConfig;
export type VideoDecoderSupport = vdec.VideoDecoderSupport;

// Rendering
export const createImageBitmap = rendering.createImageBitmap;

// Misc
export type CodecState = misc.CodecState;
export type WebCodecsErrorcallback = misc.WebCodecsErrorCallback;

// Configurations/environments
export type AudioDecoderEnvironment = config.AudioDecoderEnvironment;
export type VideoDecoderEnvironment = config.VideoDecoderEnvironment;
export type UnsupportedException = config.UnsupportedException;
export const UnsupportedException = config.UnsupportedException;
export const getVideoDecoder = config.getVideoDecoder;
