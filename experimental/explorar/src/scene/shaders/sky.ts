import { NOISE, OUTPUT } from './common'

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  // Centrado en la cámara: el cielo está «en el infinito».
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** Nebulosa tenue con la paleta del visor y la estrella clave (núcleo y halo) en la dirección de la luz. */
export const SKY_FRAG = /* glsl */ `
uniform vec3 uLight;
uniform float uOct;
uniform float uStarGain; // 1 en el cielo; menor en el mapa de entorno (reflejos sin quemar)
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  vec3 q = vec3(ex_fbm(d * 1.6, int(uOct)), ex_fbm(d * 1.6 + 5.2, int(uOct)), 0.0);
  float n = ex_fbm(d * 2.2 + q * 1.6, int(uOct));
  float dust = ex_fbm(d * 4.5 + q * 2.0 + 11.0, 3);
  vec3 navy = vec3(0.059, 0.090, 0.165);
  vec3 sky = vec3(0.008, 0.412, 0.631);
  vec3 col = vec3(0.004, 0.008, 0.02);
  col = mix(col, navy * 0.55, smoothstep(0.38, 0.82, n));
  col = mix(col, sky * 0.12, smoothstep(0.6, 0.92, n) * 0.6);
  col *= mix(1.0, 0.45, smoothstep(0.45, 0.8, dust));
  // Estrella clave: núcleo muy brillante (lo recoge el bloom) y halo amplio.
  float k = max(dot(d, uLight), 0.0);
  vec3 starCol = vec3(1.0, 0.94, 0.84);
  col += starCol * (pow(k, 4000.0) * 6.0 * uStarGain + pow(k, 300.0) * 0.45 + pow(k, 24.0) * 0.035);
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`

export const STARS_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTw;
void main() {
  vColor = aColor;
  vTw = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 2.5) + aPhase * 40.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * mv;
}
`

export const STARS_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = smoothstep(0.5, 0.0, r);
  a *= a;
  gl_FragColor = vec4(vColor * vTw * a, a);
  ${OUTPUT}
}
`

/** Partículas de la estela del motor (aditivas). */
export const TRAIL_VERT = /* glsl */ `
attribute float aLife;
attribute float aSize;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`

export const TRAIL_FRAG = /* glsl */ `
uniform vec3 uHot;
uniform vec3 uCool;
varying float vLife;
void main() {
  if (vLife <= 0.0) discard;
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r) * vLife;
  vec3 col = mix(uCool, uHot, vLife * vLife);
  gl_FragColor = vec4(col * a, a);
  ${OUTPUT}
}
`
