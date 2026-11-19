(function(){let e={spread:250,jitter:120,fly:450,fade:200},t=e.spread+e.jitter+e.fly+e.fade,n,r,i=0,a=!1;function o(){return!!navigator.gpu&&!a}async function s(){if(!o())return;i++,n??=c();let e=await n;if(!e){i--;return}let t=!1;return{...e,release(){t||(t=!0,i--,i||l())}}}async function c(){try{let e=await navigator.gpu.requestAdapter();if(!e||e.info?.isFallbackAdapter){a=!0,n=void 0;return}let t=await e.requestDevice(),i={device:t,format:navigator.gpu.getPreferredCanvasFormat()};return t.lost.then(()=>{r===i&&(r=void 0,n=void 0)}),r=i,i}catch{a=!0,n=void 0;return}}function l(){let e=r;r=void 0,n=void 0,e?.device.destroy()}var u=`// Custom emoji frames drawn as quads. An emoji under a concealed spoiler stays hidden until the reveal front reaches it,
// then fades in over the soft edge of the front.

struct Scene {
  // Canvas width and height in pixels, canvas pixels per CSS pixel, edge fade in canvas pixels
  viewport: vec4f,
  // Ripple origin in canvas pixels with the Y axis pointing down, front radius in canvas pixels
  // or a negative value before the reveal, ring width in canvas pixels
  reveal: vec4f,
  // Tile offset, tile pixels per CSS pixel and tile size
  tile: vec4f,
  // Appear progress of the particles, unused
  state: vec4f,
}

struct View {
  // Left, top, width and height in pixels
  rect: vec4f,
  // Whether a spoiler conceals the emoji, soft edge of the reveal front in pixels, unused
  state: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var emoji_sampler: sampler;
@group(1) @binding(0) var<uniform> view: View;
@group(1) @binding(1) var emoji_texture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  let corners = array<vec2f, 4>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertex_index];
  let position_px = view.rect.xy + corner * view.rect.zw;

  var output: VertexOutput;
  output.position = vec4f(
    position_px.x / scene.viewport.x * 2.0 - 1.0,
    1.0 - position_px.y / scene.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.uv = corner;
  return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(emoji_texture, emoji_sampler, input.uv);
  var alpha = color.a;
  if (view.state.x > 0.5) {
    let visibility = clamp(
      (scene.reveal.z - distance(input.position.xy, scene.reveal.xy)) / max(view.state.y, 0.0001), 0.0, 1.0,
    );
    if (visibility <= 0.0) {
      discard;
    }

    alpha = alpha * visibility;
  }

  return vec4f(color.rgb * alpha, alpha);
}
`,d=`// Media spoiler particles, ported from the curl noise of Telegram Android \`SpoilerEffect2\`.
// One simulation fills a seamless tile that every media spoiler samples.
// Particles live in tile pixels with the Y axis pointing up and wrap around the edges, where the curl noise repeats too.

struct Params {
  // Tile size, particle size in pixels, tile pixels per CSS pixel
  viewport: vec4f,
  // Time, delta time, seed, noise scale
  clock: vec4f,
  // Noise speed, noise movement, force multiplier, damping
  motion: vec4f,
  // Velocity multiplier, max velocity, longevity, unused
  lifecycle: vec4f,
  // Particle count, reset flag, frame index, unused
  system: vec4u,
}

struct Particle {
  pos_vel: vec4f,
  // Time, duration, unused, rendered alpha
  life: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

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

fn rand(n: vec2f) -> f32 {
  let key = bitcast<u32>(n.x)
    ^ hash_u32(bitcast<u32>(n.y))
    ^ hash_u32(bitcast<u32>(params.clock.z));
  return random01(key);
}

fn loop4(p: vec4f) -> vec4f {
  let scale = params.clock.w;
  return vec4f(
    fract(p.xy / scale) * scale,
    fract(p.zw / scale) * scale
  );
}

fn loop3(p: vec3f) -> vec3f {
  let scale = params.clock.w;
  return vec3f(fract(p.xy / scale) * scale, p.z);
}

fn mod289v(x: vec4f) -> vec4f {
  return x - floor(x * (1.0 / (289.0 + params.clock.z))) * (289.0 + params.clock.z);
}

fn perm(x: vec4f) -> vec4f {
  return mod289v(((x * 34.0) + 1.0) * x);
}

fn noise(p: vec3f) -> f32 {
  let a = floor(p);
  var d = p - a;
  d = d * d * (3.0 - 2.0 * d);

  let b = a.xxyy + vec4f(0.0, 1.0, 0.0, 1.0);
  let k1 = perm(loop4(b.xyxy));
  let k2 = perm(loop4(k1.xyxy + b.zzww));

  let c = k2 + a.zzzz;
  let k3 = perm(c);
  let k4 = perm(c + 1.0);

  let o3 = fract(k4 / 41.0) * d.z + fract(k3 / 41.0) * (1.0 - d.z);
  let o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
  return o4.y * d.y + o4.x * (1.0 - d.y);
}

fn grad(p: vec3f) -> vec3f {
  let e = vec2f(0.1, 0.0);
  return vec3f(
    noise(loop3(p + e.xyy)) - noise(loop3(p - e.xyy)),
    noise(loop3(p + e.yxy)) - noise(loop3(p - e.yxy)),
    noise(loop3(p + e.yyx)) - noise(loop3(p - e.yyx))
  ) / (2.0 * e.x);
}

fn curl_noise(p: vec3f) -> vec3f {
  let uv = fract(p.xy / params.viewport.xy) * params.clock.w;
  let q = vec3f(uv, p.z);
  let e = vec2f(0.01, 0.0);
  return grad(loop3(q)).yzx - vec3f(
    grad(loop3(q + e.yxy)).z,
    grad(loop3(q + e.yyx)).x,
    grad(loop3(q + e.xyy)).y
  );
}

fn spawn_position(index: u32) -> vec2f {
  let count = max(params.system.x, 1u);
  let columns = max(1u, u32(ceil(sqrt(f32(count)))));
  let rows = (count + columns - 1u) / columns;
  let key = hash_u32(index ^ hash_u32(params.system.z) ^ bitcast<u32>(params.clock.z));
  let cell_index = select(hash_u32(key ^ 0xa511e9b3u) % (columns * rows), index, params.system.y == 1u);
  let cell = vec2u(cell_index % columns, cell_index / columns);
  let jitter = vec2f(random01(key), random01(key ^ 0x68bc21ebu));

  return (vec2f(cell) + jitter) / vec2f(f32(columns), f32(rows)) * params.viewport.xy;
}

@compute @workgroup_size(128)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= params.system.x) {
    return;
  }

  let current = particles[index];
  var position = current.pos_vel.xy;
  var velocity = current.pos_vel.zw;
  var particle_time = current.life.x + params.clock.y * current.life.y / max(params.lifecycle.z, 0.00001);
  var particle_duration = current.life.y;

  if (params.system.y == 1u) {
    let n = f32(index);
    particle_time = rand(vec2f(-94.3, 83.9) * vec2f(n));
    particle_duration = 0.5 + 2.0 * rand(vec2f(n) + params.clock.z * 32.4);
    position = spawn_position(index);
    velocity = vec2f(0.0);
  } else if (particle_time >= 1.0) {
    particle_time = 0.0;
    position = spawn_position(index);
    particle_duration = 0.5 + 2.0 * rand(vec2f(f32(index)) + position);
    velocity = vec2f(0.0);
  }

  let min_size = min(params.viewport.x, params.viewport.y);
  let curl = curl_noise(vec3f(
    position + params.clock.x * (params.motion.y / 100.0 * min_size),
    params.clock.x * params.motion.x + rand(position) * 2.5
  )).xy;
  let force = curl / max(length(curl), 0.00001);

  velocity = velocity + force * params.motion.z * params.clock.y * min_size * 0.1;
  velocity = velocity * params.motion.w;
  let velocity_length = length(velocity);
  let max_velocity_px = params.lifecycle.y / 100.0 * min_size;
  if (velocity_length > max_velocity_px) {
    velocity = velocity / velocity_length * max_velocity_px;
  }

  position = position + velocity * params.lifecycle.x * params.clock.y;
  position = position - floor(position / params.viewport.xy) * params.viewport.xy;

  let render_alpha = sin(particle_time * 3.14) * (0.6 + 0.4 * rand(vec2f(f32(index))));

  particles[index].pos_vel = vec4f(position, velocity);
  particles[index].life = vec4f(particle_time, particle_duration, 0.0, render_alpha);
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) alpha: f32,
}

@group(0) @binding(0) var<uniform> render_params: Params;
@group(0) @binding(1) var<storage, read> render_particles: array<Particle>;

const COPIES_PER_PARTICLE: u32 = 4u;

// Every particle is drawn four times, shifted by the tile size towards the farther edges, so the tile repeats seamlessly
@vertex
fn vertex_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  let corners = array<vec2f, 4>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, 1.0)
  );
  let corner = corners[vertex_index];
  let particle = render_particles[instance_index / COPIES_PER_PARTICLE];
  let copy = instance_index % COPIES_PER_PARTICLE;
  let size = render_params.viewport.xy;
  let position = particle.pos_vel.xy;
  let shift = select(-size, size, position < size * 0.5);
  let offset = vec2f(
    select(0.0, shift.x, (copy & 1u) != 0u),
    select(0.0, shift.y, (copy & 2u) != 0u)
  );
  let position_px = position + offset + corner * render_params.viewport.z * 0.5;
  let clip = position_px / size * 2.0 - vec2f(1.0);

  var output: VertexOutput;
  output.position = vec4f(clip, 0.0, 1.0);
  output.uv = corner;
  output.alpha = particle.life.w;
  return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
  if (dot(input.uv, input.uv) > 1.0) {
    discard;
  }
  return vec4f(input.alpha, 0.0, 0.0, input.alpha);
}
`,f=`// Spoiler regions sampling the shared particle tile. Edges fade so particles do not get cut,
// and a reveal ripple pushes particles out from the click and leaves nothing behind its front.

struct Scene {
  // Canvas width and height in pixels, canvas pixels per CSS pixel, edge fade in canvas pixels
  viewport: vec4f,
  // Ripple origin in canvas pixels with the Y axis pointing down, front radius in canvas pixels
  // or a negative value before the reveal, ring width in canvas pixels
  reveal: vec4f,
  // Tile offset in tile pixels, tile pixels per CSS pixel, tile size in pixels
  tile: vec4f,
  // Appear progress, unused
  state: vec4f,
}

struct SpoilerRect {
  // Left, top, width and height in canvas pixels
  rect: vec4f,
  // Particle color and density
  color: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var tile_texture: texture_2d<f32>;
@group(0) @binding(2) var tile_sampler: sampler;
@group(0) @binding(3) var<storage, read> rects: array<SpoilerRect>;

// Share of the ring width the particles move by at the ripple front
const RIPPLE_STRENGTH: f32 = 0.35;
// Share of the ring width the front fades over
const RIPPLE_FEATHER: f32 = 0.2;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) rect: vec4f,
  @location(1) @interpolate(flat) color: vec4f,
}

@vertex
fn vertex_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  let corners = array<vec2f, 4>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(1.0, 1.0));
  let spoiler = rects[instance_index];
  // The drawn rect grows by half the edge fade, which then runs inwards from its sides
  let outset = scene.viewport.w * 0.5;
  let rect = vec4f(spoiler.rect.xy - vec2f(outset), spoiler.rect.zw + vec2f(outset * 2.0));
  let position_px = rect.xy + corners[vertex_index] * rect.zw;

  var output: VertexOutput;
  output.position = vec4f(
    position_px.x / scene.viewport.x * 2.0 - 1.0,
    1.0 - position_px.y / scene.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.rect = rect;
  output.color = spoiler.color;
  return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
  let position = input.position.xy;
  var alpha = input.color.a * scene.state.x;

  if (scene.viewport.w > 0.0) {
    let distance_to_edge = min(position - input.rect.xy, input.rect.xy + input.rect.zw - position);
    // A flat start at the rim keeps the region without a visible border
    alpha = alpha * smoothstep(0.0, scene.viewport.w, min(distance_to_edge.x, distance_to_edge.y));
  }

  var sample_position = position;
  let radius = scene.reveal.z;
  if (radius >= 0.0) {
    let ring = scene.reveal.w;
    let vector = position - scene.reveal.xy;
    let distance = length(vector);
    let behind_front = distance - radius;
    if (behind_front < 0.0) {
      discard;
    }

    let wave = clamp(1.0 - behind_front / ring, 0.0, 1.0);
    sample_position = position - vector / max(distance, 0.0001) * wave * wave * ring * RIPPLE_STRENGTH;
    alpha = alpha * smoothstep(0.0, ring * RIPPLE_FEATHER, behind_front);
  }

  let tile_position = sample_position / scene.viewport.z * scene.tile.z + scene.tile.xy;
  let particles = textureSampleLevel(tile_texture, tile_sampler, tile_position / scene.tile.w, 0.0).r;
  let result = particles * alpha;

  return vec4f(input.color.rgb * result, result);
}
`,p=`// Text spoiler particles of one canvas, drifting in straight lines like Telegram Android \`SpoilerEffect\`.
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
// Lifetime of particles in seconds, \`MAX_TEXT_LIFETIME\` of the worker follows their sum
const MIN_LIFETIME: f32 = 1.0;
const LIFETIME_RANGE: f32 = 2.0;
const ALPHAS = array<f32, 3>(0.3, 0.6, 1.0);
const TAU: f32 = 6.2831853;
// Farthest glyph pixel a particle flies to in CSS pixels, a line height covers the gaps between words
const SEARCH_RADIUS: i32 = 16;
const GLYPH_THRESHOLD: f32 = 0.5;
// Particles shrink to this share of their size on a thin glyph stroke, closer to the stroke width of the text.
// Glyphs as thick as \`SOLID_GLYPH_THICKNESS\` CSS pixels, such as emoji, keep the full size.
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
`;let m=`r8unorm`,h={size:320,density:.03,particleSize:2},g=1/60,_=[1,1,1],v={radius:-1,edge:0},y={color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},b=/* @__PURE__ */ new Map,x=/* @__PURE__ */ new Map,S=/* @__PURE__ */ new Map,C=/* @__PURE__ */ new ArrayBuffer(80),w=new Float32Array(C),ee=new Uint32Array(C),T=new Float32Array(64/Float32Array.BYTES_PER_ELEMENT),E=new Float32Array(32/Float32Array.BYTES_PER_ELEMENT),D=Math.random()*10,O,k,A,j,M=!0,N=!1,P,F=!1,I=0,L,R;onmessage=({data:e})=>{e.forEach(te),V()},z();function te(e){switch(e.type){case`create`:b.set(e.id,{kind:e.kind,canvas:e.canvas,cssWidth:0,cssHeight:0,dpr:1,rects:[],isDirty:!0,shouldUpdateRects:!0,tileOffsetX:Math.random()*h.size,tileOffsetY:Math.random()*h.size,rectCount:0,clock:0,particleCount:0,emojis:/* @__PURE__ */ new Map});break;case`resize`:{let t=b.get(e.id);if(!t)return;t.cssWidth=e.width,t.cssHeight=e.height,t.dpr=e.dpr,t.shouldUpdateRects=!0,t.isDirty=!0;break}case`setSpoilers`:{let t=b.get(e.id);if(!t)return;if(t.reveal){t.pendingRects=e.rects;return}if(ne(t.rects,e.rects))return;t.rects=e.rects,e.rects.length&&(t.isRevealed=!1),t.shouldUpdateRects=!0,t.isDirty=!0;break}case`reveal`:{let t=b.get(e.id);if(!t||t.reveal||!U(t)||!M){e.glyphs?.close(),t&&!M&&U(t)&&W(t);return}t.isDirty=!0,t.reveal={x:e.x,y:e.y,startedAt:performance.now(),glyphs:e.glyphs};break}case`setVisible`:{let t=b.get(e.id);if(!t)return;e.isVisible&&!t.isVisible&&(t.isDirty=!0),t.isVisible=e.isVisible;break}case`destroy`:{let t=b.get(e.id);if(!t)return;t.reveal?.glyphs?.close(),Q(t),t.context?.unconfigure(),b.delete(e.id);break}case`setEmoji`:{let t=b.get(e.id);if(!t)return;let n=t.emojis.get(e.viewId);n?.renderId===e.renderId?(n.x=e.x,n.y=e.y,n.size=e.size):($(n),t.emojis.set(e.viewId,{renderId:e.renderId,x:e.x,y:e.y,size:e.size})),t.isDirty=!0;break}case`drawEmoji`:{let t=b.get(e.id),n=t?.emojis.get(e.viewId);if(!n)return;n.frameIndex=e.frameIndex,t.isDirty=!0;break}case`removeEmoji`:{let t=b.get(e.id),n=t?.emojis.get(e.viewId);if(!n)return;$(n),t.emojis.delete(e.viewId),t.isDirty=!0;break}case`clearFrames`:Number.isFinite(e.generation)?x.set(e.renderId,{generation:e.generation,frames:/* @__PURE__ */ new Map}):x.delete(e.renderId);break;case`dropFrame`:x.get(e.renderId)?.frames.delete(e.frameIndex);break;case`connectMediaWorker`:e.port.onmessage=({data:e})=>{re(e),V()};break;case`setPlayback`:M=e.isAnimated,N=e.isPaused,P=e.maxFps}}function ne(e,t){let n=(e,t)=>Math.abs(e-t)<.01;return e.length===t.length&&e.every((e,r)=>{let i=t[r];return n(e.x,i.x)&&n(e.y,i.y)&&n(e.width,i.width)&&n(e.height,i.height)&&e.density===i.density&&e.color===i.color&&e.isEmoji===i.isEmoji})}function re(e){let t=x.get(e.renderId);if(!t||t.generation<e.generation)t={generation:e.generation,frames:/* @__PURE__ */ new Map},x.set(e.renderId,t);else if(t.generation>e.generation)return;t.frames.set(e.frameIndex,e),b.forEach(t=>{t.emojis.forEach(n=>{n.renderId===e.renderId&&n.frameIndex===e.frameIndex&&(t.isDirty=!0)})})}function z(){return k??=ie().then(e=>{if(O=e,!e)postMessage({type:`unavailable`});else return postMessage({type:`ready`}),e.device.lost.then(ae),b.forEach(e=>{e.isDirty=!0}),V(),e}),k}async function ie(){let t=await s();if(!t)return;let{device:n,format:r}=t;try{let i=n.createShaderModule({code:d}),a=n.createShaderModule({code:f}),o=n.createShaderModule({code:u}),s=n.createShaderModule({code:p}),c={FLY_DURATION:e.fly/1e3,SPREAD_DURATION:e.spread/1e3,JITTER_DURATION:e.jitter/1e3,FADE_DURATION:e.fade/1e3},[l,h,g,_,v,y]=await Promise.all([n.createComputePipelineAsync({layout:`auto`,compute:{module:i,entryPoint:`simulate`}}),B(n,i,m),B(n,a,r),B(n,o,r),n.createComputePipelineAsync({layout:`auto`,compute:{module:s,entryPoint:`assign`,constants:c}}),B(n,s,r,c)]);return{...t,computePipeline:l,particlePipeline:h,spoilerPipeline:g,emojiPipeline:_,textAssignPipeline:v,textParticlePipeline:y,emptyGlyphBuffer:n.createBuffer({size:32,usage:GPUBufferUsage.STORAGE}),tileSampler:n.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`repeat`,addressModeV:`repeat`}),emojiSampler:n.createSampler({magFilter:`linear`,minFilter:`linear`})}}catch{t.release();return}}function B(e,t,n,r){return e.createRenderPipelineAsync({layout:`auto`,vertex:{module:t,entryPoint:`vertex_main`,constants:r},fragment:{module:t,entryPoint:`fragment_main`,constants:r,targets:[{format:n,blend:y}]},primitive:{topology:`triangle-strip`}})}function ae(){O?.release(),O=void 0,k=void 0,A=void 0,b.forEach(e=>{Q(e),e.context=void 0,e.isDirty=!0}),z()}function V(){!F&&O&&(F=!0,requestAnimationFrame(oe))}function oe(e){if(F=!1,!O)return;let n=P&&R!==void 0&&e<R-2;if(I>=2||n){V();return}if(P){let t=1e3/P;R=R===void 0||e-R>t?e+t:R+t}let r=L===void 0?g:Math.min((e-L)/1e3,.1),i=M&&!N,a=!1,o=!1,s=!1,c=!1;b.forEach(n=>{n.reveal&&se(n,e)>=(n.kind===`text`?t:500)&&W(n),n.kind===`media`&&U(n)&&n.cssWidth&&n.cssHeight&&(a=!0,n.isVisible&&i&&(o=!0))});let l=O.device.createCommandEncoder(),u=!1;if(a){let e=G(O);(o||e.shouldReset)&&(e.shouldReset&&!i&&le(O,e),ce(O,l,e,o?r:0),s=!0,u=!0)}b.forEach(t=>{if(!t.cssWidth||!t.cssHeight)return;let n=U(t),a=t.kind===`media`,d=!!t.isVisible&&(a?o:i),f=n&&(!!t.reveal||d||H(t,e)<1),p=n&&a&&!!t.isVisible&&s;(t.isDirty||f||p)&&(a?ue(O,l,t,G(O),e):de(O,l,t,e,d||t.reveal?r:0),t.isDirty=!1,u=!0,c||=f)}),u&&(O.device.queue.submit([l.finish()]),I++,O.device.queue.onSubmittedWorkDone().finally(()=>{I--})),L=c?e:void 0,c||(R=void 0),c&&V()}function H({appearedAt:e},t){return M?e===void 0?0:Math.min((t-e)/200,1):1}function U(e){return!e.isRevealed&&(e.kind===`media`||e.rects.length>0)}function se({kind:e,reveal:t,clock:n},r){return e===`media`?r-t.startedAt:t.anchorClock===void 0?0:(n-t.anchorClock)*1e3}function W(e){let{reveal:t,pendingRects:n}=e;t?.glyphs?.close(),t?.glyphTexture?.destroy(),e.glyphBuffer?.destroy(),e.glyphBuffer=void 0,e.textRenderBindGroup=void 0,e.reveal=void 0,e.pendingRects=void 0,e.isDirty=!0,e.rects=n||[],e.isRevealed=!e.rects.length,e.shouldUpdateRects=!0}function G(e){let t=1;b.forEach(({dpr:e})=>{t=Math.max(t,e)});let n=h,r=Math.round(n.size*t),i=A;if(i?.size===r)return i;let{device:a}=e;i?.texture.destroy(),i?.particles.destroy(),i?.uniform.destroy();let o=Math.ceil(n.size*n.size*n.density/128)*128,s=a.createBuffer({size:o*32,usage:GPUBufferUsage.STORAGE}),c=a.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return A={size:r,scale:r/n.size,particleCount:o,texture:a.createTexture({size:[r,r],format:m,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),particles:s,uniform:c,computeBindGroup:a.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:s}}]}),renderBindGroup:a.createBindGroup({layout:e.particlePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:s}}]}),time:0,frameIndex:0,shouldReset:!0},A}function ce(e,t,n,r){q(e.device,n,r),K(e,t,n);let i=t.beginRenderPass({colorAttachments:[{view:n.texture.createView(),clearValue:[0,0,0,0],loadOp:`clear`,storeOp:`store`}]});i.setPipeline(e.particlePipeline),i.setBindGroup(0,n.renderBindGroup),i.draw(4,n.particleCount*4),i.end()}function K(e,t,n){let r=t.beginComputePass();r.setPipeline(e.computePipeline),r.setBindGroup(0,n.computeBindGroup),r.dispatchWorkgroups(n.particleCount/128),r.end(),n.shouldReset=!1}function le(e,t){for(let n=0;n<60;n++){q(e.device,t,g);let n=e.device.createCommandEncoder();K(e,n,t),e.device.queue.submit([n.finish()])}}function q(e,t,n){t.shouldReset&&(t.time=0),t.time+=n;let{particleSize:r}=h;w.set([t.size,t.size,r*t.scale,t.scale],0),w.set([t.time,n,D,22],4),w.set([.6,4,.6,.9999],8),w.set([1,6,1.4,0],12),ee.set([t.particleCount,+!!t.shouldReset,t.frameIndex++,0],16),e.queue.writeBuffer(t.uniform,0,C)}function ue(e,t,n,r,i){let{device:a}=e,o=J(e,n);if(!o)return;let{canvas:s,reveal:c}=n,l=s.width/n.cssWidth,u=U(n);n.shouldUpdateRects&&Y(e,n,l),u&&(n.appearedAt??=i),n.scene??=a.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let d=c?Math.min((i-c.startedAt)/500,1)**2:0;T.set([s.width,s.height,l,0,(c?.x??0)*l,(c?.y??0)*l,c?d*Z(n,c.x,c.y)*1.04*l:-1,48*l,n.tileOffsetX*r.scale,n.tileOffsetY*r.scale,r.scale,r.size,H(n,i)]),a.queue.writeBuffer(n.scene,0,T);let f=t.beginRenderPass({colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:[0,0,0,0],loadOp:`clear`,storeOp:`store`}]});n.emojis.size&&X(e,f,n,l,v),u&&n.rectCount&&(n.spoilerBindGroupTile!==r&&(n.spoilerBindGroup=a.createBindGroup({layout:e.spoilerPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:n.scene}},{binding:1,resource:r.texture.createView()},{binding:2,resource:e.tileSampler},{binding:3,resource:{buffer:n.rectBuffer}}]}),n.spoilerBindGroupTile=r),f.setPipeline(e.spoilerPipeline),f.setBindGroup(0,n.spoilerBindGroup),f.draw(4,n.rectCount)),f.end()}function de(e,t,n,r,i){let{device:a}=e,o=J(e,n);if(!o)return;let{canvas:s,reveal:c}=n,l=s.width/n.cssWidth,u=U(n);n.shouldUpdateRects&&Y(e,n,l),u&&(n.appearedAt??=r),n.clock+=i,c&&(c.anchorClock??=n.clock);let d=c?Z(n,c.x,c.y)*l:0,f=c?fe((n.clock-c.anchorClock)*1e3,d):v;n.scene??=a.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),T.set([s.width,s.height,l,4*l,(c?.x??0)*l,(c?.y??0)*l,f.radius,d,c?c.anchorClock:-1,0,n.clock,c&&(c.glyphs||n.glyphBuffer)?1:0,H(n,r),n.particleCount,D,2*l]),a.queue.writeBuffer(n.scene,0,T);let p=u&&n.particleCount>0;p&&c?.glyphs&&pe(e,t,n,l);let m=t.beginRenderPass({colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:[0,0,0,0],loadOp:`clear`,storeOp:`store`}]});n.emojis.size&&X(e,m,n,l,f),p&&(n.textRenderBindGroup??=a.createBindGroup({layout:e.textParticlePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:n.scene}},{binding:1,resource:{buffer:n.glyphBuffer??e.emptyGlyphBuffer}},{binding:2,resource:{buffer:n.rectBuffer}}]}),m.setPipeline(e.textParticlePipeline),m.setBindGroup(0,n.textRenderBindGroup),m.draw(4,n.particleCount)),m.end()}function fe(t,n){let r=e.fade/e.spread*n,i=e.fly+e.jitter/2;return{radius:Math.min(Math.max((t-i)/(e.spread+e.fade),0),1)*(n+r),edge:r}}function pe(e,t,n,r){let{device:i}=e,a=n.reveal,o=a.glyphs;a.glyphs=void 0,a.glyphTexture=i.createTexture({size:[o.width,o.height],format:e.format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}),i.queue.copyExternalImageToTexture({source:o},{texture:a.glyphTexture,premultipliedAlpha:!0},[o.width,o.height]),o.close(),n.emojis.size&&me(e,n,r,a.glyphTexture),n.glyphBuffer=i.createBuffer({size:n.particleCount*32,usage:GPUBufferUsage.STORAGE}),n.textRenderBindGroup=void 0;let s=t.beginComputePass();s.setPipeline(e.textAssignPipeline),s.setBindGroup(0,i.createBindGroup({layout:e.textAssignPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:n.scene}},{binding:1,resource:{buffer:n.glyphBuffer}},{binding:2,resource:{buffer:n.rectBuffer}},{binding:3,resource:a.glyphTexture.createView()}]})),s.dispatchWorkgroups(Math.ceil(n.particleCount/64)),s.end()}function me(e,t,n,r){let i=e.device.createCommandEncoder(),a=i.beginRenderPass({colorAttachments:[{view:r.createView(),loadOp:`load`,storeOp:`store`}]});X(e,a,t,n,v,!0),a.end(),e.device.queue.submit([i.finish()])}function J(e,t){let{canvas:n}=t,r=e.device.limits.maxTextureDimension2D,i=Math.min(t.dpr,r/t.cssWidth,r/t.cssHeight),a=Math.max(1,Math.round(t.cssWidth*i)),o=Math.max(1,Math.round(t.cssHeight*i));if((n.width!==a||n.height!==o)&&(n.width=a,n.height=o,t.shouldUpdateRects=!0),!t.context){let r=n.getContext(`webgpu`);if(!r){postMessage({type:`unavailable`});return}r.configure({device:e.device,format:e.format,alphaMode:`premultiplied`}),t.context=r}return t.context}function Y(e,t,n){t.shouldUpdateRects=!1;let r=t.kind===`media`?[{x:0,y:0,width:t.cssWidth,height:t.cssHeight,density:1,color:``}]:t.rects.filter(e=>!e.isEmoji),i=new Float32Array(Math.max(r.length,1)*8),a=0;r.forEach((e,r)=>{let o=t.kind===`text`,s=o?a:e.density;o&&(a=Math.min(a+he(e),2e5)),i.set([e.x*n,e.y*n,e.width*n,e.height*n,...o?ge(e.color):_,s],r*8)}),t.rectBuffer?.size!==i.byteLength&&(t.rectBuffer?.destroy(),t.rectBuffer=e.device.createBuffer({size:i.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),t.spoilerBindGroupTile=void 0),e.device.queue.writeBuffer(t.rectBuffer,0,i),t.rectCount=r.length,t.particleCount=a,t.textRenderBindGroup=void 0}function he(e){return Math.round((e.width+4)*(e.height+4)*.1*e.density)}function ge(e){let t=S.get(e);if(t)return t;j??=new OffscreenCanvas(1,1).getContext(`2d`,{willReadFrequently:!0}),j.clearRect(0,0,1,1),j.fillStyle=e,j.fillRect(0,0,1,1);let[n,r,i]=j.getImageData(0,0,1,1).data;return t=[n/255,r/255,i/255],S.set(e,t),t}function X(e,t,n,r,i,a){let{device:o}=e,s=U(n);n.emojiBindGroup??=o.createBindGroup({layout:e.emojiPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:n.scene}},{binding:1,resource:e.emojiSampler}]}),t.setPipeline(e.emojiPipeline),t.setBindGroup(0,n.emojiBindGroup),n.emojis.forEach(c=>{if(!ve(e,c))return;let l=c.x*n.cssWidth,u=c.y*n.cssHeight,d=s&&_e(n.rects,l,u,c.size);if(a&&!d)return;let f=Math.round(l*r),p=Math.round(u*r);E.set([f,p,Math.round((l+c.size)*r)-f,Math.round((u+c.size)*r)-p,d&&!a?1:0,i.edge,0,0]),o.queue.writeBuffer(c.uniform,0,E),t.setBindGroup(1,c.bindGroup),t.draw(4)})}function _e(e,t,n,r){let i=t+r/2,a=n+r/2;return e.some(e=>e.isEmoji&&e.x<=i&&i<=e.x+e.width&&e.y<=a&&a<=e.y+e.height)}function ve(e,t){let n=t.frameIndex===void 0?void 0:x.get(t.renderId)?.frames.get(t.frameIndex);if(!n||n===t.drawnFrame)return!!(t.drawnFrame&&t.texture);let{device:r}=e;return(!t.texture||t.texture.width!==n.size)&&(t.texture?.destroy(),t.texture=r.createTexture({size:[n.size,n.size],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),t.uniform??=r.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),t.bindGroup=r.createBindGroup({layout:e.emojiPipeline.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:t.uniform}},{binding:1,resource:t.texture.createView()}]})),r.queue.writeTexture({texture:t.texture},n.pixels,{bytesPerRow:n.size*4},[n.size,n.size]),t.drawnFrame=n,!0}function Z({cssWidth:e,cssHeight:t},n,r){let i=Math.max(n,e-n),a=Math.max(r,t-r);return Math.hypot(i,a)}function Q(e){e.rectBuffer?.destroy(),e.scene?.destroy(),e.glyphBuffer?.destroy(),e.reveal?.glyphTexture?.destroy(),e.rectBuffer=void 0,e.scene=void 0,e.glyphBuffer=void 0,e.particleCount=0,e.textRenderBindGroup=void 0,e.reveal&&(e.reveal.glyphTexture=void 0),e.spoilerBindGroup=void 0,e.spoilerBindGroupTile=void 0,e.emojiBindGroup=void 0,e.shouldUpdateRects=!0,e.emojis.forEach(e=>{$(e),e.drawnFrame=void 0})}function $(e){e&&(e.texture?.destroy(),e.uniform?.destroy(),e.texture=void 0,e.uniform=void 0,e.bindGroup=void 0)}})();
//# sourceMappingURL=gpuCanvas.worker-CfG86_7B.js.map