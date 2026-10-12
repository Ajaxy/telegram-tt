import { clamp, lerp } from '../../util/math';
import { rafPromise } from '../../util/schedulers';
import diamondFragmentShader from './shaders/diamondFragment.glsl?raw';
import diamondVertexShader from './shaders/diamondVertex.glsl?raw';
import sparkleFragmentShader from './shaders/sparkleFragment.glsl?raw';
import sparkleVertexShader from './shaders/sparkleVertex.glsl?raw';

import anchorsUrl from '../../assets/models/diamond/anchors.bin?url&no-inline';
import cameraUrl from '../../assets/models/diamond/camera.bin?url&no-inline';
import facetProjectionUrl from '../../assets/models/diamond/facetProjection.bin?url&no-inline';
import framesUrl from '../../assets/models/diamond/frames.bin?url&no-inline';
import mainSparkleUrl from '../../assets/models/diamond/main.bin?url&no-inline';
import planesUrl from '../../assets/models/diamond/planes.bin?url&no-inline';
import smallSparklesUrl from '../../assets/models/diamond/small.bin?url&no-inline';
import verticesUrl from '../../assets/models/diamond/vertices.bin?url&no-inline';
import widthsUrl from '../../assets/models/diamond/widths.bin?url&no-inline';

export type DiamondPalette = 'regular' | 'icon';

export type DiamondViewport = {
  x: number;
  y: number;
  size: number;
};

export type DiamondDrawState = {
  lastYaw?: number;
  lastTilt?: number;
};

export type DiamondScene = {
  // Angles are in radians, times in seconds of the scene clock
  draw: (
    state: DiamondDrawState, viewport: DiamondViewport, time: number, frameTime: number, yaw: number, pitch: number,
  ) => void;
};

type Program = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

type Mesh = {
  vao: WebGLVertexArrayObject;
  vertexCount: number;
};

type Model = {
  vertices: Float32Array;
  mainSparkle: Float32Array;
  smallSparkles: Float32Array;
  frames: Float32Array;
  planes: Float32Array;
  anchors: Float32Array;
  widths: Float32Array;
  facetProjection: Float32Array;
  camera: Float32Array;
};

const VEC4_SIZE = 4;
const FLOAT_SIZE = 4;
const MATRIX_SIZE = 16;
const DIAMOND_ATTRIBUTE_COUNT = 3;
const SPARKLE_ATTRIBUTE_COUNT = 2;

// As the Android app passes them: the large diamond keeps the model colors, the chat icon is blue with a white glow
const PALETTE_IDS: Record<DiamondPalette, number> = {
  regular: 0,
  icon: 2,
};

const FRAME_SIZE = 42;
const FRAMES_PER_SECOND = 240;
// The file holds one more frame, a copy of the first, so the last frame interpolates into it
const FRAME_COUNT = 1440;
const SPARKLE_SHAPE_OFFSET = 36;
const SPARKLE_HALO_SCALE_INDEX = 40;
const SWEEP_UNIFORMS = [
  'crownGradient', 'pavilionGradient', 'lightSweep', 'crownSweep', 'rightCrownSweep', 'leftCrownSweep',
  'pavilionSweep', 'rightPavilionSweep', 'leftPavilionSweep',
];
const MATRIX_UNIFORMS = ['model', 'inverseModel', 'projection'];
const VECTOR_UNIFORMS = [
  'parameters', 'viewport', 'sparkleShape', 'sparkleHalo', 'facetProjection', 'appearance', ...SWEEP_UNIFORMS,
];

const PLANE_COUNT = 17;
const REFRACTION = 0.72;
// The projection is fitted to a cut 0.9975 wide face on; a cut of another width is scaled to the same size
const PROJECTION_SCALE = 1.52;
const PROJECTION_BASE_WIDTH = 0.9975;
const PROJECTION_DEPTH = 6;
const PROJECTION_CENTER_DEPTH = 0.5;
const PROJECTION_SHIFT = 0.12;

// The camera file holds the tilt of the view, the camera distance and the depth scale
const CAMERA_LENGTH = 3;
// A squeeze keeps the width steady while the diamond turns; the table covers 0..45° in half-degree steps
const WIDTH_STEPS = 90;
const WIDTH_STEPS_PER_RADIAN = 360 / Math.PI;
const WIDTH_DIP = 0.035;
const WIDTH_FADE_START = Math.sin(0.25);
const WIDTH_FADE_END = Math.sin(0.96);
const QUARTER_TURN = Math.PI / 2;

