import { easeThemeSwitch, THEME_SWITCH_DURATION_MS } from '../switchTheme';

// Matches Telegram macOS's `SoftwareGradientBackground` and `BackgroundGradientView`

const VERTEX_SHADER_SOURCE = `
  attribute vec4 a_position;

  void main() {
    gl_Position = a_position;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  uniform vec2 resolution;
  uniform float colorCount;
  uniform vec2 linearDirection;

  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform vec3 color4;

  uniform vec2 color1Pos;
  uniform vec2 color2Pos;
  uniform vec2 color3Pos;
  uniform vec2 color4Pos;

  void main() {
    vec2 position = gl_FragCoord.xy / resolution.xy;
    position.y = 1.0 - position.y;
    // Native freeform rendering and the CPU fallback sample pixel indices
    position -= 0.5 / resolution;

    if (colorCount < 3.0) {
      float ratio = colorCount < 2.0 ? 0.0 : clamp(dot(position - 0.5, linearDirection) + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(mix(color1, color2, ratio) / 255.0, 1.0);
      return;
    }

    vec2 centered = position - 0.5;
    float swirlFactor = 0.35 * length(centered);
    float theta = swirlFactor * swirlFactor * 0.8 * 8.0;
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    position = clamp(vec2(
      centered.x * cosTheta - centered.y * sinTheta,
      centered.x * sinTheta + centered.y * cosTheta
    ) + 0.5, 0.0, 1.0);

    float dp1 = pow(max(0.0, 0.92 - distance(position, color1Pos)), 3.0);
    float dp2 = pow(max(0.0, 0.92 - distance(position, color2Pos)), 3.0);
    float dp3 = pow(max(0.0, 0.92 - distance(position, color3Pos)), 3.0);
    float dp4 = colorCount > 3.0 ? pow(max(0.0, 0.92 - distance(position, color4Pos)), 3.0) : 0.0;
    gl_FragColor = vec4((color1 * dp1 + color2 * dp2 + color3 * dp3 + color4 * dp4)
      / (255.0 * (dp1 + dp2 + dp3 + dp4)), 1.0);
  }
`;

const KEY_POINTS = [
  [0.8, 0.9],
  [0.6, 0.8],
  [0.35, 0.75],
  [0.25, 0.4],
  [0.2, 0.1],
  [0.4, 0.2],
  [0.65, 0.25],
  [0.75, 0.6],
];

const ANIMATION_SPEED = 0.1;
const POSITION_EPSILON = 0.01;
const COLOR_POINT_COUNT = 4;
const KEY_POINT_STEP = 2;
const VERTEX_COMPONENT_COUNT = 2;
const VERTEX_COUNT = 6;
const STATIC_GRADIENT_SIZE = 64;
const BLEND_POWER = 3;
const BLEND_RADIUS = 0.92;
const SWIRL_FACTOR = 0.35;
const SWIRL_ANGLE_MULTIPLIER = 0.8 * 8;
const MIN_FREEFORM_COLORS = 3;
const MAX_CHANNEL = 255;
const PIXEL_CHANNEL_COUNT = 4;
const GREEN_CHANNEL_OFFSET = 1;
const BLUE_CHANNEL_OFFSET = 2;
const ALPHA_CHANNEL_OFFSET = 3;
const HEX_CHANNEL_LENGTH = 2;
const HEX_RADIX = 16;
const DEGREES_TO_RADIANS = Math.PI / 180;
const ROTATION_CENTER = 0.5;
const FULL_ROTATION = 360;

export type GradientRenderer = {
  update: (colors: string[], shouldSnap?: boolean, rotation?: number, aspectRatio?: number) => void;
  advancePosition: () => void;
  destroy: () => void;
};

const ACTIVE_RENDERERS = new Set<GradientRenderer>();

// Advances every active gradient by one step, e.g. when the user sends a message
export function scrollGradientBackground() {
  ACTIVE_RENDERERS.forEach((renderer) => renderer.advancePosition());
}

