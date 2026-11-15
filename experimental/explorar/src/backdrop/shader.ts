/** Shaders del fondo de la selección: nebulosa procedural y tres capas de estrellas con paralaje. */
export const VERTEX = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

export const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPar;      // paralaje suavizado del cursor, [-1, 1]
uniform float uStreak;  // 0..1, rayas del salto
uniform float uZoom;    // >= 1, acercamiento del salto
uniform vec2 uCenter;   // centro del salto (coordenadas uv)
uniform float uOct;     // octavas de la nebulosa

float h21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  float n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uOct) break;
    s += a * vnoise(p);
    n += a;
    p = p * 2.03 + vec2(17.1, 9.3);
    a *= 0.5;
  }
  return s / n;
}

// Estrella por celda. Durante el salto la distancia se mide estirada a lo largo del radio
// (desde uCenter): cada estrella se convierte en una raya continua que apunta al centro.
vec3 starLayer(vec2 uv, float scale, float density, float radius, float seed, vec2 dir, float stretch) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = h21(id + seed);
  if (h > density) return vec3(0.0);
  vec2 o = (vec2(h21(id + seed + 1.7), h21(id + seed + 5.3)) - 0.5) * 0.5;
  vec2 v = f - o;
  float along = dot(v, dir);
  float across = dot(v, vec2(-dir.y, dir.x));
  float d = length(vec2(along / stretch, across));
  float tw = 0.72 + 0.28 * sin(uTime * (0.5 + h * 9.0) + h * 61.0);
  float b = smoothstep(radius, 0.0, d) * tw * (0.35 + 0.65 * (h / density));
  vec3 warm = vec3(1.0, 0.86, 0.72);
  vec3 cool = vec3(0.74, 0.87, 1.0);
  return b * mix(warm, cool, h21(id + seed + 9.1));
}

vec3 allStars(vec2 uv, vec2 dir, float k) {
  vec3 c = vec3(0.0);
  c += starLayer(uv + uPar * 0.006, 110.0, 0.30, 0.09, 3.0, dir, 1.0 + k * 3.0) * 0.55;  // lejanas
  c += starLayer(uv + uPar * 0.016, 52.0, 0.16, 0.08, 11.0, dir, 1.0 + k * 4.5) * 0.85;  // medias
  c += starLayer(uv + uPar * 0.034, 24.0, 0.07, 0.065, 29.0, dir, 1.0 + k * 6.5) * 1.25; // cercanas
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 zuv = uCenter + (uv - uCenter) / uZoom;

  // Nebulosa: fbm con deformación de dominio, en la paleta del visor (marino, sky, cian).
  vec2 p = zuv * 1.25 + uPar * 0.035;
  vec2 q = vec2(fbm(p + vec2(0.0, uTime * 0.008)), fbm(p + vec2(5.2, 1.3)));
  float n = fbm(p * 1.55 + q * 1.8 + vec2(uTime * 0.005, 0.0));
  float dust = fbm(p * 3.1 + q * 2.2 + 11.0);

  vec3 deep = vec3(0.012, 0.027, 0.071);  // #030712
  vec3 navy = vec3(0.059, 0.090, 0.165);  // #0f172a
  vec3 sky = vec3(0.008, 0.412, 0.631);   // #0369a1
  vec3 cyan = vec3(0.220, 0.741, 0.973);  // #38bdf8
  vec3 col = deep;
  col = mix(col, navy * 1.6, smoothstep(0.30, 0.72, n));
  col = mix(col, sky * 0.42, smoothstep(0.52, 0.86, n) * 0.75);
  col += cyan * pow(smoothstep(0.62, 0.98, n), 3.0) * 0.22;
  col *= mix(1.0, 0.5, smoothstep(0.48, 0.82, dust));
  col *= 1.0 - 0.38 * dot(uv * 0.75, uv * 0.75);

  // Estrellas (rayas durante el salto).
  vec2 rad = zuv - uCenter;
  vec2 dir = length(rad) > 1e-4 ? normalize(rad) : vec2(1.0, 0.0);
  vec3 s = allStars(zuv, dir, uStreak) * (1.0 + uStreak * 1.2);
  gl_FragColor = vec4(col + s, 1.0);
}
`
