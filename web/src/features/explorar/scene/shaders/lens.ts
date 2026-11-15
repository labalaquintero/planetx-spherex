/**
 * Limpieza antes del bloom: un píxel NaN o infinito (división entre cero en algún shader, o un
 * valor que desborda el búfer de media precisión) se extiende con el desenfoque del bloom y deja
 * bloques negros o blancos en media pantalla, sobre todo en Windows (D3D). Aquí se recorta a un
 * rango válido; en D3D, clamp devuelve el operando que no es NaN, y además se comprueba isnan.
 */
export const SANITIZE_SHADER = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = clamp(texture2D(tDiffuse, vUv).rgb, vec3(0.0), vec3(48.0));
      if (any(isnan(c))) c = vec3(0.0);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
}

/**
 * Pase final de «lente»: aberración cromática radial ligera, grano fino animado y viñeta suave.
 * Va después de OutputPass (espacio de pantalla, sRGB).
 */
export const LENS_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uCA: { value: 0.0016 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uCA;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      // Aberración: el rojo y el azul se separan hacia los bordes (nada en el centro).
      vec2 off = d * uCA * (0.5 + 4.0 * r2);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      // Grano fino, más visible en sombras (como en película).
      float g = hash(vUv * 1000.0 + fract(uTime * 7.31)) - 0.5;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col += g * uGrain * (1.0 - lum * 0.7);
      // Viñeta suave.
      col *= 1.0 - uVignette * smoothstep(0.18, 0.75, r2 * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}
