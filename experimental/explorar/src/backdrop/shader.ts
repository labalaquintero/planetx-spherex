/**
 * Shaders del fondo de la selección: nebulosa procedural, tres capas de estrellas con paralaje y una
 * galaxia espiral inclinada cuyas regiones son los sectores (ver galaxy.ts). Todo es procedural: no
 * hay imágenes pegadas, así que la galaxia gira, titila y se ilumina por regiones.
 */
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
uniform vec4 uGal;      // galaxia: centro (uv) y semiejes mayor y menor
uniform float uGalAng;  // giro del eje mayor (radianes)
uniform float uGalPar;  // paralaje de la galaxia y sus regiones
uniform vec4 uArea[3];  // regiones de sector: centro (uv), semieje mayor y 1 si está «próximamente»
uniform vec3 uAreaCol[3];
uniform float uHover[3]; // 0..1, región señalada
uniform float uAreaN;
uniform float uAreaRatio;

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


// Gira p por -a (de la pantalla a los ejes de la galaxia).
vec2 toDisk(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
}

vec2 spin2(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Galaxia espiral de dos brazos: núcleo cálido, brazos azulados con nudos rosados de formación
// estelar, bandas de polvo junto a los brazos y estrellas resueltas en el disco. Gira muy despacio.
vec3 galaxy(vec2 p) {
  vec2 q = toDisk(p - uGal.xy, uGalAng);
  vec2 g = q / uGal.zw;
  float r = length(g);
  if (r > 1.7) return vec3(0.0);
  float spin = uTime * 0.012;
  float th = atan(g.y, g.x) - spin;
  float lr = log(max(r, 0.002));
  vec2 gr = spin2(g, -spin);  // coordenadas que giran con la galaxia (para el ruido)
  float n = fbm(gr * 5.0 + 3.0);
  float n2 = fbm(gr * 13.0 + 7.0);
  float phase = 2.0 * th - 4.4 * lr + (n - 0.5) * 1.6;
  float arm = pow(max(0.5 + 0.5 * cos(phase), 0.0), 2.4) * (0.55 + 0.9 * n);
  float disk = exp(-r * 2.4);
  float bulge = exp(-r * r * 90.0) * 1.1 + exp(-r * 9.0) * 0.32;
  float lane = pow(max(0.5 + 0.5 * cos(phase + 0.95), 0.0), 7.0) * smoothstep(0.06, 0.28, r) * (1.0 - smoothstep(0.75, 1.15, r));
  vec3 armCol = mix(vec3(0.52, 0.66, 1.0), vec3(0.78, 0.6, 1.0), smoothstep(0.35, 0.75, n2));
  vec3 col = vec3(1.0, 0.84, 0.6) * bulge;
  col += armCol * arm * disk * 1.6;
  col += vec3(0.32, 0.36, 0.62) * disk * 0.34;
  float knots = smoothstep(0.7, 0.92, n2) * arm * smoothstep(0.12, 0.35, r) * (1.0 - smoothstep(0.85, 1.1, r));
  col += vec3(1.0, 0.55, 0.78) * knots * 0.45;
  col *= 1.0 - 0.7 * lane * (0.55 + 0.45 * n);
  // Estrellas resueltas del disco: más densas en los brazos; giran con la galaxia.
  vec2 sc = gr * vec2(uGal.z, uGal.w) * 150.0;
  vec2 id = floor(sc);
  float h = h21(id + 41.0);
  vec2 f = fract(sc) - 0.5 - (vec2(h21(id + 3.1), h21(id + 8.7)) - 0.5) * 0.6;
  float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 6.0) + h * 40.0);
  float star = step(1.0 - (0.06 + 0.5 * arm) * disk * 1.6, h) * smoothstep(0.22, 0.0, length(f)) * tw;
  col += mix(vec3(1.0, 0.9, 0.78), vec3(0.8, 0.88, 1.0), h21(id + 5.0)) * star * 0.9;
  col *= 1.0 - smoothstep(0.9, 1.6, r);
  // Compresión suave: el núcleo no se quema y conserva su color.
  return 1.0 - exp(-col * 1.15);
}

// Regiones de los sectores: un brillo suave en el disco y un borde fino. En reposo el borde es
// punteado y lo recorre un destello; al señalarlo se vuelve continuo, la región se ilumina y sale un
// pulso hacia fuera.
vec3 areas(vec2 p, vec3 col) {
  float px = 1.0 / uRes.y;
  for (int i = 0; i < 3; i++) {
    if (float(i) >= uAreaN) break;
    vec4 a = uArea[i];
    vec3 c = uAreaCol[i];
    float hv = uHover[i];
    float dim = 1.0 - 0.5 * a.w;
    vec2 d = toDisk(p - a.xy, uGalAng);
    d.y /= uAreaRatio;
    float e = length(d) / a.z;
    float ang = atan(d.y, d.x);
    float inner = exp(-e * e * 2.4);
    col *= 1.0 + inner * hv * 0.55;
    col += c * inner * (0.07 + 0.2 * hv) * dim;
    float wr = 1.4 * px / a.z;
    float rd = (e - 1.0) / wr;
    float ring = exp(-rd * rd);
    float dash = smoothstep(0.25, 0.65, 0.5 + 0.5 * cos(ang * 22.0 - uTime * 1.4));
    float sweep = 0.35 + 0.65 * pow(max(0.5 + 0.5 * cos(ang - uTime * 0.8 + float(i) * 2.1), 0.0), 4.0);
    col += c * ring * mix(dash * (0.35 + 0.65 * sweep), 1.0, hv) * (0.6 + 0.6 * hv) * dim;
    float hd = (e - 1.0) / (wr * 9.0);
    float halo = exp(-hd * hd);
    col += c * halo * 0.12 * hv;
    float pr = fract(uTime * 0.5 + float(i) * 0.31);
    float pd = (e - 1.0 - pr * 0.45) / (wr * 2.0);
    float pulse = exp(-pd * pd) * (1.0 - pr) * hv;
    col += c * pulse * 0.45;
  }
  return col;
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
  // Nebulosa más tenue y con un toque violeta: la galaxia es la protagonista.
  col = mix(col * 0.75, col * vec3(1.15, 0.85, 1.25), smoothstep(0.55, 0.9, n) * 0.5);

  // Galaxia y regiones de los sectores (plano medio del paralaje).
  vec2 gp = zuv + uPar * uGalPar;
  col += galaxy(gp);
  col = areas(gp, col);

  // Estrellas (rayas durante el salto).
  vec2 rad = zuv - uCenter;
  vec2 dir = length(rad) > 1e-4 ? normalize(rad) : vec2(1.0, 0.0);
  vec3 s = allStars(zuv, dir, uStreak) * (1.0 + uStreak * 1.2);
  gl_FragColor = vec4(col + s, 1.0);
}
`
