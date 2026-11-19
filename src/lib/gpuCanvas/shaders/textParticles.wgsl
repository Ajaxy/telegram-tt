// Text spoiler particles of one canvas, drifting in straight lines like Telegram Android `SpoilerEffect`.
// A particle keeps no state: its rect comes from its index, and its spawn spot, velocity, alpha and age come from
// hashes of its index and life cycle at the clock of the canvas.
// A reveal flies every particle to the nearest pixel of a glyph, where it takes the glyph color and fades into the text.
// During it particles drift on from where they were at its start, slowing down, so the flight blends their positions
// in without a jump, and keep their alpha, so none brighten into view.

struct Scene {
  // Canvas width and height in pixels, canvas pixels per CSS pixel, edge fade in canvas pixels
  viewport: vec4f,
  // Morph origin in canvas pixels, emoji reveal radius in canvas pixels or a negative value before it,
  // farthest distance from the origin in canvas pixels
  reveal: vec4f,
  // Clock seconds at the reveal start or a negative value without one, unused, clock seconds,
  // whether the glyphs of the reveal are bound
  morph: vec4f,
  // Appear progress, particle count, seed, particle diameter in canvas pixels
  state: vec4f,
}

struct SpoilerRect {
  // Left, top, width and height in canvas pixels
  rect: vec4f,
  // Particle color and the index of the first particle of the rect
  color: vec4f,
}

// Where a particle flies on a morph, allocated only for its duration
struct Glyph {
  // Position on a glyph in canvas pixels, whether one is in reach, share of the particle size there
  spot: vec4f,
  // Color of the glyph pixel, unused
  color: vec4f,
}

struct Drift {
  position: vec2f,
  velocity: vec2f,
  alpha: f32,
  // Clock seconds of the next respawn
  respawn_at: f32,
}

// Morph timings in seconds, set by the worker
override FLY_DURATION: f32;
override SPREAD_DURATION: f32;
override JITTER_DURATION: f32;
override FADE_DURATION: f32;

// Speed of particles in CSS pixels per second
const MIN_SPEED: f32 = 8.0;
const SPEED_RANGE: f32 = 12.0;
// Lifetime of particles in seconds, `MAX_TEXT_LIFETIME` of the worker follows their sum
const MIN_LIFETIME: f32 = 1.0;
const LIFETIME_RANGE: f32 = 2.0;
const ALPHAS = array<f32, 3>(0.3, 0.6, 1.0);
const TAU: f32 = 6.2831853;
// Farthest glyph pixel a particle flies to in CSS pixels, a line height covers the gaps between words
const SEARCH_RADIUS: i32 = 16;
const GLYPH_THRESHOLD: f32 = 0.5;
// Particles shrink to this share of their size on a thin glyph stroke, closer to the stroke width of the text.
// Glyphs as thick as `SOLID_GLYPH_THICKNESS` CSS pixels, such as emoji, keep the full size.
const GLYPH_SIZE_SHARE: f32 = 0.5;
const SOLID_GLYPH_THICKNESS: f32 = 4.0;
// How far a particle goes into a glyph past its nearest pixel in CSS pixels
const MAX_GLYPH_DEPTH: i32 = 12;
// Seconds the drift of a reveal slows down over, which bounds how far it carries particles
const REVEAL_DRIFT_TIME: f32 = 0.3;

@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var<storage, read_write> glyphs: array<Glyph>;
@group(0) @binding(2) var<storage, read> rects: array<SpoilerRect>;
@group(0) @binding(3) var glyph_mask: texture_2d<f32>;

fn hash_u32(value: u32) -> u32 {
  var x = value + 0x9e3779b9u;
  x = x ^ (x >> 16u);
  x = x * 0x7feb352du;
  x = x ^ (x >> 15u);
  x = x * 0x846ca68bu;
  return x ^ (x >> 16u);
}

fn random01(value: u32) -> f32 {
  return f32(hash_u32(value) >> 8u) * (1.0 / 16777216.0);
}

fn get_particle_key(index: u32) -> u32 {
  return hash_u32(index ^ bitcast<u32>(scene.state.z));
}

// The last rect starting at or before the particle owns it, as rects without particles start where the next one does
fn find_rect(index: u32) -> u32 {
  var low = 0u;
  var high = arrayLength(&rects) - 1u;
  while (low < high) {
    let middle = (low + high + 1u) / 2u;
    if (u32(rects[middle].color.a) <= index) {
      low = middle;
    } else {
      high = middle - 1u;
    }
  }

  return low;
}

// The drawn rect grows by half the edge fade, which then runs inwards from its sides
fn get_drawn_rect(rect: vec4f) -> vec4f {
  let outset = scene.viewport.w * 0.5;
  return vec4f(rect.xy - vec2f(outset), rect.zw + vec2f(outset * 2.0));
}