// The main sparkle sits on the side face facing the viewer the most, at one of the model's anchor points
const FACE_COUNT = 4;
const SPARKLE_ANCHOR_COUNT = 8;
const SMALL_SPARKLE_COUNT = 7;
// The main sparkle fades out when its facet turns away by more than `FACING_ANGLE` and while the diamond spins fast
const FACING_ANGLE = Math.PI / 15;
const CALM_SPEED = Math.PI * (2 / 15);
const CALM_START = 0.06;
const CALM_RANGE = 0.34;
const MIN_SPEED = 0.001;
const INITIAL_SPEED = 0.596;

const DEFAULT_FRAME_TIME = 1 / 60;
const MAX_FRAME_TIME = 0.1;

export const TURN_DURATION = 10.54;

let modelPromise: Promise<Model> | undefined;

// Capped at `MAX_FRAME_TIME`, so after a stall the diamond moves on by one short step instead of jumping ahead
export function getFrameTime(now: number, lastFrameTime?: number) {
  return lastFrameTime === undefined ? DEFAULT_FRAME_TIME : Math.min(MAX_FRAME_TIME, (now - lastFrameTime) / 1000);
}

export async function createDiamondScene(gl: WebGL2RenderingContext, palette: DiamondPalette): Promise<DiamondScene> {
  const diamondProgram = createProgram(gl, diamondVertexShader, diamondFragmentShader);
  const sparkleProgram = createProgram(gl, sparkleVertexShader, sparkleFragmentShader);

  const [model] = await Promise.all([loadModel(), waitForCompilation(gl, [diamondProgram, sparkleProgram])]);

  return buildScene(gl, model, {
    diamondProgram: linkProgram(gl, diamondProgram),
    sparkleProgram: linkProgram(gl, sparkleProgram),
    diamond: createMesh(gl, model.vertices, DIAMOND_ATTRIBUTE_COUNT),
    mainSparkle: createMesh(gl, model.mainSparkle, SPARKLE_ATTRIBUTE_COUNT),
    smallSparkles: createMesh(gl, model.smallSparkles, SPARKLE_ATTRIBUTE_COUNT),
  }, PALETTE_IDS[palette]);
}

function loadModel() {
  if (!modelPromise) {
    modelPromise = fetchModel();

    modelPromise.catch(() => {
      modelPromise = undefined;
    });
  }

  return modelPromise;
}

async function fetchModel(): Promise<Model> {
  const [vertices, mainSparkle, smallSparkles, frames, planes, anchors, widths, facetProjection, camera] = await Promise
    .all([
      verticesUrl, mainSparkleUrl, smallSparklesUrl, framesUrl, planesUrl, anchorsUrl, widthsUrl, facetProjectionUrl,
      cameraUrl,
    ].map(fetchFloats));

  if (frames.length !== (FRAME_COUNT + 1) * FRAME_SIZE
    || planes.length !== PLANE_COUNT * VEC4_SIZE
    || anchors.length !== SPARKLE_ANCHOR_COUNT * 2 * VEC4_SIZE
    || widths.length !== WIDTH_STEPS + 1
    || facetProjection.length !== VEC4_SIZE
    || camera.length !== CAMERA_LENGTH) {
    throw new Error('Unexpected diamond model data');
  }

  return {
    vertices, mainSparkle, smallSparkles, frames, planes, anchors, widths, facetProjection, camera,
  };
}

