// Animated four-color gradient renderer based on the distance-weighted blend used by Telegram
// Reference implementation: https://github.com/crashmax-dev/twallpaper-webgl

const VERTEX_SHADER_SOURCE = `
  attribute vec4 a_position;

  void main() {
    gl_Position = a_position;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  uniform vec2 resolution;

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

    float dp1 = distance(position, color1Pos);
    float dp2 = distance(position, color2Pos);
    float dp3 = distance(position, color3Pos);
    float dp4 = distance(position, color4Pos);
    float minD = min(dp1, min(dp2, min(dp3, dp4)));
    float p = 3.0;

    dp1 = pow(1.0 - (dp1 - minD), p);
    dp2 = pow(1.0 - (dp2 - minD), p);
    dp3 = pow(1.0 - (dp3 - minD), p);
    dp4 = pow(1.0 - (dp4 - minD), p);
    float dpt = abs(dp1 + dp2 + dp3 + dp4);

    gl_FragColor =
      (vec4(color1 / 255.0, 1.0) * dp1 / dpt) +
      (vec4(color2 / 255.0, 1.0) * dp2 / dpt) +
      (vec4(color3 / 255.0, 1.0) * dp3 / dpt) +
      (vec4(color4 / 255.0, 1.0) * dp4 / dpt);
  }
`;

const KEY_POINTS = [
  [0.265, 0.582],
  [0.176, 0.918],
  [1 - 0.585, 1 - 0.164],
  [0.644, 0.755],
  [1 - 0.265, 1 - 0.582],
  [1 - 0.176, 1 - 0.918],
  [0.585, 0.164],
  [1 - 0.644, 1 - 0.755],
];

const ANIMATION_SPEED = 0.1;
const POSITION_EPSILON = 0.01;
const COLOR_MORPH_SPEED = 0.08;
const COLOR_EPSILON = 1;
const COLOR_POINT_COUNT = 4;
const KEY_POINT_STEP = 2;
const VERTEX_COMPONENT_COUNT = 2;
const VERTEX_COUNT = 6;
const STATIC_GRADIENT_SIZE = 64;
const BLEND_POWER = 3;
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
  update: (colors: string[], shouldSnap?: boolean, rotation?: number) => void;
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
};

// The reusable setup compiles shaders and uploads geometry after initialization or context restoration
function setupWebGl(canvas: HTMLCanvasElement): WebGlResources | undefined {
  // `preserveDrawingBuffer` keeps the static gradient visible between the sparse redraws
  const context = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!context || context.isContextLost()) {
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
): GradientRenderer | undefined {
  let resources = setupWebGl(canvas);
  if (!resources) {
    return undefined;
  }

  let colorVectors = buildColorVectors(colors);
  let targetColorVectors = colorVectors;
  let normalizedRotation = normalizeRotation(rotation);
  let keyPoints = buildRotatedKeyPoints(normalizedRotation);

  let keyShift = 0;
  const currentPositions = Array.from(
    { length: COLOR_POINT_COUNT },
    (_value, index) => [...keyPoints[index * KEY_POINT_STEP]],
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
      (_value, index) => keyPoints[(shift + index * KEY_POINT_STEP) % keyPoints.length],
    );
  }

  function render() {
    if (!resources) return;
    const { context, colorLocations, colorPositionLocations } = resources;

    colorVectors.forEach((color, index) => context.uniform3fv(colorLocations[index]!, color));
    currentPositions.forEach((position, index) => {
      context.uniform2fv(colorPositionLocations[index]!, position);
    });
    context.drawArrays(context.TRIANGLES, 0, VERTEX_COUNT);
  }

  // Eases the color stops and reports whether the morph is active
  function stepColors() {
    let isMorphing = false;
    colorVectors = colorVectors.map((color, colorIndex) => color.map((channel, channelIndex) => {
      const target = targetColorVectors[colorIndex][channelIndex];
      if (Math.abs(target - channel) > COLOR_EPSILON) isMorphing = true;
      return channel + (target - channel) * COLOR_MORPH_SPEED;
    }));

    if (!isMorphing) {
      colorVectors = targetColorVectors.map((color) => [...color]);
    }

    return isMorphing;
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
    if (!resources) return;
    const {
      context, program, vertexShader, fragmentShader, positionBuffer,
    } = resources;

    context.deleteProgram(program);
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    context.deleteBuffer(positionBuffer);
    // Free the context slot immediately (browsers cap live WebGL contexts) instead of waiting
    // for the canvas to be garbage-collected
    context.getExtension('WEBGL_lose_context')?.loseContext();
    resources = undefined;
  }

  // The GPU may drop the context (e.g. during hibernation); without `preventDefault` the browser
  // never restores it and every subsequent draw becomes a silent no-op, freezing the wallpaper.
  // Running animations are left alone: their JS math finishes on its own (draws no-op harmlessly),
  // so the restore below renders the up-to-date state.
  function handleContextLost(e: Event) {
    e.preventDefault();
  }

  function handleContextRestored() {
    resources = setupWebGl(canvas);
    render();
  }

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  render();

  const renderer: GradientRenderer = {
    update(newColors: string[], shouldSnap?: boolean, newRotation?: number) {
      targetColorVectors = buildColorVectors(newColors);
      const nextRotation = normalizeRotation(newRotation);
      const hasRotationChanged = nextRotation !== normalizedRotation;
      if (hasRotationChanged) {
        normalizedRotation = nextRotation;
        keyPoints = buildRotatedKeyPoints(normalizedRotation);
        const targetShift = (keyShift - 1 + KEY_POINTS.length) % KEY_POINTS.length;
        targetPositions = buildTargetPositions(targetShift);
      }
      // Snap without morphing when entering masked mode: there the gradient shows through the
      // pattern doodles, so easing bright light colors down to dark ones flashes the doodles.
      // A running loop settles on its own next frame (colors are already at target).
      if (shouldSnap) {
        colorVectors = targetColorVectors.map((color) => [...color]);
        if (hasRotationChanged) {
          currentPositions.forEach((position, index) => {
            position[0] = targetPositions[index][0];
            position[1] = targetPositions[index][1];
          });
        }
        render();
        return;
      }
      ensureAnimating();
    },
    advancePosition() {
      targetPositions = pickTargetPositions();
      ensureAnimating();
    },
    destroy() {
      ACTIVE_RENDERERS.delete(renderer);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      cancelAnimations();
      releaseWebGl();
    },
  };

  ACTIVE_RENDERERS.add(renderer);

  return renderer;
}