// Particles start at different ages, so they do not respawn together, and fade in and out over their lifetimes,
// so they do not pop up and the darkest ones show only briefly
fn calc_drift(key: u32, rect: vec4f, time: f32) -> Drift {
  let lifetime = MIN_LIFETIME + random01(key ^ 0x85ebca6bu) * LIFETIME_RANGE;
  let phase = random01(key ^ 0xc2b2ae35u);
  let cycles = time / lifetime + phase;
  let cycle = floor(cycles);
  let cycle_key = hash_u32(key ^ hash_u32(u32(cycle)));
  let angle = random01(cycle_key ^ 0x1b873593u) * TAU;
  let speed = (MIN_SPEED + random01(cycle_key ^ 0xcc9e2d51u) * SPEED_RANGE) * scene.viewport.z;
  let velocity = vec2f(cos(angle), sin(angle)) * speed;
  let spawn = rect.xy + vec2f(random01(cycle_key), random01(cycle_key ^ 0x68bc21ebu)) * rect.zw;
  let age = cycles - cycle;
  let moved = spawn + velocity * age * lifetime;
  let alphas = ALPHAS;

  return Drift(
    moved - floor((moved - rect.xy) / rect.zw) * rect.zw,
    velocity,
    alphas[hash_u32(cycle_key ^ 0x27d4eb2fu) % 3u] * sin(age * TAU * 0.5),
    (cycle + 1.0 - phase) * lifetime,
  );
}

// A particle waits for the morph front, which spreads from the origin, plus a random jitter
fn calc_morph_delay(position: vec2f, key: u32, origin: vec2f, max_radius: f32) -> f32 {
  return distance(position, origin) / max(max_radius, 1.0) * SPREAD_DURATION
    + random01(key ^ 0x27d4eb2fu) * JITTER_DURATION;
}

// Glyphs are drawn premultiplied, text in its color and emoji in theirs
fn test_glyph_texel(texel: vec2i, center: vec2i, size: vec2i, best: ptr<function, vec3i>) {
  if (any(texel < vec2i(0)) || any(texel >= size)) {
    return;
  }

  let offset = texel - center;
  let distance = dot(offset, offset);
  if (distance < (*best).z && textureLoad(glyph_mask, texel, 0).a > GLYPH_THRESHOLD) {
    *best = vec3i(texel, distance);
  }
}

fn step_texel(texel: vec2i, direction: vec2f, distance: f32) -> vec2i {
  return vec2i(floor(vec2f(texel) + vec2f(0.5) + direction * distance));
}

fn is_glyph_texel(texel: vec2i, size: vec2i) -> bool {
  return all(texel >= vec2i(0)) && all(texel < size) && textureLoad(glyph_mask, texel, 0).a > GLYPH_THRESHOLD;
}

// Counts glyph pixels following the given one in a direction
fn measure_glyph_run(texel: vec2i, direction: vec2f, size: vec2i) -> i32 {
  var run = 0;
  for (var i = 1; i <= MAX_GLYPH_DEPTH; i++) {
    if (!is_glyph_texel(step_texel(texel, direction, f32(i)), size)) {
      break;
    }
    run = i;
  }

  return run;
}

// The narrower of two perpendicular spans through a glyph pixel tells a stroke from a solid shape
fn measure_glyph_thickness(texel: vec2i, direction: vec2f, size: vec2i) -> f32 {
  let across = vec2f(-direction.y, direction.x);
  let along_run = measure_glyph_run(texel, direction, size) + measure_glyph_run(texel, -direction, size);
  let across_run = measure_glyph_run(texel, across, size) + measure_glyph_run(texel, -across, size);
  return f32(min(along_run, across_run) + 1);
}

