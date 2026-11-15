import { OUTPUT } from './common'

/**
 * Brillo procedural de la cabeza de los visitantes (en lugar de una imagen fija): un cuadrado que mira
 * a la cámara. Modo 0, coma de cometa: gas turbulento que fluye hacia fuera y núcleo muy brillante.
 * Modo 1, estrella fugaz: núcleo con cuatro puntas largas y cuatro cortas que giran y titilan.
 * En ambos el halo se alarga hacia atrás del movimiento (uDir, en el plano de la pantalla) y parpadea
 * un poco, para que no parezca una pegatina.
 */
export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uAlpha;
uniform float uTime;
uniform float uSeed;
uniform vec2 uDir;
uniform float uStretch;
uniform float uMode;
varying vec2 vUv;
float ex_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 13.1) * 43758.5453); }
float ex_n(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ex_h(i), ex_h(i + vec2(1.0, 0.0)), f.x), mix(ex_h(i + vec2(0.0, 1.0)), ex_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ex_f(vec2 p) { return 0.5 * ex_n(p) + 0.3 * ex_n(p * 2.1 + 3.7) + 0.2 * ex_n(p * 4.3 + 1.3); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float dl = length(uDir);
  vec2 d = dl > 1e-4 ? uDir / dl : vec2(1.0, 0.0);
  // Coordenadas a lo largo del movimiento: por detrás (x < 0) el halo se estira.
  vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
  q.x = q.x < 0.0 ? q.x / (1.0 + uStretch) : q.x * (1.0 + uStretch * 0.25);
  float r = length(q);
  float ang = atan(q.y, q.x);
  float flick = 0.86 + 0.14 * sin(uTime * 11.0 + uSeed * 9.0) * sin(uTime * 7.3 + uSeed);
  float a;
  vec3 col;
  if (uMode < 0.5) {
    float n = ex_f(vec2(ang * 1.6 + uSeed, r * 4.0 - uTime * 0.9));
    float n2 = ex_f(vec2(ang * 3.1 - uSeed, r * 7.0 - uTime * 1.7));
    float core = exp(-r * r * 70.0);
    float inner = exp(-r * r * 10.0) * (0.5 + 0.5 * n);
    float halo = exp(-r * 3.2) * (0.3 + 0.7 * n * n2) * 0.7;
    a = (core * 2.4 + inner * 0.9 + halo) * smoothstep(1.0, 0.7, r);
    col = mix(uColor, uCore, clamp(core * 1.4 + inner * 0.45, 0.0, 1.0));
  } else {
    float rot = uTime * 0.35 + uSeed;
    float c = cos(rot);
    float s = sin(rot);
    vec2 k = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float spikes = exp(-abs(k.x) * 55.0) * exp(-abs(k.y) * 2.4) + exp(-abs(k.y) * 55.0) * exp(-abs(k.x) * 2.4);
    vec2 kd = vec2(k.x + k.y, k.x - k.y) * 0.7071;
    spikes += 0.45 * (exp(-abs(kd.x) * 70.0) * exp(-abs(kd.y) * 4.5) + exp(-abs(kd.y) * 70.0) * exp(-abs(kd.x) * 4.5));
    float core = exp(-r * r * 90.0);
    float halo = exp(-r * 5.0) * 0.5;
    a = (core * 2.6 + spikes * (0.75 + 0.45 * sin(uTime * 9.0 + uSeed * 3.0)) + halo) * smoothstep(1.0, 0.8, length(p));
    col = mix(uColor, uCore, clamp(core * 1.5 + spikes * 0.4, 0.0, 1.0));
  }
  // Siempre se apaga antes del borde del cuadrado (el halo estirado no deja un borde recto).
  a *= uAlpha * flick * smoothstep(1.0, 0.55, length(p));
  gl_FragColor = vec4(col * a, a);
  ${OUTPUT}
}
`
