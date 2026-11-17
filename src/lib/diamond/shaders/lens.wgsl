struct Lens {
    // Two silhouette points per item, CSS pixels from the top left corner of the canvas
    hull: array<vec4f, 24>,
    // Middle of the diamond, canvas size; CSS pixels
    frame: vec4f,
    // Device pixels per CSS pixel, strength, turn of the diamond, point count
    shape: vec4f,
    // Shift of the canvas from the place the glyphs are drawn for, opacity
    text: vec4f,
}

@group(0) @binding(0) var<uniform> lens: Lens;
@group(0) @binding(1) var glyphs: texture_2d<f32>;
@group(0) @binding(2) var glyphSampler: sampler;

const PI = 3.14159265358979;
// The bend repeats with every facet of the eight around the girdle
const FACET = PI / 4.0;
// CSS pixels from the silhouette edge over which the bend fades in, so the glyphs meet the ones around the stone
const EDGE_BLEND = 5.0;
// Keeps `asin` off its poles at the girdle
const MAX_SINE = 0.999;
// Each facet column shifts the glyphs sideways by up to this share of the radius, with a sharper rise
const PRISM_SHIFT = 0.12;
const PRISM_SHARPNESS = 0.6;
// The crown takes the part above the middle, fading out between these shares of the radius
const CROWN_START = -0.25;
const CROWN_END = 0.05;
// The pavilion pulls the glyphs toward the middle, the crown lifts them; shares of the radius
const PAVILION_PULL = -0.08;
const CROWN_LIFT = 0.09;
// The glyphs shrink under the stone, more under the middle of the crown
const PAVILION_ZOOM = 0.84;
const CROWN_ZOOM = 0.72;
const CROWN_ZOOM_START = 0.2;
const CROWN_ZOOM_END = 0.6;

// One triangle over the whole viewport
@vertex
fn lensVertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
    return vec4f(corner * 2.0 - 1.0, 0.0, 1.0);
}

fn getHullPoint(index: u32) -> vec2f {
    let pair = lens.hull[index / 2u];
    return select(pair.xy, pair.zw, (index & 1u) == 1u);
}

@fragment
fn lensFragment(@builtin(position) coord: vec4f) -> @location(0) vec4f {
    let position = coord.xy / lens.shape.x;
    let center = lens.frame.xy;
    let count = u32(lens.shape.w);
    var isInside = false;
    var edgeDistance = 1e9;
    var radius = 0.0;
    var previous = count - 1u;

    for (var i = 0u; i < count; i++) {
        let a = getHullPoint(i);
        let b = getHullPoint(previous);
        if ((a.y > position.y) != (b.y > position.y)
            && position.x < (b.x - a.x) * (position.y - a.y) / (b.y - a.y) + a.x) {
            isInside = !isInside;
        }

        let edge = b - a;
        let along = clamp(dot(position - a, edge) / max(dot(edge, edge), 1e-4), 0.0, 1.0);
        edgeDistance = min(edgeDistance, distance(position, a + edge * along));
        radius = max(radius, distance(a, center));
        previous = i;
    }

    if (!isInside) {
        discard;
    }

    let bend = smoothstep(0.0, EDGE_BLEND, edgeDistance) * lens.shape.y;
    let offset = position - center;
    let q = offset / max(radius, 1.0);
    let wave = sin(PI * (asin(clamp(q.x, -MAX_SINE, MAX_SINE)) - lens.shape.z) / FACET);
    let prism = sign(wave) * pow(abs(wave), PRISM_SHARPNESS);
    let crown = 1.0 - smoothstep(CROWN_START, CROWN_END, q.y);
    let shift = vec2f(prism * PRISM_SHIFT, mix(PAVILION_PULL * q.y, CROWN_LIFT, crown)) * radius;
    let zoom = mix(
        PAVILION_ZOOM, CROWN_ZOOM, crown * (1.0 - smoothstep(CROWN_ZOOM_START, CROWN_ZOOM_END, abs(q.x))),
    );
    let source = center + offset * mix(1.0, zoom, bend) + shift * bend + vec2f(lens.text.x, 0.0);
    let ink = textureSampleLevel(glyphs, glyphSampler, source / lens.frame.zw, 0.0);

    return ink * lens.text.y * smoothstep(0.0, 1.0, edgeDistance);
}
