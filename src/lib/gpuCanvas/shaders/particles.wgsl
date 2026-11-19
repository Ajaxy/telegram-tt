// Media spoiler particles, ported from the curl noise of Telegram Android `SpoilerEffect2`.
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