type WebGlResources = {
  context: WebGLRenderingContext;
  program: WebGLProgram;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  positionBuffer: WebGLBuffer;
  colorLocations: (WebGLUniformLocation | undefined)[];
  colorPositionLocations: (WebGLUniformLocation | undefined)[];
  colorCountLocation: WebGLUniformLocation;
  linearDirectionLocation: WebGLUniformLocation;
};

// The reusable setup compiles shaders and uploads geometry after initialization or context restoration
function setupWebGl(canvas: HTMLCanvasElement, context: WebGLRenderingContext): WebGlResources | undefined {
  if (context.isContextLost()) {
    return undefined;
  }

  const vertexShader = createShader(context, context.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) {
    releasePartialWebGl(context, { vertexShader, fragmentShader });
    return undefined;
  }

  const program = createProgram(context, vertexShader, fragmentShader);
  if (!program) {
    releasePartialWebGl(context, { vertexShader, fragmentShader });
    return undefined;
  }

  context.useProgram(program);

  const positionAttributeLocation = context.getAttribLocation(program, 'a_position');
  const positionBuffer = context.createBuffer();
  if (!positionBuffer) {
    releasePartialWebGl(context, { program, vertexShader, fragmentShader });
    return undefined;
  }

  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), context.STATIC_DRAW);
  context.enableVertexAttribArray(positionAttributeLocation);
  context.vertexAttribPointer(positionAttributeLocation, VERTEX_COMPONENT_COUNT, context.FLOAT, false, 0, 0);
  context.viewport(0, 0, canvas.width, canvas.height);

  // The fixed canvas size allows uploading the resolution only during setup
  const resolutionLocation = context.getUniformLocation(program, 'resolution');
  if (resolutionLocation) {
    context.uniform2fv(resolutionLocation, [canvas.width, canvas.height]);
  }

  return {
    context,
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    colorCountLocation: context.getUniformLocation(program, 'colorCount')!,
    linearDirectionLocation: context.getUniformLocation(program, 'linearDirection')!,
    colorLocations: Array.from(
      { length: COLOR_POINT_COUNT },
      (_value, index) => context.getUniformLocation(program, `color${index + 1}`) ?? undefined,
    ),
    colorPositionLocations: Array.from(
      { length: COLOR_POINT_COUNT },
      (_value, index) => context.getUniformLocation(program, `color${index + 1}Pos`) ?? undefined,
    ),
  };
}

