import { NOISE, OUTPUT, RING_DENSITY } from './common'

export const PLANET_VERT = /* glsl */ `
uniform float uRadius;
varying vec2 vUv;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vObj = position / uRadius;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const PLANET_FRAG = /* glsl */ `
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uMode;    // 0 = rocoso, 1 = bandas, 2 = mundo frío con tormentas (enana marrón)
uniform vec3 uVortex[3]; // direcciones de los vórtices (objeto)
uniform vec3 uGlow;      // brillo propio (emisión tenue)
uniform float uGlowStrength;
uniform float uSeed;
uniform vec3 uLight;    // dirección hacia la estrella (mundo)
uniform vec3 uAmbient;
uniform float uOct;
uniform float uTime;
uniform vec3 uCenter;
uniform float uRadius;
uniform float uHasRing;
uniform vec3 uRingNormal;
uniform float uRingInner;
uniform float uRingOuter;
uniform float uRingSeed;
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uMapMode;   // 0 = color de la textura teñido; 1 = luminancia coloreada con la paleta
uniform sampler2D uBump;
uniform float uHasBump;
uniform float uBumpScale;
uniform sampler2D uRingMap;
uniform float uHasRingMap;
varying vec2 vUv;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;
${NOISE}
${RING_DENSITY}
// Relieve por derivadas de pantalla (como bumpmap de three, sin tangentes).
vec3 ex_bump(vec3 N, vec3 pos, float h, float scale) {
  vec3 dpx = dFdx(pos);
  vec3 dpy = dFdy(pos);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 r1 = cross(dpy, N);
  vec3 r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - scale * grad);
}
float ex_ringAt(float u) {
  if (uHasRingMap > 0.5) return (u < 0.0 || u > 1.0) ? 0.0 : texture2D(uRingMap, vec2(u, 0.5)).a;
  return ex_ringDensity(u, uRingSeed);
}
void main() {
  vec3 p = normalize(vObj);
  vec3 sp = p + vec3(uSeed * 0.731, uSeed * 0.317, uSeed * 0.113);
  float t;
  float storm = 0.0;
  if (uMode > 1.5) {
    // Mundo frío: la superficie se retuerce alrededor de 3 vórtices y fluye en zonas muy suaves
    // (nada de bandas marcadas). Rotación diferencial lenta por latitud.
    vec3 q = p;
    float spin = uTime * 0.006 * (1.0 + 0.6 * abs(q.y));
    float cs = cos(spin), sn = sin(spin);
    q = vec3(cs * q.x + sn * q.z, q.y, -sn * q.x + cs * q.z);
    for (int i = 0; i < 3; i++) {
      vec3 c = normalize(uVortex[i]);
      float d = distance(q, c);
      float w = exp(-d * d / 0.03);
      storm = max(storm, w);
      float ang = w * (2.6 - float(i) * 0.6);
      // Rodrigues: girar q alrededor de c.
      q = q * cos(ang) + cross(c, q) * sin(ang) + c * dot(c, q) * (1.0 - cos(ang));
    }
    vec3 sq = q + vec3(uSeed * 0.731, uSeed * 0.317, uSeed * 0.113);
    float warp = ex_fbm(sq * 2.2, int(uOct));
    float zones = 0.5 + 0.5 * sin(q.y * 7.0 + warp * 3.2);
    float turb = ex_fbm(sq * 4.5 + warp * 1.4, int(uOct));
    t = mix(turb, zones, 0.22) * 0.85 + storm * 0.25;
  } else if (uMode > 0.5) {
    // Franjas por latitud, torcidas por turbulencia; deriva lenta.
    float warp = ex_fbm(sp * 2.6 + vec3(uTime * 0.004, 0.0, 0.0), int(uOct)) - 0.5;
    float lat = p.y + warp * 0.22;
    float band = ex_fbm(vec3(lat * 7.5, uSeed, uSeed * 0.5), 3);
    float fine = ex_fbm(sp * 11.0, 3);
    t = band * 0.82 + fine * 0.18;
  } else {
    float base = ex_fbm(sp * 2.4, int(uOct));
    float ridge = 1.0 - abs(ex_fbm(sp * 6.0 + 3.1, 3) * 2.0 - 1.0);
    t = base * 0.75 + ridge * ridge * 0.25;
    // Cráteres suaves: depresiones de ruido celular barato.
    float c = ex_noise3(sp * 9.0);
    t -= smoothstep(0.82, 0.95, c) * 0.18;
  }
  vec3 albedo = ex_ramp(uC0, uC1, uC2, t);
  // Ojo de las tormentas: un anillo algo más claro y frío.
  albedo = mix(albedo, uC2 * 1.15, storm * smoothstep(0.2, 0.7, t) * 0.5);
  if (uHasMap > 0.5) {
    vec3 tex = texture2D(uMap, vUv).rgb;
    float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
    // Detalle fino procedural encima de la textura (evita que se vea borrosa de cerca).
    float fineDetail = 0.94 + 0.12 * ex_noise3(sp * 14.0);
    if (uMapMode < 0.5) {
      albedo = mix(tex, ex_ramp(uC0, uC1, uC2, sqrt(lum) * 1.1), 0.3) * fineDetail;
    } else {
      albedo = ex_ramp(uC0, uC1, uC2, clamp(pow(lum, 0.6) * 1.35, 0.0, 1.0)) * fineDetail;
    }
  }

  vec3 N = normalize(vNormalW);
  if (uHasBump > 0.5) N = ex_bump(N, vWorld, texture2D(uBump, vUv).r, uBumpScale);
  float ndl = dot(N, uLight);
  float diffuse = smoothstep(-0.12, 1.0, ndl);           // terminador suave
  float shadow = 1.0;
  if (uHasRing > 0.5) {
    // Sombra del anillo: rayo hacia la estrella contra el plano del anillo.
    float denom = dot(uLight, uRingNormal);
    if (abs(denom) > 1e-4) {
      float s = dot(uCenter - vWorld, uRingNormal) / denom;
      if (s > 0.0) {
        float r = length(vWorld + uLight * s - uCenter) / uRadius;
        float u = (r - uRingInner) / (uRingOuter - uRingInner);
        shadow = 1.0 - 0.85 * ex_ringAt(u);
      }
    }
  }
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(-0.2, 0.5, ndl);
  vec3 col = albedo * (uAmbient + diffuse * shadow * 1.15) + albedo * rim * 0.35;
  // Brillo propio tenue (más visible en el lado nocturno), modulado por la turbulencia.
  if (uGlowStrength > 0.0) col += uGlow * uGlowStrength * (0.35 + 0.65 * (1.0 - diffuse)) * (0.4 + 0.6 * t);
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`

export const ATMOS_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** Atmósfera: cáscara aditiva con fresnel, más intensa del lado iluminado. */
export const ATMOS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uIntensity;
uniform float uPower; // más alto = borde más fino
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), uPower);
  float lit = smoothstep(-0.35, 0.6, dot(N, uLight));
  float a = fres * lit * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
  ${OUTPUT}
}
`

export const RING_VERT = /* glsl */ `
uniform float uRadius;
varying vec3 vWorld;
varying float vR;
varying vec3 vNormalW;
void main() {
  vR = length(position.xy) / uRadius;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** Anillo: bandas con transparencia, iluminado por ambas caras y con la sombra del planeta. */
export const RING_FRAG = /* glsl */ `
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;
uniform vec3 uLight;
uniform vec3 uCenter;
uniform float uRadius;
uniform sampler2D uRingMap;
uniform float uHasRingMap;
varying vec3 vWorld;
varying float vR;
varying vec3 vNormalW;
${NOISE}
${RING_DENSITY}
void main() {
  float u = (vR - uInner) / (uOuter - uInner);
  float d;
  vec3 col;
  if (uHasRingMap > 0.5) {
    vec4 r = texture2D(uRingMap, vec2(clamp(u, 0.0, 1.0), 0.5));
    d = (u < 0.0 || u > 1.0) ? 0.0 : r.a;
    col = r.rgb;
  } else {
    d = ex_ringDensity(u, uSeed);
    col = ex_ramp(uC0, uC1, uC2, 0.2 + 0.7 * ex_noise3(vec3(u * 55.0, uSeed, 1.0)));
  }
  if (d < 0.01) discard;
  // Sombra del planeta: ¿el rayo hacia la estrella corta la esfera?
  vec3 oc = vWorld - uCenter;
  float b = dot(oc, uLight);
  float c = dot(oc, oc) - uRadius * uRadius;
  float h = b * b - c;
  float shadow = (h > 0.0 && -b - sqrt(h) > 0.0) ? 0.1 : 1.0;
  float light = 0.25 + 0.75 * abs(dot(normalize(vNormalW), uLight));
  gl_FragColor = vec4(col * light * shadow, d * 0.92);
  ${OUTPUT}
}
`
