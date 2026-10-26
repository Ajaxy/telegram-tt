// The diamond and its sparkles, without the internal bounces and the opposite-face ray

// The edges rely on derivatives in branches that differ from pixel to pixel, which WGSL rejects unless this check is
// off
diagnostic(off, derivative_uniformity);

struct Uniforms {
    model: mat4x4f,
    projection: mat4x4f,
    inverseModel: mat4x4f,
    parameters: vec4f, // time, refraction, brightness, sparkles
    viewport: vec4f, // width, height, optical plane count, unused
    sparkleShape: vec4f, // main layer scale, contour morph, core scale, star glow scale
    sparkleHalo: vec4f, // circular glow scale, main face rotation, horizontal correction, visibility
    crownGradient: vec4f,
    pavilionGradient: vec4f,
    lightSweep: vec4f, // diagonal position, environment phase, transmission, reserved
    facetProjection: vec4f, // reference pitch cosine/sine, source units, projected top
    crownSweep: vec4f,
    rightCrownSweep: vec4f,
    leftCrownSweep: vec4f,
    pavilionSweep: vec4f,
    rightPavilionSweep: vec4f,
    leftPavilionSweep: vec4f,
    appearance: vec4f, // palette identifier, whitening
    referenceCrownFlash: vec4f,
    referencePavilionFlash: vec4f,
}

struct SparkleAnchor {
    position: vec4f,
    normal: vec4f,
}

struct Hull {
    planes: array<vec4f, 17>,
    anchors: array<SparkleAnchor, 8>,
}

struct Raster {
    @builtin(position) position: vec4f,
    @location(0) localPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) worldPosition: vec3f,
    // Table, crown, pavilion; interpolated across rounded edges
    @location(3) facetWeights: vec3f,
}