export function createGradientRenderer(
  canvas: HTMLCanvasElement, colors: string[], rotation?: number,
  options?: {
    noPositionAnimation?: boolean;
    aspectRatio?: number;
    colorMorphDurationMs?: number;
    colorMorphEasing?: (t: number) => number;
    onRender?: NoneToVoidFunction;
  },
): GradientRenderer | undefined {
  const outputContext = canvas.getContext('2d');
  if (!outputContext) return undefined;

  // Keep drawable pixels separate from the GPU context so a reset cannot blank the wallpaper or bubble source
  const webGlCanvas = document.createElement('canvas');
  webGlCanvas.width = canvas.width;
  webGlCanvas.height = canvas.height;
  // Keep the GPU frame available for copying into the display canvas
  const webGlContext = webGlCanvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });

  let resources: WebGlResources | undefined;

  let colorVectors = buildColorVectors(colors);
  let targetColorVectors = colorVectors;
  let initialColorVectors = colorVectors;
  let colorMorphStartedAt: number | undefined;
  let linearDirection = buildLinearDirection(rotation, options?.aspectRatio);

  let keyShift = 0;
  const currentPositions = Array.from(
    { length: COLOR_POINT_COUNT },
    (_value, index) => [...KEY_POINTS[index * KEY_POINT_STEP]],
  );
  let targetPositions = pickTargetPositions();

  // A single frame loop renders overlapping color and position animations once per frame
  let animationFrame: number | undefined;

  function pickTargetPositions() {
    const positions = buildTargetPositions(keyShift);
    keyShift = (keyShift + 1) % KEY_POINTS.length;
    return positions;
  }

  function buildTargetPositions(shift: number) {
    return Array.from(
      { length: COLOR_POINT_COUNT },
      (_value, index) => KEY_POINTS[(shift + index * KEY_POINT_STEP) % KEY_POINTS.length],
    );
  }

  function render() {
    if (!resources || resources.context.isContextLost()) {
      drawGradient(outputContext!, colorVectors, currentPositions, linearDirection);
      options?.onRender?.();
      return;
    }
    const { context, colorLocations, colorPositionLocations, colorCountLocation, linearDirectionLocation } = resources;

    context.uniform1f(colorCountLocation, colorVectors.length);
    context.uniform2fv(linearDirectionLocation, linearDirection);
    colorVectors.forEach((color, index) => context.uniform3fv(colorLocations[index]!, color));
    currentPositions.forEach((position, index) => {
      context.uniform2fv(colorPositionLocations[index]!, position);
    });
    context.drawArrays(context.TRIANGLES, 0, VERTEX_COUNT);
    if (context.isContextLost()) {
      drawGradient(outputContext!, colorVectors, currentPositions, linearDirection);
    } else {
      outputContext!.drawImage(webGlCanvas, 0, 0);
    }
    options?.onRender?.();
  }

  // Eases the color stops and reports whether the morph is active
  function stepColors() {
    if (colorMorphStartedAt === undefined) return false;
    const duration = options?.colorMorphDurationMs ?? THEME_SWITCH_DURATION_MS;
    const progress = Math.min((performance.now() - colorMorphStartedAt) / duration, 1);
    if (progress === 1) {
      colorVectors = targetColorVectors;
      colorMorphStartedAt = undefined;
      return false;
    }
    const ratio = (options?.colorMorphEasing ?? easeThemeSwitch)(progress);
    colorVectors = initialColorVectors.map((color, colorIndex) => color.map((channel, channelIndex) => (
      channel + (targetColorVectors[colorIndex][channelIndex] - channel) * ratio
    )));
    return true;
  }

  // Eases the color points and reports whether they are still moving
  function stepPositions() {
    let isMoving = false;
    for (let index = 0; index < currentPositions.length; index++) {
      const current = currentPositions[index];
      const target = targetPositions[index];
      // Both axes must reach the target before the animation stops
      if (Math.abs(current[0] - target[0]) > POSITION_EPSILON
        || Math.abs(current[1] - target[1]) > POSITION_EPSILON) {
        isMoving = true;
      }
      current[0] = current[0] * (1 - ANIMATION_SPEED) + target[0] * ANIMATION_SPEED;
      current[1] = current[1] * (1 - ANIMATION_SPEED) + target[1] * ANIMATION_SPEED;
    }

    return isMoving;
  }

  function animate() {
    // Both steps run every frame before a single draw covers their changes
    const isBusy = [stepColors(), stepPositions()].includes(true);

    render();

    animationFrame = isBusy ? requestAnimationFrame(animate) : undefined;
  }

  function ensureAnimating() {
    if (animationFrame === undefined) {
      animationFrame = requestAnimationFrame(animate);
    }
  }

  function cancelAnimations() {
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
  }

  function releaseWebGl() {
    if (resources) releasePartialWebGl(webGlContext!, resources);
    // Free the context slot immediately (browsers cap live WebGL contexts) instead of waiting
    // for the canvas to be garbage-collected
    webGlContext?.getExtension('WEBGL_lose_context')?.loseContext();
    resources = undefined;
  }

  function handleContextLost(e: Event) {
    e.preventDefault();
    resources = undefined;
    cancelAnimations();
    colorVectors = targetColorVectors;
    colorMorphStartedAt = undefined;
    render();
  }

  function handleContextRestored() {
    resources = setupWebGl(webGlCanvas, webGlContext!);
    render();
  }

  webGlCanvas.addEventListener('webglcontextlost', handleContextLost);
  webGlCanvas.addEventListener('webglcontextrestored', handleContextRestored);
  canvas.addEventListener('contextrestored', render);

  resources = webGlContext ? setupWebGl(webGlCanvas, webGlContext) : undefined;
  render();

  const renderer: GradientRenderer = {
    update(newColors: string[], shouldSnap?: boolean, newRotation?: number, aspectRatio?: number) {
      targetColorVectors = buildColorVectors(newColors);
      linearDirection = buildLinearDirection(newRotation, aspectRatio);
      // Snap without morphing when entering masked mode: there the gradient shows through the
      // pattern doodles, so easing bright light colors down to dark ones flashes the doodles.
      // A running loop settles on its own next frame (colors are already at target).
      if (shouldSnap || !resources || resources.context.isContextLost()
        || targetColorVectors.length !== colorVectors.length) {
        colorVectors = targetColorVectors.map((color) => [...color]);
        colorMorphStartedAt = undefined;
        render();
        return;
      }
      initialColorVectors = colorVectors;
      colorMorphStartedAt = performance.now();
      ensureAnimating();
    },
    advancePosition() {
      if (options?.noPositionAnimation || !resources || resources.context.isContextLost()
        || colorVectors.length < MIN_FREEFORM_COLORS) return;
      targetPositions = pickTargetPositions();
      ensureAnimating();
    },
    destroy() {
      ACTIVE_RENDERERS.delete(renderer);
      webGlCanvas.removeEventListener('webglcontextlost', handleContextLost);
      webGlCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      canvas.removeEventListener('contextrestored', render);
      cancelAnimations();
      releaseWebGl();
    },
  };

  ACTIVE_RENDERERS.add(renderer);

  return renderer;
}