function buildScene(gl: WebGL2RenderingContext, model: Model, gpu: {
  diamondProgram: Program;
  sparkleProgram: Program;
  diamond: Mesh;
  mainSparkle: Mesh;
  smallSparkles: Mesh;
}, paletteId: number): DiamondScene {
  const {
    frames, planes, anchors, widths, facetProjection, camera,
  } = model;
  const {
    diamondProgram, sparkleProgram, diamond, mainSparkle, smallSparkles,
  } = gpu;
  const [cameraTilt] = camera;

  const frame = new Float32Array(FRAME_SIZE);
  const modelMatrix = new Float32Array(MATRIX_SIZE);
  const inverseModelMatrix = new Float32Array(MATRIX_SIZE);
  const projection = buildProjection(1, camera, widths[0]);
  const horizontalScale = projection[0];

  gl.depthFunc(gl.LEQUAL);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Clearing stays inside the area being drawn, so the other areas keep their frames
  gl.enable(gl.SCISSOR_TEST);
  [diamondProgram, sparkleProgram].forEach(applyModelUniforms);

  function draw(
    state: DiamondDrawState, viewport: DiamondViewport, time: number, frameTime: number, yaw: number, pitch: number,
  ) {
    interpolateFrame(time);

    const pitchCos = Math.cos(pitch);
    const tilt = pitch + cameraTilt;
    updateModel(tilt, yaw);

    const widthScale = getWidthScale(yaw, tilt, widths);
    projection[0] = horizontalScale * widthScale;

    let anchor = 0;
    let maxFacing = -1;

    for (let i = 0; i < FACE_COUNT; i++) {
      const angle = (i * 2 * Math.PI) / FACE_COUNT;
      const facing = pitchCos * Math.cos(yaw + angle);

      if (facing > maxFacing) {
        maxFacing = facing;
        anchor = angle;
      }
    }

    const { lastYaw, lastTilt } = state;
    const speed = lastYaw === undefined || lastTilt === undefined || frameTime <= 0
      ? INITIAL_SPEED
      : Math.hypot(Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)), tilt - lastTilt) / frameTime;

    state.lastYaw = yaw;
    state.lastTilt = tilt;

    const facingRatio = clamp(1 - Math.acos(clamp(maxFacing, -1, 1)) / FACING_ANGLE, 0, 1);
    const calmRatio = clamp((CALM_SPEED / Math.max(speed, MIN_SPEED) - CALM_START) / CALM_RANGE, 0, 1);
    const sparkleVisibility = interpolateSmoothly(calmRatio) * interpolateSmoothly(facingRatio);

    const { x, y, size } = viewport;
    gl.viewport(x, y, size, size);
    gl.scissor(x, y, size, size);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    applyUniforms(diamondProgram, size, time, anchor, widthScale, sparkleVisibility);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(diamond.vao);
    gl.drawArrays(gl.TRIANGLES, 0, diamond.vertexCount);

    applyUniforms(sparkleProgram, size, time, anchor, widthScale, sparkleVisibility);
    gl.enable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(mainSparkle.vao);
    gl.uniform1ui(sparkleProgram.uniforms.baseInstance, 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, mainSparkle.vertexCount, 1);
    gl.bindVertexArray(smallSparkles.vao);
    gl.uniform1ui(sparkleProgram.uniforms.baseInstance, 1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, smallSparkles.vertexCount, SMALL_SPARKLE_COUNT);
  }

  function interpolateFrame(time: number) {
    const position = (time * FRAMES_PER_SECOND) % FRAME_COUNT;
    const index = Math.floor(position);
    const fraction = position - index;
    const offset = index * FRAME_SIZE;

    for (let i = 0; i < FRAME_SIZE; i++) {
      frame[i] = lerp(frames[offset + i], frames[offset + FRAME_SIZE + i], fraction);
    }
  }

  function updateModel(tilt: number, turn: number) {
    const sinTilt = Math.sin(tilt);
    const cosTilt = Math.cos(tilt);
    const sinTurn = Math.sin(turn);
    const cosTurn = Math.cos(turn);

    // A pure rotation is orthogonal, so its inverse is its transpose
    modelMatrix.set([
      cosTurn, sinTilt * sinTurn, -cosTilt * sinTurn, 0,
      0, cosTilt, sinTilt, 0,
      sinTurn, -sinTilt * cosTurn, cosTilt * cosTurn, 0,
      0, 0, 0, 1,
    ]);

    inverseModelMatrix.set([
      cosTurn, 0, sinTurn, 0,
      sinTilt * sinTurn, cosTilt, -sinTilt * cosTurn, 0,
      -cosTilt * sinTurn, sinTilt, cosTilt * cosTurn, 0,
      0, 0, 0, 1,
    ]);
  }

  // Uniforms fixed by the model and the palette are set once; the reference flashes stay zero, as on Android
  function applyModelUniforms({ program, uniforms }: Program) {
    gl.useProgram(program);
    gl.uniform4f(uniforms.appearance, paletteId, 0, 0, 0);
    gl.uniform4fv(uniforms.planes, planes);
    gl.uniform4fv(uniforms.facetProjection, facetProjection);

    for (let i = 0; i < SPARKLE_ANCHOR_COUNT; i++) {
      gl.uniform4fv(uniforms[`anchors[${i}].position`], anchors, i * 2 * VEC4_SIZE, VEC4_SIZE);
      gl.uniform4fv(uniforms[`anchors[${i}].normal`], anchors, (i * 2 + 1) * VEC4_SIZE, VEC4_SIZE);
    }
  }

  function applyUniforms(
    { program, uniforms }: Program, size: number, time: number, anchor: number, widthScale: number,
    sparkleVisibility: number,
  ) {
    gl.useProgram(program);
    gl.uniform4f(uniforms.viewport, size, size, PLANE_COUNT, 0);
    gl.uniformMatrix4fv(uniforms.model, false, modelMatrix);
    gl.uniformMatrix4fv(uniforms.inverseModel, false, inverseModelMatrix);
    gl.uniformMatrix4fv(uniforms.projection, false, projection);
    gl.uniform4f(uniforms.parameters, time, REFRACTION, 1, 1);
    gl.uniform4fv(uniforms.sparkleShape, frame, SPARKLE_SHAPE_OFFSET, VEC4_SIZE);
    gl.uniform4f(uniforms.sparkleHalo, frame[SPARKLE_HALO_SCALE_INDEX], anchor, widthScale, sparkleVisibility);

    SWEEP_UNIFORMS.forEach((name, i) => {
      gl.uniform4fv(uniforms[name], frame, i * VEC4_SIZE, VEC4_SIZE);
    });
  }

  return { draw };
}