// Draws the animated renderer's resting gradient onto a plain 2D preview canvas
export function renderStaticGradient(canvas: HTMLCanvasElement, colors: string[], rotation?: number) {
  canvas.width = STATIC_GRADIENT_SIZE;
  canvas.height = STATIC_GRADIENT_SIZE;

  const context = canvas.getContext('2d');
  if (context) {
    drawStaticGradient(context, colors, rotation);
    return;
  }

  // The canvas is claimed by another context type (a WebGL init that fails mid-setup still claims
  // it) — draw on a detached canvas and show it as a CSS background under the transparent bitmap
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = STATIC_GRADIENT_SIZE;
  fallbackCanvas.height = STATIC_GRADIENT_SIZE;
  const fallbackContext = fallbackCanvas.getContext('2d');
  if (!fallbackContext) return;

  drawStaticGradient(fallbackContext, colors, rotation);
  canvas.style.background = `url(${fallbackCanvas.toDataURL()}) center / 100% 100%`;
}

function drawStaticGradient(context: CanvasRenderingContext2D, colors: string[], rotation?: number) {
  const colorVectors = buildColorVectors(colors);
  const keyPoints = buildRotatedKeyPoints(rotation);
  const positions = Array.from(
    { length: COLOR_POINT_COUNT },
    (_value, index) => keyPoints[index * KEY_POINT_STEP],
  );
  const image = context.createImageData(STATIC_GRADIENT_SIZE, STATIC_GRADIENT_SIZE);
  const { data } = image;

  for (let rowIndex = 0; rowIndex < STATIC_GRADIENT_SIZE; rowIndex++) {
    for (let columnIndex = 0; columnIndex < STATIC_GRADIENT_SIZE; columnIndex++) {
      const xRatio = columnIndex / STATIC_GRADIENT_SIZE;
      const yRatio = rowIndex / STATIC_GRADIENT_SIZE;

      const distances = positions.map(([centerX, centerY]) => Math.hypot(xRatio - centerX, yRatio - centerY));
      const minDistance = Math.min(...distances);
      const weights = distances.map((distance) => (1 - (distance - minDistance)) ** BLEND_POWER);
      const totalWeight = Math.abs(weights.reduce((sum, weight) => sum + weight, 0));

      let red = 0;
      let green = 0;
      let blue = 0;
      for (let index = 0; index < colorVectors.length; index++) {
        const weight = weights[index] / totalWeight;
        red += colorVectors[index][0] * weight;
        green += colorVectors[index][GREEN_CHANNEL_OFFSET] * weight;
        blue += colorVectors[index][BLUE_CHANNEL_OFFSET] * weight;
      }

      const offset = (rowIndex * STATIC_GRADIENT_SIZE + columnIndex) * PIXEL_CHANNEL_COUNT;
      data[offset] = red;
      data[offset + GREEN_CHANNEL_OFFSET] = green;
      data[offset + BLUE_CHANNEL_OFFSET] = blue;
      data[offset + ALPHA_CHANNEL_OFFSET] = MAX_CHANNEL;
    }
  }

  context.putImageData(image, 0, 0);
}

function buildColorVectors(colors: string[]) {
  const parsed = colors.map(buildColorVector);
  const base = parsed.length ? parsed : [[0, 0, 0]];
  return Array.from(
    { length: COLOR_POINT_COUNT },
    (_value, index) => base[index % base.length],
  );
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

function normalizeRotation(rotation?: number) {
  return ((rotation || 0) % FULL_ROTATION + FULL_ROTATION) % FULL_ROTATION;
}

function buildRotatedKeyPoints(rotation?: number) {
  const normalizedRotation = normalizeRotation(rotation);
  if (!normalizedRotation) return KEY_POINTS;

  const angle = normalizedRotation * DEGREES_TO_RADIANS;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return KEY_POINTS.map(([x, y]) => {
    const centeredX = x - ROTATION_CENTER;
    const centeredY = y - ROTATION_CENTER;
    return [
      centeredX * cos - centeredY * sin + ROTATION_CENTER,
      centeredX * sin + centeredY * cos + ROTATION_CENTER,
    ];
  });
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
  context.getExtension('WEBGL_lose_context')?.loseContext();
}