// Draws the animated renderer's resting gradient onto a plain 2D preview canvas
export function renderStaticGradient(
  canvas: HTMLCanvasElement, colors: string[], rotation?: number, aspectRatio?: number,
) {
  canvas.width = STATIC_GRADIENT_SIZE;
  canvas.height = STATIC_GRADIENT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) return;

  drawStaticGradient(context, colors, rotation, aspectRatio);
}

function drawStaticGradient(
  context: CanvasRenderingContext2D, colors: string[], rotation?: number, aspectRatio?: number,
) {
  const colorVectors = buildColorVectors(colors);
  const linearDirection = buildLinearDirection(rotation, aspectRatio);
  const positions = Array.from(
    { length: COLOR_POINT_COUNT },
    (_value, index) => KEY_POINTS[index * KEY_POINT_STEP],
  );
  drawGradient(context, colorVectors, positions, linearDirection);
}

function drawGradient(
  context: CanvasRenderingContext2D, colorVectors: number[][], positions: number[][], linearDirection: number[],
) {
  const { width, height } = context.canvas;
  const image = context.createImageData(width, height);
  const { data } = image;

  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    for (let columnIndex = 0; columnIndex < width; columnIndex++) {
      const xRatio = columnIndex / width;
      const yRatio = rowIndex / height;

      const [red, green, blue] = blendGradientColors(colorVectors, positions, xRatio, yRatio, linearDirection);

      const offset = (rowIndex * width + columnIndex) * PIXEL_CHANNEL_COUNT;
      data[offset] = red;
      data[offset + GREEN_CHANNEL_OFFSET] = green;
      data[offset + BLUE_CHANNEL_OFFSET] = blue;
      data[offset + ALPHA_CHANNEL_OFFSET] = MAX_CHANNEL;
    }
  }

  context.putImageData(image, 0, 0);
}

export function buildGradientEdgeColors(colors: string[], rotation?: number) {
  const colorVectors = buildColorVectors(colors);
  const linearDirection = buildLinearDirection(rotation);
  const positions = Array.from({ length: COLOR_POINT_COUNT }, (_value, index) => KEY_POINTS[index * KEY_POINT_STEP]);
  // Safari extends solid colors; the edge centers approximate the resting gradient without reading pixels
  const edges = [0, 1].map((y) => {
    const channels = blendGradientColors(colorVectors, positions, ROTATION_CENTER, y, linearDirection);
    return `#${channels.map((channel) => Math.round(channel).toString(HEX_RADIX)
      .padStart(HEX_CHANNEL_LENGTH, '0')).join('')}`;
  });
  return { top: edges[0], bottom: edges[1] };
}