async function fetchFloats(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url}`);

  return new Float32Array(await response.arrayBuffer());
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);

  return program;
}

function createShader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  return shader;
}

// Reading `LINK_STATUS` blocks until the driver finishes compiling (about 160 ms on an Apple M3 Pro), so with
// `KHR_parallel_shader_compile` the renderer polls `COMPLETION_STATUS_KHR` once per frame instead
async function waitForCompilation(gl: WebGL2RenderingContext, programs: WebGLProgram[]) {
  const extension = gl.getExtension('KHR_parallel_shader_compile');
  if (!extension) return;

  while (!programs.every((program) => gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR))) {
    await rafPromise();
  }
}

function linkProgram(gl: WebGL2RenderingContext, program: WebGLProgram): Program {
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Cannot link diamond shaders');
  }

  const uniforms: Program['uniforms'] = {
    planes: gl.getUniformLocation(program, 'planes[0]'),
    baseInstance: gl.getUniformLocation(program, 'baseInstance'),
  };

  [...MATRIX_UNIFORMS, ...VECTOR_UNIFORMS].forEach((name) => {
    uniforms[name] = gl.getUniformLocation(program, `u.${name}`);
  });

  for (let i = 0; i < SPARKLE_ANCHOR_COUNT; i++) {
    ['position', 'normal'].forEach((field) => {
      const name = `anchors[${i}].${field}`;
      uniforms[name] = gl.getUniformLocation(program, name);
    });
  }

  return { program, uniforms };
}

function createMesh(gl: WebGL2RenderingContext, data: Float32Array, attributeCount: number): Mesh {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const stride = attributeCount * VEC4_SIZE * FLOAT_SIZE;

  for (let i = 0; i < attributeCount; i++) {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, VEC4_SIZE, gl.FLOAT, false, stride, i * VEC4_SIZE * FLOAT_SIZE);
  }

  return { vao, vertexCount: data.length / (attributeCount * VEC4_SIZE) };
}

// Keeps depth in 0..1, as the shaders from the Metal renderer expect; the first value is the horizontal scale
function buildProjection(aspectRatio: number, camera: Float32Array, faceOnWidth: number) {
  const [, cameraDistance, cameraScale] = camera;
  const scale = Math.max(1, 1 / aspectRatio) * PROJECTION_SCALE * (faceOnWidth / PROJECTION_BASE_WIDTH);
  const depthScale = 1 / cameraScale;
  const perspective = -depthScale / cameraDistance;
  const shift = PROJECTION_SHIFT / scale;

  return new Float32Array([
    1 / (aspectRatio * scale), 0, 0, 0,
    0, 1 / scale, 0, 0,
    0, shift * perspective, -depthScale / PROJECTION_DEPTH, perspective,
    0, shift * depthScale, PROJECTION_CENTER_DEPTH * depthScale, depthScale,
  ]);
}

function getWidthScale(yaw: number, tilt: number, widths: Float32Array) {
  const angle = Math.abs(yaw - Math.round(yaw / QUARTER_TURN) * QUARTER_TURN);
  const position = Math.min(WIDTH_STEPS, angle * WIDTH_STEPS_PER_RADIAN);
  const index = Math.min(WIDTH_STEPS - 1, Math.floor(position));
  const width = interpolateCubic(widths, index, position - index);
  const targetWidth = (1 - WIDTH_DIP * Math.sin(2 * angle) ** 2) * widths[0];
  const fade = interpolateSmoothly(
    clamp((Math.abs(Math.sin(tilt)) - WIDTH_FADE_START) / (WIDTH_FADE_END - WIDTH_FADE_START), 0, 1),
  );

  return 1 + (1 - fade) * (targetWidth / width - 1);
}

// A Catmull-Rom spline through the table, with flat ends
function interpolateCubic(values: Float32Array, index: number, t: number) {
  const from = values[index];
  const to = values[index + 1];
  const fromSlope = index === 0 ? 0 : (to - values[index - 1]) / 2;
  const toSlope = index + 2 >= values.length ? 0 : (values[index + 2] - from) / 2;

  return ((((from - to) * 2 + fromSlope + toSlope) * t + ((to - from) * 3 - fromSlope * 2 - toSlope)) * t
    + fromSlope) * t + from;
}

function interpolateSmoothly(x: number) {
  return x * x * (3 - 2 * x);
}
