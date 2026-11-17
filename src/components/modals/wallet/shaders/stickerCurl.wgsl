// A port of `WalletSticker.metal` of the iOS app.
//
// The sticker peels off and sticks down in a wave. A fold line runs across it: above the line the sticker lies flat,
// below it the sticker is raised. At the fold it curls in an arc up to the `bend` angle and goes straight past it. The
// eye is above the middle of the sticker: the raised part is closer to it and larger, it is lighter where it faces the
// light from above, and it catches a gloss on the curl. Under the raised part its shadow falls on the surface, farther
// and softer the higher the part is.

struct Uniforms {
  // The top left corner of the sticker in the layer (x, y), its side (z) and the layer side (w). The layer leaves room
  // around the sticker for its growth and shadow.
  frame: vec4f,
  // `front`: the fold line as a share of the side from the top, which a peel moves up and a stick moves down.
  // `bend`, `shade`: the angle of the raised part and the strength of its shadow. `border`: the die-cut over the art.
  effect: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var image: texture_2d<f32>;
@group(0) @binding(2) var art: texture_2d<f32>;
@group(0) @binding(3) var textureSampler: sampler;

const BISECTION_STEPS = 18;
const SHADOW_TAPS = 16;
const SHADOW_DROP = 0.5;
const GOLDEN_ANGLE = 2.3999632;
const TAU = 6.2831853;

@vertex
fn stickerVertex(@builtin(vertex_index) index: u32) -> VertexOutput {
  let points = array(vec2f(-1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(1.0, -1.0));
  let uvs = array(vec2f(0.0, 0.0), vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));

  var output: VertexOutput;
  output.position = vec4f(points[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

// Transparent outside the texture, as the clamp-to-zero sampler of the iOS app
fn sampleSticker(point: vec2f) -> vec4f {
  if (any(point < vec2f(0.0)) || any(point > vec2f(1.0))) {
    return vec4f(0.0);
  }

  let bare = textureSampleLevel(art, textureSampler, point, 0.0);
  let cut = textureSampleLevel(image, textureSampler, point, 0.0);
  return mix(bare, cut, uniforms.effect.w);
}

// The point of the raised part `t` from the fold, along the sticker: its shift along the surface and its height above it
fn stickerArc(t: f32, angle: f32, curl: f32) -> vec2f {
  let radius = curl / max(angle, 0.001);
  if (t <= curl) {
    let a = t / radius;
    return vec2f(radius * sin(a), radius * (1.0 - cos(a)));
  }

  return vec2f(radius * sin(angle), radius * (1.0 - cos(angle))) + (t - curl) * vec2f(cos(angle), sin(angle));
}

@fragment
fn stickerFragment(input: VertexOutput) -> @location(0) vec4f {
  let frame = uniforms.frame;
  let front = uniforms.effect.x;
  let angle = uniforms.effect.y;
  let shadow = uniforms.effect.z;
  let position = input.uv * frame.w;
  let side = frame.z;
  let hinge = frame.y + front * side;
  if (position.y <= hinge || angle <= 0.0005) {
    return sampleSticker((position - frame.xy) / side);
  }

  let center = frame.xy + 0.5 * side;
  let camera = 2.8 * side;
  let curl = 0.3 * side;
  let reach = max(frame.w - hinge, 0.0);
  let tip = stickerArc(reach, angle, curl);

  // The raised part: which of its points shows here. Its height on the screen grows with `t`, so halving finds it.
  var color = vec4f(0.0);
  let tipY = center.y + (hinge + tip.x - center.y) * camera / (camera - tip.y);
  if (position.y <= tipY) {
    var low = 0.0;
    var high = reach;
    for (var i = 0; i < BISECTION_STEPS; i++) {
      let middle = 0.5 * (low + high);
      let point = stickerArc(middle, angle, curl);
      let y = center.y + (hinge + point.x - center.y) * camera / (camera - point.y);
      if (y < position.y) {
        low = middle;
      } else {
        high = middle;
      }
    }

    let t = 0.5 * (low + high);
    let point = stickerArc(t, angle, curl);
    let magnification = camera / (camera - point.y);
    color = sampleSticker((vec2f(center.x + (position.x - center.x) / magnification, hinge + t) - frame.xy) / side);

    let theta = angle * min(t / curl, 1.0);
    let lambert = (0.45 * sin(theta) + 0.89 * cos(theta)) / 0.89;
    let glossOffset = (theta - 0.26) / 0.09;
    let gloss = exp(-glossOffset * glossOffset) * smoothstep(0.2, 0.4, angle) * 0.5;
    color = vec4f(min(color.rgb * lambert + gloss * color.a, vec3f(color.a)), color.a);
  }

  // The shadow: the point `t` of the raised part casts it on the surface `SHADOW_DROP` of its heights lower, the more
  // blurred the higher the point is
  if (shadow > 0.001 && position.y < hinge + tip.x + SHADOW_DROP * tip.y) {
    var low = 0.0;
    var high = reach;
    for (var i = 0; i < BISECTION_STEPS; i++) {
      let middle = 0.5 * (low + high);
      let point = stickerArc(middle, angle, curl);
      if (hinge + point.x + SHADOW_DROP * point.y < position.y) {
        low = middle;
      } else {
        high = middle;
      }
    }

    let t = 0.5 * (low + high);
    let z = stickerArc(t, angle, curl).y;
    let blur = 0.5 + 0.16 * z;
    // The taps go in a spiral turned differently at each pixel, which keeps the edge smooth without steps or doubling
    let spin = TAU * fract(52.9829189 * fract(dot(position * 3.0, vec2f(0.06711056, 0.00583715))));
    var alpha = 0.0;
    for (var i = 0; i < SHADOW_TAPS; i++) {
      let radius = sqrt((f32(i) + 0.5) / f32(SHADOW_TAPS)) * blur;
      let turn = f32(i) * GOLDEN_ANGLE + spin;
      alpha += sampleSticker((vec2f(position.x, hinge + t) + radius * vec2f(cos(turn), sin(turn)) - frame.xy) / side).a;
    }

    alpha *= shadow * 0.5 / f32(SHADOW_TAPS) * smoothstep(0.0, 4.0, z);
    color += (1.0 - color.a) * vec4f(0.0, 0.0, 0.0, alpha);
  }

  return color;
}