struct SparkleRaster {
    @builtin(position) position: vec4f,
    @location(0) sourcePoint: vec2f,
    @location(1) @interpolate(flat) strength: f32,
    @location(2) @interpolate(flat) layer: u32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<uniform> hull: Hull;

const CROWN_STOPS = array<f32, 7>(0.0, 0.162, 0.324, 0.501, 0.667, 0.833, 1.0);
const CROWN_COLORS = array<vec3f, 7>(vec3f(0.145, 0.792, 1.0), vec3f(0.373, 0.875, 1.0),
    vec3f(0.6, 0.957, 1.0), vec3f(0.3, 0.798, 1.0), vec3f(0.0, 0.639, 1.0),
    vec3f(0.0, 0.545, 1.0), vec3f(0.0, 0.451, 1.0));
const RING = array<vec2f, 8>(vec2f(0.0, 1.0), vec2f(0.70710678, 0.70710678),
    vec2f(1.0, 0.0), vec2f(0.70710678, -0.70710678), vec2f(0.0, -1.0),
    vec2f(-0.70710678, -0.70710678), vec2f(-1.0, 0.0), vec2f(-0.70710678, 0.70710678));

@vertex
fn diamondVertex(
    @location(0) position: vec4f, @location(1) normal: vec4f, @location(2) surface: vec4f,
) -> Raster {
    let world = u.model * position;
    var result: Raster;
    result.position = u.projection * world;
    result.localPosition = position.xyz;
    result.normal = normalize((u.model * normal).xyz);
    result.worldPosition = world.xyz;
    result.facetWeights = select(
        vec3f(f32(surface.z == 0.0), f32(surface.z == 1.0), f32(surface.z == 2.0)),
        vec3f(surface.xy, 1.0 - surface.x - surface.y),
        surface.z == 3.0,
    );
    return result;
}

// Stop after stop rather than a loop, see `pavilionReflections`
fn referenceCrown(p: vec2f, gradient: vec4f) -> vec3f {
    let start = gradient.xy;
    let direction = gradient.zw - start;
    let t = saturate(dot(p - start, direction) / dot(direction, direction));
    if (t <= CROWN_STOPS[1]) { return mixCrownStops(t, 0); }
    if (t <= CROWN_STOPS[2]) { return mixCrownStops(t, 1); }
    if (t <= CROWN_STOPS[3]) { return mixCrownStops(t, 2); }
    if (t <= CROWN_STOPS[4]) { return mixCrownStops(t, 3); }
    if (t <= CROWN_STOPS[5]) { return mixCrownStops(t, 4); }
    if (t <= CROWN_STOPS[6]) { return mixCrownStops(t, 5); }
    return CROWN_COLORS[6];
}

fn mixCrownStops(t: f32, index: u32) -> vec3f {
    let stops = CROWN_STOPS;
    let colors = CROWN_COLORS;
    return mix(colors[index], colors[index + 1u], (t - stops[index]) / (stops[index + 1u] - stops[index]));
}

fn lateralDepth(color: vec3f, normal: vec3f, y: f32, facetWeights: vec3f, opticalLuminance: f32) -> vec3f {
    let horizontalNormal = length(normal.xz);
    let side = smoothstep(0.22, 0.80, abs(normal.x) / max(horizontalNormal, 0.001));
    let shoulder = smoothstep(0.06, 0.57, y);
    let lower = smoothstep(0.12, 0.90, -y);
    let reflectedLight = smoothstep(0.28, 0.78, color.g);
    // A restrained blue-violet shadow keeps the sides distinct without
    // swallowing their cyan gradients and moving reflections.
    let deepBlue = mix(vec3f(0.017, 0.035, 0.90), vec3f(0.006, 0.11, 1.0), reflectedLight);
    var sideColor = mix(deepBlue, vec3f(0.22, 0.86, 1.0), shoulder * 0.69);
    sideColor = mix(sideColor, vec3f(0.018, 0.39, 1.0), lower * 0.52);
    let reflectionDetail = 0.105 + opticalLuminance * 0.14 + smoothstep(0.70, 0.95, color.g) * 0.26;
    sideColor = mix(sideColor, color, reflectionDetail);
    let weight = side * 0.96 * (1.0 - facetWeights.x);
    return mix(color, sideColor, weight);
}

fn facetBarycentric(p: vec2f, a: vec2f, b: vec2f, c: vec2f) -> vec3f {
    let v = b - a;
    let w = c - a;
    let q = p - a;
    let determinant = v.x * w.y - v.y * w.x;
    let y = (q.x * w.y - q.y * w.x) / determinant;
    let z = (v.x * q.y - v.y * q.x) / determinant;
    return vec3f(1.0 - y - z, y, z);
}

fn facetCoverage(barycentric: vec3f) -> f32 {
    let edge = min(barycentric.x, min(barycentric.y, barycentric.z));
    let aa = max(fwidth(edge), 0.004);
    return smoothstep(-aa, aa, edge);
}

fn sourceFacetPoint(localPosition: vec3f, outward: vec2f) -> vec2f {
    let across = dot(localPosition.xz, vec2f(outward.y, -outward.x));
    let depth = dot(localPosition.xz, outward);
    let c = u.facetProjection.x;
    let s = u.facetProjection.y;
    let y = c * localPosition.y - s * depth;
    let z = s * localPosition.y + c * depth;
    let w = u.projection[2].w * z + u.projection[3].w;
    return vec2f(257.6 + across / w * u.facetProjection.z,
        103.8 + (u.facetProjection.w - y / w) * u.facetProjection.z);
}

fn getOutward(localNormal: vec3f) -> vec2f {
    return select(vec2f(0.0, sign(localNormal.z)), vec2f(sign(localNormal.x), 0.0),
        abs(localNormal.x) > abs(localNormal.z));
}

fn getBroad(localNormal: vec3f) -> f32 {
    let normalXZ = abs(localNormal.xz);
    return 1.0 - smoothstep(0.20, 0.65,
        min(normalXZ.x, normalXZ.y) / max(max(normalXZ.x, normalXZ.y), 0.0001));
}

fn illustratedFacets(inputColor: vec3f, r: Raster) -> vec3f {
    var color = inputColor;
    let localNormal = normalize((u.inverseModel * vec4f(normalize(r.normal), 0.0)).xyz);
    // Fixed material coordinates on each broad face. The same reference camera
    // maps the authored facets and the sparkle anchors onto the current cut.
    let outward = getOutward(localNormal);
    let tangent = vec3f(outward.y, 0.0, -outward.x);
    let p = sourceFacetPoint(r.localPosition, outward);
    // Fade the drawing before the diagonal facets, where the next face's
    // coordinate system takes over. No duplicated motifs along rounded edges.
    let broad = getBroad(localNormal);
    let worldTangent = (u.model * vec4f(tangent, 0.0)).xyz;
    let n = normalize(r.normal);
    let light = normalize(vec3f(0.6 * sin(u.lightSweep.y), 0.5, 1.0));
    let leftLight = pow(saturate(dot(normalize(n - worldTangent * 0.38), light)), 5.0);
    let rightLight = pow(saturate(dot(normalize(n + worldTangent * 0.38), light)), 5.0);
    if (r.facetWeights.y > 0.0) {
        // Both crown triangles meet at the same upper junction.
        let crownJunction = vec2f(258.8, 128.9);
        // Authored lower corners now share the same projection as the mesh.
        let crownBaseLeft = vec2f(108.8, 240.8);
        let crownBaseRight = vec2f(406.8, 240.8);
        let left = facetBarycentric(p, vec2f(142.1, 106.3), crownJunction, crownBaseLeft);
        let leftStrength = facetCoverage(left) * (0.18 + 0.40 * leftLight) * saturate(1.0 - left.y);
        color = mix(color, vec3f(0.79, 0.988, 1.0), leftStrength * r.facetWeights.y * broad);
        let right = facetBarycentric(p, crownBaseRight, crownJunction, vec2f(378.5, 108.2));
        // The source is light at the left junction and dark at the right edge.
        // Use horizontal facet coordinates so the gradient turns with the gem.
        let gradient = smoothstep(crownJunction.x, crownBaseRight.x, p.x);
        var tint = mix(vec3f(0.28, 0.83, 1.0), vec3f(0.025, 0.43, 1.0), gradient);
        tint = mix(tint, vec3f(0.57, 0.95, 1.0), rightLight * 0.24);
        color = mix(color, tint, facetCoverage(right) * 0.90 * r.facetWeights.y * broad);
    }
    if (r.facetWeights.z > 0.0) {
        // A translucent kite belongs to each broad pavilion face. Material-space
        // edges stay attached to the surface throughout a complete rotation.
        let kite = vec2f(dot(r.localPosition, tangent), r.localPosition.y);
        const halfWidth = 0.245;
        const top = -0.61;
        const shoulder = -0.70;
        const bottom = -1.075;
        const upperHeight = top - shoulder;
        const lowerHeight = shoulder - bottom;
        let upperEdge = ((top - kite.y) * halfWidth - abs(kite.x) * upperHeight)
            / length(vec2f(halfWidth, upperHeight));
        let lowerEdge = ((kite.y - bottom) * halfWidth - abs(kite.x) * lowerHeight)
            / length(vec2f(halfWidth, lowerHeight));
        let edge = min(upperEdge, lowerEdge);
        let aa = max(fwidth(edge), 0.0015);
        let coverage = smoothstep(-aa, aa, edge);
        let illumination = saturate(dot(n, normalize(vec3f(-0.65, 0.5, 1.0))));
        var tint = mix(vec3f(0.48, 0.96, 1.0), vec3f(0.70, 1.0, 1.0), illumination);
        let across = saturate(0.5 + kite.x / (2.0 * halfWidth));
        tint *= mix(vec3f(1.0), vec3f(0.88, 0.97, 1.0), across);
        color = mix(color, tint, coverage * 0.28 * r.facetWeights.z * broad);
    }
    return color;
}

fn studio(direction: vec3f, phase: f32) -> vec3f {
    let angle = 0.85 * sin(phase);
    let d = vec3f(cos(angle) * direction.x - sin(angle) * direction.z, direction.y,
        sin(angle) * direction.x + cos(angle) * direction.z);
    let up = smoothstep(-0.65, 0.85, d.y);
    var c = mix(vec3f(0.002, 0.075, 0.88), vec3f(0.19, 0.78, 1.0), up);
    let key = pow(saturate(dot(d, normalize(vec3f(-0.6, 0.8, 0.7)))), 10.0);
    let stripPosition = 0.12 + 0.48 * sin(phase);
    // `pow` is undefined for a negative base; GLSL compilers turn the `pow(x, 2.0)` of the original into `x * x`
    let stripOffset = (d.x + d.y * 0.42 - stripPosition) * 9.0;
    let strip = exp(-stripOffset * stripOffset);
    let side = pow(saturate(dot(d, normalize(vec3f(0.8, 0.2, -0.5)))), 18.0);
    c = mix(c, vec3f(0.68, 0.98, 1.0), key * 0.94);
    c = mix(c, vec3f(0.80, 0.99, 1.0), strip * 0.64);
    c += side * vec3f(0.1, 0.3, 0.38);
    return c;
}

fn facetEdgeRoll(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
    let segment = b - a;
    let edgeLength = length(segment);
    let along = segment / edgeLength;
    let across = vec2f(-along.y, along.x);
    let offset = dot(p - a, across);
    let progress = dot(p - a, along);
    let width = max(1.6, fwidth(offset));
    let q = offset / width;
    let ends = smoothstep(0.0, 5.0, progress) * (1.0 - smoothstep(edgeLength - 5.0, edgeLength, progress));
    return across * (q * exp(-q * q) * 0.22 * ends);
}

fn polishedNormal(r: Raster, localNormal: vec3f) -> vec3f {
    // Only the two surface crown diagonals get this tiny optical fillet.
    // The actual outline and the internal optical hull stay unchanged.
    if (r.facetWeights.y <= 0.0) { return normalize(r.normal); }
    let outward = getOutward(localNormal);
    let broad = getBroad(localNormal);
    let p = sourceFacetPoint(r.localPosition, outward);
    let roll = facetEdgeRoll(p, vec2f(258.8, 128.9), vec2f(108.8, 240.8))
        + facetEdgeRoll(p, vec2f(258.8, 128.9), vec2f(406.8, 240.8));
    let across = vec3f(outward.y, 0.0, -outward.x);
    let up = normalize(cross(localNormal, across));
    let normal = normalize(localNormal - (across * roll.x - up * roll.y) * broad * r.facetWeights.y);
    return normalize((u.model * vec4f(normal, 0.0)).xyz);
}

fn studioPanel(reflected: vec3f, direction: vec3f, size: vec2f) -> f32 {
    let alignment = dot(reflected, direction);
    let horizontal = normalize(cross(vec3f(0.0, 1.0, 0.0), direction));
    let vertical = cross(direction, horizontal);
    let point = vec2f(dot(reflected, horizontal), dot(reflected, vertical)) / max(alignment, 0.15);
    // Filter the narrow reflection at small sizes and grazing angles.
    let dx = dpdx(point);
    let dy = dpdy(point);
    let variance = size * size + dx * dx + dy * dy;
    let energy = size.x * size.y / sqrt(variance.x * variance.y);
    return exp(-dot(point * point, 1.0 / variance)) * energy * smoothstep(0.15, 0.40, alignment);
}

fn surfaceFinish(color: vec3f, normal: vec3f, view: vec3f) -> vec3f {
    let reflected = reflect(-view, normal);
    let phase = u.lightSweep.y;
    let key = studioPanel(reflected, normalize(vec3f(-0.36 + 0.14 * sin(phase), 0.90, 0.72)), vec2f(0.16, 0.48));
    let rim = studioPanel(reflected, normalize(vec3f(0.72, -0.52 + 0.10 * cos(phase), 0.18)), vec2f(0.10, 0.60));
    let fresnel = pow(1.0 - saturate(dot(normal, view)), 4.0);
    let strength = key * (0.35 + 0.35 * fresnel) + rim * (0.16 + 0.30 * fresnel);
    return mix(color, vec3f(0.87, 0.99, 1.0), strength);
}

fn sourceBand(p: vec2f, gradient: vec4f) -> f32 {
    let direction = gradient.zw - gradient.xy;
    let t = dot(p - gradient.xy, direction) / dot(direction, direction);
    return saturate(1.0 - abs(t - 0.49) / 0.49);
}

fn facetSweep(r: Raster, localNormal: vec3f) -> f32 {
    let tangent = normalize(vec3f(localNormal.z + 0.00001, 0.0, -localNormal.x));
    let across = dot(r.localPosition, tangent) * 225.8;
    let side = smoothstep(0.20, 0.50, abs(normalize(r.normal).x));
    let isRight = r.normal.x > 0.0;
    let crown = mix(u.crownSweep, select(u.leftCrownSweep, u.rightCrownSweep, isRight), side);
    let pavilion = mix(u.pavilionSweep, select(u.leftPavilionSweep, u.rightPavilionSweep, isRight), side);
    return sourceBand(vec2f(across, (0.3065 - r.localPosition.y) * 239.0), crown) * r.facetWeights.y
        + sourceBand(vec2f(across, (-0.54 - r.localPosition.y) * 235.0), pavilion) * r.facetWeights.z;
}

fn reflectionTriangle(
    origin: vec3f, ray: vec3f, a: vec3f, b: vec3f, c: vec3f, coordinates: ptr<function, vec3f>,
) -> f32 {
    let ab = b - a;
    let ac = c - a;
    let crossRay = cross(ray, ac);
    let determinant = dot(ab, crossRay);
    if (abs(determinant) < 0.00001) { return 1e5; }
    let offset = origin - a;
    let first = dot(offset, crossRay) / determinant;
    let q = cross(offset, ab);
    let second = dot(ray, q) / determinant;
    let t = dot(ac, q) / determinant;
    let result = vec3f(1.0 - first - second, first, second);
    *coordinates = result;
    return select(1e5, t, min(min(result.x, result.y), result.z) >= 0.0 && t > 0.001);
}

// The pavilion trace, filled facet by facet
struct PavilionTrace {
    entry: f32,
    exitDistance: f32,
    entryNormal: vec3f,
    sideColor: vec3f,
    sideWeight: f32,
    veilColor: vec3f,
    veilWeight: f32,
}

fn pavilionReflections(inputColor: vec3f, origin: vec3f, ray: vec3f) -> vec3f {
    var color = inputColor;
    if (u.parameters.y <= 0.0) { return color; }
    // One convex fan of reflected facets, shared by every camera orientation.
    // Clip the whole volume so adjoining facets never acquire dark seams.
    let worldRay = normalize((u.model * vec4f(ray, 0.0)).xyz);
    var trace = PavilionTrace(0.0, 1e5, vec3f(0.0, 1.0, 0.0), vec3f(0.0), 0.0, vec3f(0.0), 0.0);
    // Written out instead of a loop: on Metal, WebGPU keeps loops from being unrolled, and with a loop here the
    // shader runs three times slower
    tracePavilionSector(&trace, RING[0], RING[1], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[1], RING[2], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[2], RING[3], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[3], RING[4], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[4], RING[5], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[5], RING[6], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[6], RING[7], origin, ray, worldRay);
    tracePavilionSector(&trace, RING[7], RING[0], origin, ray, worldRay);
    let strength = saturate(u.parameters.y / 0.72);
    if (trace.veilWeight > 0.0) {
        color = mix(color, trace.veilColor / trace.veilWeight, (1.0 - exp(-trace.veilWeight * 0.46)) * strength);
    }
    if (trace.sideWeight > 0.0) {
        color = mix(color, trace.sideColor / trace.sideWeight, (1.0 - exp(-trace.sideWeight * 1.4)) * strength);
    }
    // `studioPanel` uses screen derivatives. Evaluate it on both sides of the
    // hull boundary; divergent execution produces dotted edges on Adreno.
    let hit = origin + ray * trace.entry;
    let worldNormal = normalize((u.model * vec4f(trace.entryNormal, 0.0)).xyz);
    let light = saturate(dot(worldNormal, normalize(vec3f(-0.65, 0.15, 1.0))));
    let gleam = studioPanel(reflect(worldRay, worldNormal),
        normalize(vec3f(-0.35 + 0.15 * sin(u.lightSweep.y), 0.60, 0.75)), vec2f(0.25, 0.65));
    var tint = mix(vec3f(0.025, 0.54, 1.0), vec3f(0.40, 0.92, 1.0), light);
    tint = mix(tint, vec3f(0.72, 0.99, 1.0), gleam * 0.16);
    let thickness = smoothstep(0.0, 0.18, trace.exitDistance - trace.entry);
    let fade = smoothstep(-1.07, -0.93, hit.y);
    let isInside = select(0.0, 1.0, trace.entry < trace.exitDistance);
    color = mix(color, tint, 0.28 * thickness * fade * strength * isInside);
    return color;
}

fn tracePavilionSector(
    trace: ptr<function, PavilionTrace>, current: vec2f, next: vec2f, origin: vec3f, ray: vec3f, worldRay: vec3f,
) {
    const top = vec3f(0.0, -0.28, 0.0);
    const tip = vec3f(0.0, -1.06, 0.0);
    let illumination = normalize(vec3f(-0.55, 0.65, 1.0));
    let a = vec3f(current.x * 0.28, -0.68, current.y * 0.28);
    let b = vec3f(next.x * 0.28, -0.68, next.y * 0.28);
    clipPavilionPlane(trace, a, b, top, origin, ray);
    clipPavilionPlane(trace, a, b, tip, origin, ray);
    let radial = vec3f(current.x, 0.0, current.y);
    let tangent = vec3f(current.y, 0.0, -current.x);
    // Broad, low-contrast echoes of the crown stretch through the volume
    // towards the same lower junction. Adjacent planes meet without dark gaps.
    // Continue the same planes above the girdle so their top fade stays
    // hidden behind the crown, including the deeper, opposite reflections.
    const upperY = 0.20;
    const extension = (upperY + 0.12) / 0.65;
    const upperRadius = 0.64 + (0.64 - 0.19) * extension;
    const upperWidth = 0.265097 + (0.265097 - 0.078701) * extension;
    let upperLeft = radial * upperRadius - tangent * upperWidth + vec3f(0.0, upperY, 0.0);
    let upperRight = radial * upperRadius + tangent * upperWidth + vec3f(0.0, upperY, 0.0);
    let lowerLeft = radial * 0.19 - tangent * 0.078701 + vec3f(0.0, -0.77, 0.0);
    let lowerRight = radial * 0.19 + tangent * 0.078701 + vec3f(0.0, -0.77, 0.0);
    var ribbonCoordinates: vec3f;
    var ribbon = reflectionTriangle(origin, ray, upperLeft, upperRight, lowerLeft, &ribbonCoordinates);
    if (ribbon > 100.0) {
        ribbon = reflectionTriangle(origin, ray, upperRight, lowerRight, lowerLeft, &ribbonCoordinates);
    }
    if (ribbon < 100.0) {
        let hit = origin + ray * ribbon;
        let depth = (-0.12 - hit.y) / 0.65;
        let across = dot(hit, tangent);
        let right = mix(0.265097, 0.078701, depth);
        let left = -right;
        let worldRadial = normalize((u.model * vec4f(radial, 0.0)).xyz);
        let facing = saturate(-dot(worldRadial, worldRay));
        let fade = smoothstep(0.0, 0.065, upperY - hit.y) * (1.0 - smoothstep(0.70, 1.0, depth));
        let opacity = fade * (0.16 + 0.84 * facing);
        let light = saturate(0.5 + 0.5 * dot(worldRadial, illumination));
        // Broad reflected facets fill the middle with restrained diagonal
        // changes in tone, expressed in the fixed plane's own coordinates.
        let acrossPlane = saturate((across - left) / (right - left));
        let diagonal = smoothstep(-0.045, 0.045, acrossPlane - 0.35 - depth * 0.55);
        let middle = smoothstep(0.12, 0.24, depth) * (1.0 - smoothstep(0.50, 0.64, depth));
        var tint = mix(vec3f(0.015, 0.56, 1.0), vec3f(0.33, 0.97, 1.0), light);
        tint = mix(tint, vec3f(0.42, 0.97, 1.0), middle * (0.32 - 0.20 * diagonal));
        tint = mix(tint, vec3f(0.015, 0.46, 1.0), diagonal * 0.24);
        (*trace).veilColor += tint * opacity;
        (*trace).veilWeight += opacity;
    }
    let aSide = radial * 0.72 + tangent * 0.055 + vec3f(0.0, -0.30, 0.0);
    let bSide = radial * 0.49 - tangent * 0.105 + vec3f(0.0, -0.60, 0.0);
    let cSide = radial * 0.15 + tangent * 0.020 + vec3f(0.0, -0.93, 0.0);
    var coordinates: vec3f;
    let t = reflectionTriangle(origin, ray, aSide, bSide, cSide, &coordinates);
    if (t < 100.0) {
        let worldRadial = normalize((u.model * vec4f(radial, 0.0)).xyz);
        // Long glints read at the sides; a front-facing sector must not
        // become an opaque needle in the middle of the stone.
        let sideFacing = 1.0 - abs(dot(worldRadial, worldRay));
        let edge = min(coordinates.y, coordinates.z);
        let opacity = smoothstep(0.20, 0.75, sideFacing)
            * smoothstep(0.0, 0.085, edge) * smoothstep(0.0, 0.035, coordinates.x);
        let light = 0.5 + 0.5 * dot(worldRadial, illumination);
        let tint = mix(vec3f(0.16, 0.80, 1.0), vec3f(0.85, 1.0, 1.0), light);
        (*trace).sideColor += tint * opacity;
        (*trace).sideWeight += opacity;
    }
}

fn clipPavilionPlane(
    trace: ptr<function, PavilionTrace>, a: vec3f, b: vec3f, peak: vec3f, origin: vec3f, ray: vec3f,
) {
    var n = normalize(cross(a - peak, b - peak));
    if (dot(n, (a + b + peak) / 3.0 - vec3f(0.0, -0.68, 0.0)) < 0.0) { n = -n; }
    let denominator = dot(n, ray);
    let side = dot(n, origin - peak);
    if (abs(denominator) < 0.00001) {
        if (side > 0.0) { (*trace).exitDistance = -1.0; }
    } else {
        let t = -side / denominator;
        if (denominator < 0.0 && t > (*trace).entry) {
            (*trace).entry = t;
            (*trace).entryNormal = n;
        }
        if (denominator > 0.0) { (*trace).exitDistance = min((*trace).exitDistance, t); }
    }
}

fn materialPalette(color: vec3f, facetWeights: vec3f, appearance: u32) -> vec3f {
    switch (appearance) {
        case 1u: {
            // Keep the authored icy blue in the middle values: interpolating
            // directly to white desaturates the crown into a cold grey.
            let tone = smoothstep(0.0, 0.92, saturate(dot(color.rg, vec2f(0.22, 0.78))));
            let shadow = mix(vec3f(0.63, 0.77, 0.95), vec3f(0.733, 0.859, 1.0), facetWeights.y * 0.25);
            const ice = vec3f(207.0, 241.0, 253.0) / 255.0; // #cff1fd
            var upper = mix(shadow, ice, smoothstep(0.0, 0.62, tone));
            upper = mix(upper, vec3f(1.0), smoothstep(0.58, 1.0, tone) * 0.92);
            // Lift the pavilion while retaining a distinct shadow range below
            // the white crown, with a little more blue in its lighter facets.
            let lower = mix(vec3f(0.59, 0.71, 0.865), vec3f(0.96, 0.985, 1.0), pow(tone, 1.10));
            return mix(upper, lower, facetWeights.z);
        }
        case 2u: {
            let tone = smoothstep(0.035, 0.90, saturate(dot(color.rg, vec2f(0.20, 0.80))));
            let cool = mix(vec3f(0.025, 0.29, 0.83), vec3f(0.38, 0.78, 1.0), smoothstep(0.0, 0.65, tone));
            let upper = mix(cool, vec3f(0.94, 0.99, 1.0), smoothstep(0.45, 1.0, tone));
            let lower = mix(vec3f(0.025, 0.34, 0.92), vec3f(0.90, 0.99, 1.0), pow(tone, 2.35));
            return mix(upper, lower, facetWeights.z);
        }
        default: {
            return color;
        }
    }
}

fn glowPlane(
    plane: vec4f, position: vec3f, ray: vec3f, localNormal: vec3f,
    planeAlignment: ptr<function, f32>, thickness: ptr<function, f32>,
) {
    *planeAlignment = max(*planeAlignment, dot(plane.xyz, localNormal));
    let denominator = dot(plane.xyz, ray);
    if (denominator > 0.0001) {
        let planeExit = -(dot(plane.xyz, position) + plane.w) / denominator;
        *thickness = min(*thickness, max(0.0, planeExit));
    }
}

fn coolInnerGlow(
    color: vec3f, position: vec3f, ray: vec3f, normal: vec3f, localNormal: vec3f, view: vec3f,
) -> vec3f {
    // Thin parts transmit a white light band into the stone. The optical chord
    // follows the 3D cut under every rotation, without expanding the silhouette.
    var thickness = 1e5;
    var planeAlignment = 0.0;
    // The optical hull always has 17 planes. Constant indices avoid the expensive
    // dynamically indexed uniform loop on mobile GPUs, without changing ray math.
    glowPlane(hull.planes[0], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[1], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[2], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[3], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[4], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[5], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[6], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[7], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[8], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[9], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[10], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[11], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[12], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[13], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[14], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[15], position, ray, localNormal, &planeAlignment, &thickness);
    glowPlane(hull.planes[16], position, ray, localNormal, &planeAlignment, &thickness);
    // Scale the penetration with the taper: the tip gets a narrow rim,
    // rather than filling with a solid white pool as its whole depth shrinks.
    let crossSection = clamp((position.y + 1.09) / 0.98, 0.07, 1.0);
    let inner = 1.0 - smoothstep(0.01, 0.80 * crossSection, thickness);
    let grazing = 1.0 - saturate(dot(normal, view));
    let roundedEdge = smoothstep(0.0015, 0.028, 1.0 - planeAlignment);
    let bevel = pow(grazing, 3.0);
    let glow = saturate(inner * 0.85 + bevel * 0.85 + roundedEdge * smoothstep(0.18, 0.80, grazing));
    return mix(color, vec3f(0.96, 1.0, 1.0), glow);
}

@fragment
fn diamondFragment(r: Raster) -> @location(0) vec4f {
    let n = normalize(r.normal);
    let cameraDistance = -u.projection[3].w / u.projection[2].w;
    let view = normalize(vec3f(0.0, 0.0, cameraDistance) - r.worldPosition);
    let localView = (u.inverseModel * vec4f(-view, 0.0)).xyz;
    let localNormal = normalize((u.inverseModel * vec4f(n, 0.0)).xyz);
    let transmitted = refract(localView, localNormal, 1.0 / 1.62);
    // Zero internal bounces on every device; retain the existing material mapping.
    var optical = vec3f(0.0);
    let reflection = studio(reflect(-view, n), u.lightSweep.y);
    let fresnel = 0.08 + 0.46 * pow(1.0 - saturate(dot(n, view)), 4.0);

    let height = saturate((r.localPosition.y + 1.05) / 1.65);
    let key = saturate(dot(n, normalize(vec3f(-0.65, 0.85, 1.0))));
    let left = saturate(0.52 - r.worldPosition.x * 0.43);
    let blue = vec3f(0.008, 0.22, 1.0);
    let cyan = vec3f(0.29, 0.87, 1.0);
    var body = mix(blue, cyan, saturate(key * 0.60 + left * 0.38));
    let verticalBand = mix(0.5 + 0.5 * sin(height * 18.0 + n.x * 3.0), 1.0, r.facetWeights.z);
    body *= mix(vec3f(0.24, 0.48, 0.96), vec3f(1.0), verticalBand * 0.5 + 0.5);
    let opticalLuminance = smoothstep(0.25, 0.85, optical.g);
    // Give the pavilion a cyan body tone without changing reflection contrast
    // or the subdued lower motif. Crown and table keep their existing palette.
    let opticalShadow = mix(vec3f(0.005, 0.13, 1.0), vec3f(0.015, 0.36, 1.0), r.facetWeights.z);
    let opticalLight = mix(vec3f(0.58, 0.97, 1.0), vec3f(0.45, 0.99, 1.0), r.facetWeights.z);
    optical = mix(opticalShadow, opticalLight, opticalLuminance);
    let opticalWeight = u.parameters.y * mix(0.90, 0.08, r.facetWeights.y);
    var color = mix(body, optical, opticalWeight);
    color = mix(color, reflection, fresnel);

    let crownGlow = smoothstep(0.10, 0.60, r.localPosition.y) * left;
    color = mix(color, vec3f(0.70, 0.99, 1.0), crownGlow * 0.58);
    var crownLight = pow(saturate(dot(n, normalize(vec3f(-0.38, 0.55, 1.0)))), 9.0);
    crownLight *= smoothstep(-0.03, 0.28, r.localPosition.y);
    color = mix(color, vec3f(0.65, 0.98, 1.0), crownLight * 0.35);
    let facetBase = color;
    if (r.facetWeights.y > 0.0) {
        let softboxX = (r.worldPosition.x + 0.42) * 1.6;
        let softboxY = (r.worldPosition.y - 0.32) * 2.2;
        let softbox = exp(-softboxX * softboxX - softboxY * softboxY);
        color = mix(color, vec3f(0.71, 0.99, 1.0), softbox * crownLight * 0.36);
        let shadow = pow(saturate(1.0 - key), 1.4);
        color = mix(color, vec3f(0.015, 0.08, 1.0), shadow * 0.7);
        let tangent = normalize(vec3f(localNormal.z, 0.0, -localNormal.x));
        let authoredPosition = vec2f(dot(r.localPosition, tangent) * 225.8 + n.x * 65.0,
            (0.3065 - r.localPosition.y) * 244.0);
        color = mix(referenceCrown(authoredPosition, u.crownGradient), color, 0.28);
        color = mix(facetBase, color, r.facetWeights.y);
    }
    if (r.facetWeights.z > 0.0) {
        color = mix(color, mix(vec3f(0.008, 0.32, 1.0), optical, 0.86), r.facetWeights.z * u.parameters.y);
    }
    let facetFlash = smoothstep(0.20, 0.78, opticalLuminance);
    let flashWeight = mix(0.24, 0.08, r.facetWeights.y);
    color *= mix(vec3f(1.0), mix(vec3f(0.76, 0.82, 0.99), vec3f(1.0), facetFlash), flashWeight);
    color = mix(color, vec3f(0.66, 0.98, 1.0), pow(facetFlash, 2.0) * 0.24 * flashWeight);
    color = lateralDepth(color, n, r.localPosition.y, r.facetWeights, opticalLuminance);
    color = mix(color, optical, r.facetWeights.z * u.parameters.y * 0.48);
    color = mix(color, body, r.facetWeights.z * pow(saturate(n.z), 2.0) * 0.32);
    if (r.facetWeights.z > 0.0) {
        let detailRay = normalize(mix(localView, transmitted, 0.16));
        color = mix(color, pavilionReflections(color, r.localPosition, detailRay), r.facetWeights.z);
    }
    let tipGlow = pow(saturate((-r.localPosition.y - 0.55) / 0.50), 2.0);
    color = mix(color, vec3f(0.57, 0.96, 1.0), tipGlow * 0.20);
    // A shallow, translucent image of the table, like Layer 36.0 in Lottie.
    // Its optical footprint is smaller than the rounded outer shoulder.
    let tableRay = vec3f(localView.x, localView.y * 0.72, localView.z);
    if (tableRay.y > 0.001) {
        let tableHeight = -hull.planes[0].w / hull.planes[0].y;
        let tableDistance = (tableHeight - r.localPosition.y) / tableRay.y;
        let hit = (r.localPosition + tableRay * tableDistance).xz;
        const extent = 0.632;
        const corner = 0.285;
        let q = abs(hit);
        let edge = max(max(q.x, q.y) - extent, (q.x + q.y - extent - corner) * 0.70710678);
        let aa = max(fwidth(edge), 0.001);
        let coverage = 1.0 - smoothstep(-aa, aa, edge);
        let direction = tableRay.xz / max(length(tableRay.xz), 0.0001);
        let depth = saturate(0.5 + dot(hit, direction) / (2.0 * extent));
        // Source opacity: 80.0% group opacity times a 49...65% fill gradient.
        let opacity = mix(0.39, 0.52, depth);
        color = mix(color, vec3f(0.765, 0.988, 1.0), coverage * opacity
            * saturate(u.parameters.y / 0.72) * r.facetWeights.y);
    }
    color = illustratedFacets(color, r);
    color = mix(color, vec3f(0.63, 0.96, 1.0), 0.58 * r.facetWeights.x);
    let sweep = facetSweep(r, localNormal);
    let sweepCore = smoothstep(0.35, 1.0, sweep);
    color = mix(color, vec3f(0.592, 0.953, 1.0), sweep * 0.20 + sweepCore * sweepCore * 0.62);
    color = surfaceFinish(color, polishedNormal(r, localNormal), view);
    let appearance = u32(u.appearance.x);
    color = materialPalette(color, r.facetWeights, appearance);
    if (appearance == 2u) {
        color = coolInnerGlow(color, r.localPosition, localView, n, localNormal, view);
    }
    if (appearance == 1u) {
        // Source facet flashes stay on the physical front/side planes, including
        // their rounded transitions. They never become screen-space overlays.
        let direction = normalize(localNormal.xz + vec2f(0.0, 0.00001));
        let side = smoothstep(0.18, 0.65, abs(direction.x));
        let front = smoothstep(0.02, 0.32, direction.y);
        let regions = vec3f(1.0 - side, side * step(0.0, direction.x), side * (1.0 - step(0.0, direction.x))) * front;
        let alpha = dot(regions, u.referenceCrownFlash.xyz) * r.facetWeights.y
            + dot(regions, u.referencePavilionFlash.xyz) * r.facetWeights.z;
        let referenceFacing = smoothstep(0.0, 0.2, (u.model * vec4f(0.0, 0.0, 1.0, 0.0)).z);
        color = mix(color, vec3f(1.0), alpha * referenceFacing);
    }
    let whiten = u.appearance.y;
    if (whiten > 0.0) {
        let w = pow(whiten, 0.7);
        let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
        let lift = smoothstep(0.32, 0.62, luma);
        var glass = mix(vec3f(0.07, 0.33, 0.95), vec3f(1.0), lift);
        let rim = pow(1.0 - saturate(abs(n.z)), 2.2);
        glass = mix(glass, vec3f(1.0), rim * 0.8);
        let seam = saturate(length(fwidth(n)) * 5.5);
        glass = mix(glass, vec3f(1.0), seam * 0.85);
        glass = max(glass, vec3f(smoothstep(0.62, 0.95, luma)));
        color = mix(color, glass, w);
        let alpha = mix(1.0, mix(0.34, 0.94, max(lift, max(rim, seam))), w);
        return vec4f(saturate(color * u.parameters.z) * alpha, alpha);
    }
    return vec4f(saturate(color * u.parameters.z), 1.0);
}

@vertex
fn sparkleVertex(
    @location(0) contours: vec4f, @location(1) material: vec4f, @builtin(instance_index) instance: u32,
) -> SparkleRaster {
    let layer = u32(material.x);
    const authoringToWorld = 2.0 / 447.9;
    var local = hull.anchors[instance].position.xyz;
    var normal = hull.anchors[instance].normal.xyz;
    if (instance == 0u) {
        let c = cos(u.sparkleHalo.y);
        let s = sin(u.sparkleHalo.y);
        local = vec3f(c * local.x + s * local.z, local.y, -s * local.x + c * local.z);
        normal = vec3f(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z);
    }
    if (instance != 0u) { local += normal * 0.008; }
    let worldNormal = (u.model * vec4f(normal, 0.0)).xyz;
    let pulse = pow(max(0.0, sin(u.parameters.x * 2.1 + f32(instance) * 2.37 + 1.5)), 16.0);
    let front = select(smoothstep(0.15, 0.55, worldNormal.z), u.sparkleHalo.w, instance == 0u);
    var strength = front * u.parameters.w;
    var center = u.projection * u.model * vec4f(local, 1.0);
    if (u.viewport.w > 0.0) {
        center = vec4f(0.0, 0.0, 0.5, 1.0);
        strength = select(0.0, u.parameters.w, instance == 0u);
    }
    let morph = select(0.0, u.sparkleShape.y, instance == 0u);
    let sourcePoint = mix(contours.xy, contours.zw, morph);
    var groupScale = 1.0;
    var offset = vec2f(0.0);
    if (layer == 0u) { groupScale = u.sparkleHalo.x; offset.y = 5.9; }
    if (layer == 1u) { groupScale = u.sparkleShape.w; offset.y = -0.8; }
    if (layer == 2u) { groupScale = u.sparkleShape.z; offset.y = -0.9; }
    if (layer == 3u) { groupScale = 0.309; offset = vec2f(0.6, -0.4); }
    let mainEnvelope = select(u.sparkleHalo.w, 1.0, u.viewport.w > 0.0);
    let scale = select((0.632 / 0.75) * pulse, u.sparkleShape.x * mainEnvelope, instance == 0u);
    let point = (sourcePoint * groupScale + offset) * authoringToWorld * scale;
    var result: SparkleRaster;
    // Correct the anchor with the gem, but keep the authored flare proportions.
    result.position = center + center.w * vec4f(point.x * u.projection[0][0] / u.sparkleHalo.z,
        -point.y * u.projection[1][1], 0.0, 0.0);
    result.sourcePoint = sourcePoint;
    result.strength = strength;
    result.layer = layer;
    return result;
}

fn radialOpacity(radius: f32, first: f32, middle: f32) -> f32 {
    if (radius <= first) { return 1.0; }
    if (radius <= middle) { return mix(1.0, 0.5, (radius - first) / (middle - first)); }
    return 0.5 * saturate((1.0 - radius) / (1.0 - middle));
}

@fragment
fn sparkleFragment(r: SparkleRaster) -> @location(0) vec4f {
    var alpha = 1.0;
    var color = vec3f(1.0);
    if (r.layer == 0u) {
        let radius = length(r.sourcePoint - vec2f(-0.5, 0.2)) / 108.5;
        alpha = radialOpacity(radius, 0.312, 0.624) * 0.60;
    } else if (r.layer == 1u) {
        let radius = length(r.sourcePoint - vec2f(-0.5, 0.9)) / 113.1;
        alpha = radialOpacity(radius, 0.297, 0.503) * 0.60;
        color = vec3f(0.82, 1.0, 0.902);
    } else if (r.layer == 2u) {
        alpha = 0.96;
    } else if (r.layer == 3u) {
        let radius = saturate(length(r.sourcePoint) / length(vec2f(176.0, -170.0)));
        alpha = 1.0 - radius;
        color = mix(vec3f(0.694, 0.969, 1.0), vec3f(0.663, 0.957, 1.0), radius);
    } else if (r.layer == 5u) {
        alpha = radialOpacity(length(r.sourcePoint) / length(vec2f(228.9, 3.9)), 0.237, 0.623);
    }
    let appearance = u32(u.appearance.x);
    if (appearance == 1u) {
        color = select(vec3f(1.0), vec3f(0.635, 0.749, 1.0), r.layer == 0u);
        // The white source retains only the circular halo, without the extra
        // star-shaped glow used by the blue material.
        if (r.layer == 1u) { alpha = 0.0; }
    } else if (appearance == 2u) {
        color = select(vec3f(1.0), vec3f(0.82, 0.96, 1.0), r.layer == 1u);
    }
    alpha *= r.strength;
    return vec4f(color * alpha, alpha);
}
