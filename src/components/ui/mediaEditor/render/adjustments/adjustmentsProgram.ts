import type { CurvesState, MediaEditDocument } from '../../../../../types/mediaEditor';
import type { Size } from '../transform';

import { buildCurvesLut, CURVES_LUT_SIZE, isCurvesDefault } from './curves';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { getAdjustmentUniforms } from './values';

export type AdjustmentsProgram = {
  render: (frame: CanvasImageSource, size: Size, doc: MediaEditDocument) => OffscreenCanvas;
  dispose: NoneToVoidFunction;
};

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

let canRenderAdjustments: boolean | undefined;

export function getCanRenderAdjustments() {
  canRenderAdjustments ??= typeof OffscreenCanvas !== 'undefined'
    && Boolean(new OffscreenCanvas(1, 1).getContext('webgl2'));
  return canRenderAdjustments;
}

export function createAdjustmentsProgram(): AdjustmentsProgram | undefined {
  const canvas = new OffscreenCanvas(1, 1);
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return undefined;

  const program = linkProgram(gl);
  if (!program) return undefined;

  return setupProgram(canvas, gl, program);
}

function setupProgram(canvas: OffscreenCanvas, gl: WebGL2RenderingContext, program: WebGLProgram) {
  const getLocation = (name: string) => gl.getUniformLocation(program, name);
  let uploadedCurves: CurvesState | undefined;
  let uploadedImage: CanvasImageSource | undefined;

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE1);
  createTexture(gl, gl.NEAREST);
  uploadCurves({});
  gl.activeTexture(gl.TEXTURE0);
  createTexture(gl, gl.LINEAR);
  gl.uniform1i(getLocation('uImage'), 0);
  gl.uniform1i(getLocation('uCurves'), 1);

  function uploadCurves(curves: CurvesState) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CURVES_LUT_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildCurvesLut(curves));
    uploadedCurves = curves;
  }

  function render(frame: CanvasImageSource, { width, height }: Size, doc: MediaEditDocument) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);

    // An image never changes, so it is uploaded once, while video frames and canvases are redrawn in place
    if (frame !== uploadedImage) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame as TexImageSource);
      uploadedImage = getIsImmutableImage(frame) ? frame : undefined;
    }

    const { curves } = doc;
    const hasCurves = Boolean(curves && !isCurvesDefault(curves));
    if (hasCurves && curves !== uploadedCurves) {
      gl.activeTexture(gl.TEXTURE1);
      uploadCurves(curves!);
      gl.activeTexture(gl.TEXTURE0);
    }

    const uniforms = getAdjustmentUniforms(doc);
    gl.uniform2f(getLocation('uImageSize'), width, height);
    gl.uniform1i(getLocation('uHasCurves'), Number(hasCurves));
    gl.uniform1f(getLocation('uSharpen'), uniforms.sharpen);
    gl.uniform1f(getLocation('uShadows'), uniforms.shadows);
    gl.uniform1f(getLocation('uHighlights'), uniforms.highlights);
    gl.uniform1f(getLocation('uContrast'), uniforms.contrast);
    gl.uniform1f(getLocation('uFade'), uniforms.fade);
    gl.uniform1f(getLocation('uSaturation'), uniforms.saturation);
    gl.uniform3fv(getLocation('uShadowsTintColor'), uniforms.shadowsTintColor);
    gl.uniform1f(getLocation('uShadowsTintIntensity'), uniforms.shadowsTintIntensity);
    gl.uniform3fv(getLocation('uHighlightsTintColor'), uniforms.highlightsTintColor);
    gl.uniform1f(getLocation('uHighlightsTintIntensity'), uniforms.highlightsTintIntensity);
    gl.uniform1f(getLocation('uExposure'), uniforms.exposure);
    gl.uniform1f(getLocation('uWarmth'), uniforms.warmth);
    gl.uniform1f(getLocation('uGrain'), uniforms.grain);
    gl.uniform1f(getLocation('uVignette'), uniforms.vignette);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return canvas;
  }

  function dispose() {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  return { render, dispose } satisfies AdjustmentsProgram;
}

function getIsImmutableImage(frame: CanvasImageSource) {
  return (typeof HTMLImageElement !== 'undefined' && frame instanceof HTMLImageElement)
    || (typeof ImageBitmap !== 'undefined' && frame instanceof ImageBitmap);
}

function linkProgram(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) return undefined;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : undefined;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return undefined;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined;
}

function createTexture(gl: WebGL2RenderingContext, filter: number) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}