function blendGradientColors(
  colorVectors: number[][], positions: number[][], x: number, y: number, linearDirection: number[],
) {
  if (colorVectors.length < MIN_FREEFORM_COLORS) {
    const first = colorVectors[0];
    const last = colorVectors[colorVectors.length - 1];
    const ratio = Math.max(0, Math.min(1,
      (x - ROTATION_CENTER) * linearDirection[0] + (y - ROTATION_CENTER) * linearDirection[1] + ROTATION_CENTER));
    return first.map((channel, index) => channel + (last[index] - channel) * ratio);
  }

  const centeredX = x - ROTATION_CENTER;
  const centeredY = y - ROTATION_CENTER;
  const swirlFactor = SWIRL_FACTOR * Math.hypot(centeredX, centeredY);
  const theta = swirlFactor * swirlFactor * SWIRL_ANGLE_MULTIPLIER;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const pixelX = Math.max(0, Math.min(1, ROTATION_CENTER + centeredX * cos - centeredY * sin));
  const pixelY = Math.max(0, Math.min(1, ROTATION_CENTER + centeredX * sin + centeredY * cos));
  const weights = colorVectors.map((_color, index) => (
    Math.max(0, BLEND_RADIUS - Math.hypot(pixelX - positions[index][0], pixelY - positions[index][1])) ** BLEND_POWER
  ));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const channels = [0, 0, 0];
  for (let index = 0; index < colorVectors.length; index++) {
    const weight = weights[index] / totalWeight;
    channels[0] += colorVectors[index][0] * weight;
    channels[GREEN_CHANNEL_OFFSET] += colorVectors[index][GREEN_CHANNEL_OFFSET] * weight;
    channels[BLUE_CHANNEL_OFFSET] += colorVectors[index][BLUE_CHANNEL_OFFSET] * weight;
  }
  return channels;
}

function buildColorVectors(colors: string[]) {
  return colors.length ? colors.slice(0, COLOR_POINT_COUNT).map(buildColorVector) : [[0, 0, 0]];
}

function buildColorVector(color: string): number[] {
  const value = color.startsWith('#') ? color.slice(1) : color;
  const greenOffset = HEX_CHANNEL_LENGTH;
  const blueOffset = HEX_CHANNEL_LENGTH * BLUE_CHANNEL_OFFSET;
  const alphaOffset = HEX_CHANNEL_LENGTH * ALPHA_CHANNEL_OFFSET;
  const red = parseInt(value.slice(0, greenOffset), HEX_RADIX);
  const green = parseInt(value.slice(greenOffset, blueOffset), HEX_RADIX);
  const blue = parseInt(value.slice(blueOffset, alphaOffset), HEX_RADIX);
  return [red, green, blue];
}

function buildLinearDirection(rotation = 0, aspectRatio = 1) {
  const normalizedRotation = ((rotation % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
  const angle = normalizedRotation * DEGREES_TO_RADIANS;
  // Native rotation keeps the gradient's length equal to the wallpaper height
  return [-Math.sin(angle) * aspectRatio, Math.cos(angle)];
}

function createShader(context: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = context.createShader(type);
  if (!shader) return undefined;

  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    context.deleteShader(shader);
    return undefined;
  }

  return shader;
}

function createProgram(
  context: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader,
): WebGLProgram | undefined {
  const program = context.createProgram();
  if (!program) return undefined;

  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    context.deleteProgram(program);
    return undefined;
  }

  return program;
}

function releasePartialWebGl(
  context: WebGLRenderingContext,
  resources: {
    program?: WebGLProgram;
    vertexShader?: WebGLShader;
    fragmentShader?: WebGLShader;
    positionBuffer?: WebGLBuffer;
  },
) {
  if (resources.positionBuffer) context.deleteBuffer(resources.positionBuffer);
  if (resources.program) context.deleteProgram(resources.program);
  if (resources.vertexShader) context.deleteShader(resources.vertexShader);
  if (resources.fragmentShader) context.deleteShader(resources.fragmentShader);
}
