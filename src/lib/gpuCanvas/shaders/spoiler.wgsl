// Spoiler regions sampling the shared particle tile. Edges fade so particles do not get cut,
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
