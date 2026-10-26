// The salute stars. One draw covers every salute: the instances go salute after salute, so a later salute blends over
// an earlier one.

struct Salutes {
    // Salute age, opacity, salute seed, star count of one salute
    items: array<vec4f, 3>,
}

struct StarRaster {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) @interpolate(flat) color: vec4f,
}

@group(0) @binding(0) var<uniform> salutes: Salutes;

const PI = 3.14159265358979;
// Instance numbers continue after the steady stars of the iOS shader, so the salutes look the same
const STEADY_STAR_COUNT = 240u;
const VERTICAL_SPREAD = 0.78;
// The star field keeps its layout relative to the canvas, as the amount and history diamonds of the iOS demo have it
const FIELD_SCALE = 0.55 / 1.52;
const FIELD_SHIFT = 0.12;
// Radius the stars show from
const EMISSION = 0.3;
const HALO = 0.035;
const CORNERS = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0), vec2f(1.0, 1.0));

fn starRandom(value: u32) -> f32 {
    var seed = value;
    seed ^= seed >> 16u;
    seed *= 0x7feb352du;
    seed ^= seed >> 15u;
    seed *= 0x846ca68bu;
    seed ^= seed >> 16u;
    return f32(seed & 0x00ffffffu) / 16777216.0;
}

@vertex
fn starVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> StarRaster {
    let count = u32(salutes.items[0].w);
    let animation = salutes.items[instance / count].xyz;
    let star = instance % count;
    let index = f32(star);
    let seed = (star + STEADY_STAR_COUNT) * 127u + 9137u + u32(animation.z) * 104729u;

    let age = animation.x;
    let lifetime = mix(1.2, 2.0, starRandom(seed + 1u));
    let progress = clamp(age / lifetime, 0.0, 1.0);
    let alive = f32(age >= 0.0 && age < lifetime);
    var fade = smoothstep(0.0, 0.03, age) * (1.0 - smoothstep(0.62, 1.0, progress)) * alive * animation.y;
    let depth = mix(0.60, 1.0, starRandom(seed + 3u));

    // Evenly in all directions and over the whole area, along R2 sequences
    let angle = 2.0 * PI * fract(0.5 + index * 0.75487767 + (starRandom(seed + 13u) - 0.5) * 0.04);
    let direction = vec2f(cos(angle), sin(angle));
    let fill = fract(0.5 + index * 0.56984029 + (starRandom(seed + 5u) - 0.5) * 0.06);
    let reach = 2.4 * sqrt(mix(0.08, 1.0, fill));
    let travel = max(age, 0.0);
    let reached = 0.04 + reach * (1.0 - exp(-travel / 0.22)) + 0.06 * travel;
    let drift = sin(age * 0.85 + starRandom(seed + 6u) * 6.28) * 0.02;
    var center = (direction * reached + vec2f(-direction.y, direction.x) * drift) * vec2f(1.0, VERTICAL_SPREAD);
    center.y -= 0.10;

    let breathPeriod = mix(2.0, 3.4, starRandom(seed + 24u));
    let breathWave = 0.5 - 0.5 * cos(age * (2.0 * PI / breathPeriod) + starRandom(seed + 25u) * 2.0 * PI);
    let shine = smoothstep(0.0, 1.0, fade) * mix(0.7, 1.0, breathWave);
    let radius = 1.53 * mix(0.0228, 0.084, pow(starRandom(seed + 7u), 1.7)) * depth * mix(0.87, 1.0, shine);
    // Shown once out from behind the diamond
    fade *= smoothstep(0.45 * EMISSION, 0.7 * EMISSION, length(center));

    let rotation = starRandom(seed + 8u) * 1.57 + age * mix(-0.20, 0.20, starRandom(seed + 9u));
    let uv = CORNERS[vertex] * 1.45;
    let point = mat2x2f(cos(rotation), sin(rotation), -sin(rotation), cos(rotation)) * uv * radius;

    let choice = starRandom(seed + 10u);
    var tone = select(select(select(vec3f(0.145, 0.792, 1.0), vec3f(0.0, 0.639, 1.0), choice < 0.82),
        vec3f(0.0, 0.451, 1.0), choice < 0.50), vec3f(0.045, 0.36, 1.0), choice < 0.22);
    tone = mix(tone, vec3f(0.247, 0.894, 1.0), smoothstep(0.12, 1.0, shine) * 0.30) * 0.78;

    var result: StarRaster;
    result.position = vec4f((center + point + vec2f(0.0, FIELD_SHIFT)) * FIELD_SCALE, 0.0, 1.0);
    result.uv = uv;
    result.color = vec4f(tone, fade * mix(0.52, 0.95, starRandom(seed + 11u)) * mix(0.80, 1.0, depth));
    return result;
}

@fragment
fn starFragment(r: StarRaster) -> @location(0) vec4f {
    let p = abs(r.uv);
    // A four-pointed star bounded by two parabolas
    let d = sqrt(max(p.x, 0.00001)) + sqrt(max(p.y, 0.00001)) - 1.0;
    let aa = max(fwidth(d), 0.04);
    let core = 1.0 - smoothstep(-aa, aa, d);
    let glow = exp(-dot(r.uv, r.uv) * 4.5) * HALO;
    let alpha = clamp(core + glow, 0.0, 1.0) * r.color.a;
    return vec4f(r.color.rgb * alpha, alpha);
}
