/** Fragmentos GLSL compartidos (ruido propio, sin dependencias). */
export const NOISE = /* glsl */ `
float ex_hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float ex_noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ex_hash3(i), ex_hash3(i + vec3(1, 0, 0)), u.x), mix(ex_hash3(i + vec3(0, 1, 0)), ex_hash3(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(ex_hash3(i + vec3(0, 0, 1)), ex_hash3(i + vec3(1, 0, 1)), u.x), mix(ex_hash3(i + vec3(0, 1, 1)), ex_hash3(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}
float ex_fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * ex_noise3(p);
    n += a;
    p = p * 2.03 + vec3(17.1, 9.3, 4.7);
    a *= 0.5;
  }
  return s / n;
}
vec3 ex_ramp(vec3 c0, vec3 c1, vec3 c2, float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, t * 2.0 - 1.0);
}
`

/** Densidad del anillo en u = 0 (borde interno) .. 1 (externo). La usan el anillo y la sombra sobre el planeta. */
export const RING_DENSITY = /* glsl */ `
float ex_ringDensity(float u, float seed) {
  if (u < 0.0 || u > 1.0) return 0.0;
  float n = ex_fbm(vec3(u * 38.0, seed, seed * 0.37), 4);
  float fine = ex_noise3(vec3(u * 160.0, seed * 1.3, 0.0));
  float d = 0.25 + 0.75 * smoothstep(0.25, 0.75, n) * (0.75 + 0.25 * fine);
  d *= mix(1.0, 0.08, smoothstep(0.575, 0.59, u) * (1.0 - smoothstep(0.625, 0.64, u))); // división
  d *= smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.9, u);
  return d;
}
`

/**
 * Horneado en cubemap (scene/bake.ts): 8 bits por canal con raíz cuadrada y ganancia, para no
 * perder precisión en los tonos oscuros del cielo.
 */
export const BAKE_ENCODE = /* glsl */ `vec4 ex_encode(vec3 c) { return vec4(sqrt(clamp(c * 4.0, 0.0, 1.0)), 1.0); }`
export const BAKE_DECODE = /* glsl */ `vec3 ex_decode(vec3 e) { return e * e / 4.0; }`

/** Vértices de los shaders de dirección: la dirección es la posición en el espacio del objeto. */
export const DIR_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** Tono y espacio de color de three: el mismo resultado con y sin composer (bloom). */
export const OUTPUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`
