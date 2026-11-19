// Custom emoji frames drawn as quads. An emoji under a concealed spoiler stays hidden until the reveal front reaches it,
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
