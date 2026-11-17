export const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vTexCoord;

void main() {
  vTexCoord = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Ported from Android `FilterShaders.toolsFragmentShaderCode`; sharpen and enhance follow webK
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 outColor;

uniform sampler2D uImage;
uniform sampler2D uCurves;
uniform vec2 uImageSize;
uniform bool uHasCurves;
uniform float uSharpen;
uniform float uShadows;
uniform float uHighlights;
uniform float uContrast;
uniform float uFade;
uniform float uSaturation;
uniform vec3 uShadowsTintColor;
uniform float uShadowsTintIntensity;
uniform vec3 uHighlightsTintColor;
uniform float uHighlightsTintIntensity;
uniform float uExposure;
uniform float uWarmth;
uniform float uGrain;
uniform float uVignette;

const float TOOL_EPSILON = 0.005;
const vec3 HS_LUMINANCE_WEIGHTING = vec3(0.3);
const vec3 SAT_LUMINANCE_WEIGHTING = vec3(0.2126, 0.7152, 0.0722);
const float PERM_TEX_UNIT = 1.0 / 256.0;
const float PERM_TEX_UNIT_HALF = 0.5 / 256.0;
const float GRAIN_SIZE = 2.3;

float getLuma(vec3 rgb) {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

vec3 rgbToHsl(vec3 color) {
  vec3 hsl;
  float fmin = min(min(color.r, color.g), color.b);
  float fmax = max(max(color.r, color.g), color.b);
  float delta = fmax - fmin;
  hsl.z = (fmax + fmin) / 2.0;
  if (delta == 0.0) {
    hsl.xy = vec2(0.0);
    return hsl;
  }

  hsl.y = hsl.z < 0.5 ? delta / (fmax + fmin) : delta / (2.0 - fmax - fmin);
  float deltaR = (((fmax - color.r) / 6.0) + (delta / 2.0)) / delta;
  float deltaG = (((fmax - color.g) / 6.0) + (delta / 2.0)) / delta;
  float deltaB = (((fmax - color.b) / 6.0) + (delta / 2.0)) / delta;
  if (color.r == fmax) {
    hsl.x = deltaB - deltaG;
  } else if (color.g == fmax) {
    hsl.x = (1.0 / 3.0) + deltaR - deltaB;
  } else {
    hsl.x = (2.0 / 3.0) + deltaG - deltaR;
  }
  hsl.x = fract(hsl.x + 1.0);
  return hsl;
}

float hueToRgb(float f1, float f2, float hue) {
  hue = fract(hue + 1.0);
  if (6.0 * hue < 1.0) return f1 + (f2 - f1) * 6.0 * hue;
  if (2.0 * hue < 1.0) return f2;
  if (3.0 * hue < 2.0) return f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
  return f1;
}

vec3 hslToRgb(vec3 hsl) {
  if (hsl.y == 0.0) return vec3(hsl.z);
  float f2 = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : (hsl.z + hsl.y) - (hsl.y * hsl.z);
  float f1 = 2.0 * hsl.z - f2;
  return vec3(hueToRgb(f1, f2, hsl.x + (1.0 / 3.0)), hueToRgb(f1, f2, hsl.x), hueToRgb(f1, f2, hsl.x - (1.0 / 3.0)));
}

vec3 rgbToYuv(vec3 rgb) {
  float luma = getLuma(rgb);
  return vec3(luma, (1.0 / 1.772) * (rgb.b - luma), (1.0 / 1.402) * (rgb.r - luma));
}

vec3 yuvToRgb(vec3 yuv) {
  return vec3(
    1.402 * yuv.b + yuv.r,
    yuv.r - (0.299 * 1.402 / 0.587) * yuv.b - (0.114 * 1.772 / 0.587) * yuv.g,
    1.772 * yuv.g + yuv.r
  );
}

float easeInOutSigmoid(float value, float strength) {
  if (value > 0.5) return 1.0 - pow(2.0 - 2.0 * value, 1.0 / (1.0 - strength)) * 0.5;
  return pow(2.0 * value, 1.0 / (1.0 - strength)) * 0.5;
}

vec4 lookupCurves(float value) {
  return texelFetch(uCurves, ivec2(int(clamp(value, 0.0, 1.0) * 255.0 + 0.5), 0), 0);
}

vec3 applyLuminanceCurve(vec3 hsl) {
  hsl.y = mix(0.0, hsl.y, smoothstep(0.0, 0.1, hsl.z) * (1.0 - smoothstep(0.8, 1.0, hsl.z)));
  hsl.z = lookupCurves(hsl.z).a;
  return hsl;
}

vec3 applyRgbCurve(vec3 rgb) {
  return vec3(lookupCurves(rgb.r).r, lookupCurves(rgb.g).g, lookupCurves(rgb.b).b);
}

vec3 fadeAdjust(vec3 color, float amount) {
  vec3 faded = color + (vec3(-0.9772) * pow(color, vec3(3.0)) + vec3(1.708) * pow(color, vec3(2.0))
    + vec3(-0.1603) * color + vec3(0.2878) - color * vec3(0.9));
  return color * (1.0 - amount) + faded * amount;
}

vec3 tintRaiseShadowsCurve(vec3 color) {
  return vec3(-0.003671) * pow(color, vec3(3.0)) + vec3(0.3842) * pow(color, vec3(2.0))
    + vec3(0.3764) * color + vec3(0.2515);
}

vec3 tintShadows(vec3 texel, vec3 tintColor, float amount) {
  return clamp(mix(texel, mix(texel, tintRaiseShadowsCurve(texel), tintColor), amount), 0.0, 1.0);
}

vec3 tintHighlights(vec3 texel, vec3 tintColor, float amount) {
  vec3 raised = vec3(1.0) - tintRaiseShadowsCurve(vec3(1.0) - texel);
  return clamp(mix(texel, mix(texel, raised, vec3(1.0) - tintColor), amount), 0.0, 1.0);
}

vec4 rnm(vec2 tc) {
  float noise = sin(dot(tc, vec2(12.9898, 78.233))) * 43758.5453;
  return vec4(fract(noise), fract(noise * 1.2154), fract(noise * 1.3453), fract(noise * 1.3647)) * 2.0 - 1.0;
}

float fadeCurve(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float pnoise3D(vec3 p) {
  vec3 pi = PERM_TEX_UNIT * floor(p) + PERM_TEX_UNIT_HALF;
  vec3 pf = fract(p);
  float perm = rnm(pi.xy).a;
  float n000 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf);
  float n001 = dot(rnm(vec2(perm, pi.z + PERM_TEX_UNIT)).rgb * 4.0 - 1.0, pf - vec3(0.0, 0.0, 1.0));
  perm = rnm(pi.xy + vec2(0.0, PERM_TEX_UNIT)).a;
  float n010 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf - vec3(0.0, 1.0, 0.0));
  float n011 = dot(rnm(vec2(perm, pi.z + PERM_TEX_UNIT)).rgb * 4.0 - 1.0, pf - vec3(0.0, 1.0, 1.0));
  perm = rnm(pi.xy + vec2(PERM_TEX_UNIT, 0.0)).a;
  float n100 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf - vec3(1.0, 0.0, 0.0));
  float n101 = dot(rnm(vec2(perm, pi.z + PERM_TEX_UNIT)).rgb * 4.0 - 1.0, pf - vec3(1.0, 0.0, 1.0));
  perm = rnm(pi.xy + vec2(PERM_TEX_UNIT, PERM_TEX_UNIT)).a;
  float n110 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf - vec3(1.0, 1.0, 0.0));
  float n111 = dot(rnm(vec2(perm, pi.z + PERM_TEX_UNIT)).rgb * 4.0 - 1.0, pf - vec3(1.0, 1.0, 1.0));
  vec4 nx = mix(vec4(n000, n001, n010, n011), vec4(n100, n101, n110, n111), fadeCurve(pf.x));
  vec2 nxy = mix(nx.xy, nx.zw, fadeCurve(pf.y));
  return mix(nxy.x, nxy.y, fadeCurve(pf.z));
}

