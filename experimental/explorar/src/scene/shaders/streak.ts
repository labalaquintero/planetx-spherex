import { OUTPUT } from './common'

/**
 * Estela en cinta (colas de cometa, rastro de estrella fugaz y polvo de asteroide): una tira que
 * sale de la cabeza a lo largo de un eje, se ensancha hacia el final, puede curvarse y siempre
 * mira a la cámara (gira sobre su propio eje). Un draw call por estela, sin texturas.
 * uv.x = través (0..1), uv.y = a lo largo (0 = cabeza, 1 = final).
 */
export const STREAK_VERT = /* glsl */ `
uniform vec3 uHead;
uniform vec3 uAxis;
uniform vec3 uBend;
uniform float uLength;
uniform float uCurve;
uniform float uW0;
uniform float uW1;
uniform float uTime;
uniform float uSeed;
uniform float uWave;
uniform float uGrow;
uniform float uKink;
varying vec2 vUv;
void main() {
  float t = uv.y;
  float s = uv.x * 2.0 - 1.0;
  // Al aparecer, la estela crece desde la cabeza; su largo además late un poco.
  float len = uLength * uGrow * (1.0 + 0.06 * uWave * sin(uTime * 3.1 + uSeed * 2.3));
  vec3 c = uHead + uAxis * (t * len) + uBend * (t * t * len * uCurve);
  vec3 tangent = normalize(uAxis + uBend * (2.0 * t * uCurve));
  vec3 toCam = normalize(cameraPosition - c);
  vec3 side = cross(tangent, toCam);
  float l = length(side);
  side = l > 1e-4 ? side / l : vec3(1.0, 0.0, 0.0);
  float w = mix(uW0, uW1, pow(t, 0.75));
  // El ancho «respira» con ondas que viajan hacia la punta.
  w *= 1.0 + 0.14 * uWave * sin(t * 7.0 - uTime * 4.0 + uSeed);
  // Ondulación lateral: la cola se mece como una bandera, nada en la cabeza y más hacia la punta.
  float sway = sin(t * 8.5 - uTime * 2.6 + uSeed * 1.7) * 0.6 + sin(t * 17.0 - uTime * 4.9 + uSeed) * 0.25;
  // Quiebros que viajan de la cabeza a la punta, uno cada pocos segundos (como en las colas de iones).
  float kt = fract(uTime * 0.16 + uSeed * 0.37);
  float kink = exp(-pow((t - kt) * 7.0, 2.0)) * sin(t * 22.0 - uTime * 6.0 + uSeed) * uKink;
  vec3 wobble = side * (sway * uWave * t * t + kink * t) * w * 0.9;
  vUv = vec2(s, t);
  gl_Position = projectionMatrix * viewMatrix * vec4(c + wobble + side * s * w, 1.0);
}
`

export const STREAK_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uAlpha;
uniform float uTime;
uniform float uSeed;
uniform float uFil;
uniform float uGlitter;
uniform float uFalloff;
uniform float uFlow;
uniform float uWave;
uniform float uFlicker;
uniform float uKink;
varying vec2 vUv;
float ex_h1(float x) { return fract(sin(x * 127.1 + uSeed * 31.7) * 43758.5453); }
float ex_n1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(ex_h1(i), ex_h1(i + 1.0), f);
}
float ex_h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed * 7.1) * 43758.5453); }
void main() {
  float s = vUv.x;
  float t = vUv.y;
  // La materia corre hacia el final de la cola (uFlow): los filamentos y el borde se mueven.
  float tf = t - uTime * uFlow;
  // Borde irregular y cambiante: la silueta no es lisa como la de una imagen recortada.
  float edgeN = ex_n1(tf * 14.0 + sign(s) * 3.7);
  float across = exp(-s * s * 3.5) * (1.0 - smoothstep(0.42 + 0.4 * edgeN, 1.0, abs(s)));
  float fil = 0.55 * ex_n1(s * 7.0 + tf * 1.5) + 0.45 * ex_n1(s * 19.0 - tf * 4.0);
  float streaks = mix(1.0, 0.3 + 1.2 * fil, uFil * smoothstep(0.0, 0.3, t));
  // Grumos que viajan por la cola (más o menos densidad a lo largo).
  float clumps = 0.75 + 0.5 * ex_n1(tf * 9.0 + s * 1.3);
  float along = pow(1.0 - t, uFalloff) * smoothstep(0.0, 0.025, t) * mix(1.0, clumps, uFil * smoothstep(0.05, 0.3, t));
  // Pulsos de luz que corren de la cabeza a la punta y centelleo fino del polvo.
  float pulse = 1.0 + 0.4 * uWave * smoothstep(0.55, 1.0, sin((t - uTime * (0.35 + uFlow)) * 16.0 + s * 1.5 + uSeed));
  float shimmer = 0.88 + 0.24 * ex_h2(floor(vec2(t * 160.0, s * 9.0)) + floor(uTime * 14.0));
  // Parpadeo de conjunto (un meteoro que se quema no brilla parejo) y nudos de luz que recorren la cola.
  float flick = 1.0 - uFlicker * (0.45 * ex_n1(uTime * 17.0) + 0.25 * ex_n1(uTime * 41.0 + 5.0));
  float kt = fract(uTime * 0.16 + uSeed * 0.37);
  float knot = 1.0 + 1.3 * uKink * exp(-pow((t - kt) * 9.0, 2.0)) * exp(-s * s * 6.0);
  float a = across * streaks * along * pulse * knot * flick * mix(1.0, shimmer, smoothstep(0.08, 0.4, t));
  vec3 col = mix(uEdge, uCore, clamp(across * 1.3 - t * 0.6, 0.0, 1.0));
  // Destellos: puntos que titilan a lo largo del rastro (estrella fugaz).
  if (uGlitter > 0.0) {
    vec2 g = vec2(tf * 90.0, s * 5.0);
    float h = ex_h2(floor(g));
    float tw = 0.5 + 0.5 * sin(uTime * (6.0 + h * 10.0) + h * 40.0);
    vec2 f = fract(g) - 0.5;
    float dotm = smoothstep(0.35, 0.0, length(f * vec2(1.0, 0.6)));
    float spark = step(0.7, h) * tw * dotm * (1.0 - t) * (1.0 - smoothstep(0.6, 1.0, abs(s)));
    a += spark * uGlitter;
    col = mix(col, vec3(1.0), clamp(spark, 0.0, 1.0));
  }
  a *= uAlpha;
  gl_FragColor = vec4(col * a, a);
  ${OUTPUT}
}
`