// Searches square rings of growing radius around where the particle is at the morph start
// until no closer glyph pixel can follow
@compute @workgroup_size(64)
fn assign(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= u32(scene.state.y)) {
    return;
  }

  let key = get_particle_key(index);
  let position = calc_drift(key, get_drawn_rect(rects[find_rect(index)].rect), scene.morph.x).position;
  let size = vec2i(textureDimensions(glyph_mask));
  // The glyphs cover the canvas in CSS pixels, or fewer pixels for content beyond the largest texture
  let texels_per_pixel = vec2f(size) / scene.viewport.xy;
  let center = vec2i(floor(position * texels_per_pixel));
  let no_glyph = SEARCH_RADIUS * SEARCH_RADIUS * 2 + 1;
  var best = vec3i(0, 0, no_glyph);

  for (var radius = 0; radius <= SEARCH_RADIUS; radius++) {
    if (radius * radius > best.z) {
      break;
    }

    for (var i = -radius; i <= radius; i++) {
      test_glyph_texel(center + vec2i(i, -radius), center, size, &best);
      test_glyph_texel(center + vec2i(i, radius), center, size, &best);
      test_glyph_texel(center + vec2i(-radius, i), center, size, &best);
      test_glyph_texel(center + vec2i(radius, i), center, size, &best);
    }
  }

  let glyph_key = key ^ 0x5bd1e995u;
  let has_glyph = best.z < no_glyph;

  // Particles go on into the glyph by a random share of its depth along their way, so they fill solid glyphs
  // instead of piling up on the edges. Particles already inside stay.
  var target_texel = best.xy;
  var direction = vec2f(1.0, 0.0);
  if (has_glyph && best.z > 0) {
    direction = normalize(vec2f(best.xy - center));
    let run = measure_glyph_run(best.xy, direction, size);
    target_texel = step_texel(best.xy, direction, floor(random01(glyph_key ^ 0x1656667bu) * f32(run + 1)));
  }
  let thickness = select(1.0, measure_glyph_thickness(target_texel, direction, size), has_glyph);

  // A random spot inside the pixel keeps the particles off a grid
  let jitter = vec2f(random01(glyph_key), random01(glyph_key ^ 0x9e3779b9u));
  let color = textureLoad(glyph_mask, target_texel, 0);
  let size_share = mix(GLYPH_SIZE_SHARE, 1.0, clamp((thickness - 1.0) / (SOLID_GLYPH_THICKNESS - 1.0), 0.0, 1.0));
  glyphs[index].spot = vec4f(
    (vec2f(target_texel) + jitter) / texels_per_pixel, select(0.0, 1.0, has_glyph), size_share,
  );
  glyphs[index].color = vec4f(color.rgb / max(color.a, 0.00001), 0.0);
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) color: vec4f,
  // Radius of the particle disc in canvas pixels
  @location(2) @interpolate(flat) radius: f32,
}

@group(0) @binding(1) var<storage, read> render_glyphs: array<Glyph>;

fn ease_in_out(progress: f32) -> f32 {
  return progress * progress * (3.0 - 2.0 * progress);
}

@vertex
fn vertex_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  let corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertex_index];
  let spoiler = rects[find_rect(instance_index)];
  let rect = get_drawn_rect(spoiler.rect);
  let key = get_particle_key(instance_index);
  let time = scene.morph.z;
  let anchor = scene.morph.x;

  var drift = calc_drift(key, rect, time);
  var delay = 0.0;
  if (anchor >= 0.0) {
    let anchored = calc_drift(key, rect, anchor);
    delay = calc_morph_delay(anchored.position, key, scene.reveal.xy, scene.reveal.w);
    let drift_time = REVEAL_DRIFT_TIME * (1.0 - exp((anchor - time) / REVEAL_DRIFT_TIME));
    drift = anchored;
    drift.position = anchored.position + anchored.velocity * drift_time;
  }

  var position = drift.position;
  var color = spoiler.color.rgb;
  var size_share = 1.0;
  // Particles fade out past the edges of their rects, where they wrap or a morph carries them
  var alpha = drift.alpha * scene.state.x;
  if (scene.viewport.w > 0.0) {
    let distance_to_edge = min(position - rect.xy, rect.xy + rect.zw - position);
    alpha = alpha * smoothstep(0.0, scene.viewport.w, min(distance_to_edge.x, distance_to_edge.y));
  }

  if (anchor >= 0.0 && scene.morph.w > 0.5) {
    let glyph = render_glyphs[instance_index];
    let elapsed = time - anchor;
    // Particles without a glyph in reach fade out where they are
    let has_glyph = glyph.spot.z > 0.5;
    let target_position = select(position, glyph.spot.xy, has_glyph);
    // Brightening the faint particles would show them as new ones
    let target_alpha = glyph.spot.z * alpha;
    let target_color = select(color, glyph.color.rgb, has_glyph);
    let progress = ease_in_out(clamp((elapsed - delay) / FLY_DURATION, 0.0, 1.0));
    let fade = clamp((elapsed - delay - FLY_DURATION) / FADE_DURATION, 0.0, 1.0);
    alpha = mix(alpha, target_alpha, progress) * (1.0 - fade);
    color = mix(color, target_color, progress);
    size_share = mix(1.0, glyph.spot.w, progress);
    position = mix(position, target_position, progress);
  }

  let radius = scene.state.w * size_share * 0.5;
  // Half a pixel more on each side leaves room for the smooth edge
  let position_px = position + corner * (radius + 0.5);

  var output: VertexOutput;
  output.position = vec4f(
    position_px.x / scene.viewport.x * 2.0 - 1.0,
    1.0 - position_px.y / scene.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.uv = corner * (radius + 0.5);
  output.color = vec4f(color, alpha);
  output.radius = radius;
  return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
  let coverage = clamp(input.radius + 0.5 - length(input.uv), 0.0, 1.0);
  let alpha = input.color.a * coverage;
  if (alpha <= 0.0) {
    discard;
  }

  return vec4f(input.color.rgb * alpha, alpha);
}