vec2 coordRot(vec2 tc, float angle) {
  return vec2(
    ((tc.x * 2.0 - 1.0) * cos(angle) - (tc.y * 2.0 - 1.0) * sin(angle)) * 0.5 + 0.5,
    ((tc.y * 2.0 - 1.0) * cos(angle) + (tc.x * 2.0 - 1.0) * sin(angle)) * 0.5 + 0.5
  );
}

vec4 sharpen(vec4 center, float amount) {
  vec2 step = 1.5 / uImageSize;
  vec3 around = texture(uImage, vTexCoord + vec2(-step.x, -step.y)).rgb
    + texture(uImage, vTexCoord + vec2(step.x, -step.y)).rgb
    + texture(uImage, vTexCoord + vec2(-step.x, step.y)).rgb
    + texture(uImage, vTexCoord + vec2(step.x, step.y)).rgb;
  return vec4(clamp(center.rgb * (1.0 + 4.0 * amount) - around * amount, 0.0, 1.0), center.a);
}

void main() {
  vec4 result = texture(uImage, vTexCoord);

  if (uSharpen > TOOL_EPSILON) {
    result = sharpen(result, uSharpen);
  }

  if (uHasCurves) {
    result.rgb = applyRgbCurve(hslToRgb(applyLuminanceCurve(rgbToHsl(result.rgb))));
  }

  float hsLuminance = dot(result.rgb, HS_LUMINANCE_WEIGHTING);
  float shadow = clamp(
    (pow(hsLuminance, 1.0 / uShadows) + (-0.76) * pow(hsLuminance, 2.0 / uShadows)) - hsLuminance, 0.0, 1.0
  );
  float highlight = clamp(
    (1.0 - (pow(1.0 - hsLuminance, 1.0 / (2.0 - uHighlights))
      + (-0.8) * pow(1.0 - hsLuminance, 2.0 / (2.0 - uHighlights)))) - hsLuminance,
    -1.0,
    0.0
  );
  vec3 hsResult = (hsLuminance + shadow + highlight) * (result.rgb / max(hsLuminance, 1e-5));
  float contrastedLuminance = ((hsLuminance - 0.5) * 1.5) + 0.5;
  float whiteInterp = contrastedLuminance * contrastedLuminance * contrastedLuminance;
  float whiteTarget = clamp(uHighlights, 1.0, 2.0) - 1.0;
  hsResult = mix(hsResult, vec3(1.0), clamp(whiteInterp * whiteTarget, 0.0, 1.0));
  float invContrastedLuminance = 1.0 - contrastedLuminance;
  float blackInterp = invContrastedLuminance * invContrastedLuminance * invContrastedLuminance;
  float blackTarget = 1.0 - clamp(uShadows, 0.0, 1.0);
  hsResult = mix(hsResult, vec3(0.0), clamp(blackInterp * blackTarget, 0.0, 1.0));
  result.rgb = hsResult;

  result.rgb = clamp((result.rgb - vec3(0.5)) * uContrast + vec3(0.5), 0.0, 1.0);

  if (abs(uFade) > TOOL_EPSILON) {
    result.rgb = fadeAdjust(result.rgb, uFade);
  }

  float satLuminance = dot(result.rgb, SAT_LUMINANCE_WEIGHTING);
  result.rgb = clamp(mix(vec3(satLuminance), result.rgb, uSaturation), 0.0, 1.0);

  if (uShadowsTintIntensity > TOOL_EPSILON) {
    result.rgb = tintShadows(result.rgb, uShadowsTintColor, uShadowsTintIntensity * 2.0);
  }

  if (uHighlightsTintIntensity > TOOL_EPSILON) {
    result.rgb = tintHighlights(result.rgb, uHighlightsTintColor, uHighlightsTintIntensity * 2.0);
  }

  if (abs(uExposure) > TOOL_EPSILON) {
    float mag = uExposure * 1.045;
    float expPower = 1.0 + abs(mag);
    if (mag < 0.0) expPower = 1.0 / expPower;
    result.rgb = vec3(1.0) - pow(max(vec3(1.0) - result.rgb, 0.0), vec3(expPower));
  }

  if (abs(uWarmth) > TOOL_EPSILON) {
    vec3 yuvVec = uWarmth > 0.0 ? vec3(0.1765, -0.1255, 0.0902) : -vec3(0.0588, 0.1569, -0.1255);
    vec3 yuvColor = rgbToYuv(result.rgb);
    yuvColor += 0.375 * uWarmth * sin(yuvColor.r * 3.14159) * yuvVec;
    result.rgb = clamp(yuvToRgb(yuvColor), 0.0, 1.0);
  }

  if (uGrain > TOOL_EPSILON) {
    vec2 rotCoords = coordRot(vTexCoord, 1.425);
    vec3 noise = vec3(pnoise3D(vec3(rotCoords * (uImageSize / GRAIN_SIZE), 0.0)));
    float luminance = getLuma(result.rgb);
    float lum = smoothstep(0.2, 0.0, luminance) + luminance;
    noise = mix(noise, vec3(0.0), pow(lum, 4.0));
    result.rgb = clamp(result.rgb + noise * uGrain, 0.0, 1.0);
  }

  if (uVignette > TOOL_EPSILON) {
    float radDist = length(vTexCoord - 0.5) / sqrt(0.5);
    float mag = easeInOutSigmoid(radDist * 0.7, 0.62) * uVignette * 0.645;
    result.rgb = mix(pow(result.rgb, vec3(1.0 / (1.0 - mag))), vec3(0.0), mag * mag);
  }

  outColor = result;
}
`;
