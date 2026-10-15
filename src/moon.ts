import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three'

// A moon disc for night scenes. At night the atmosphere is lit "by the moon"
// (see scene.ts), so the sky material can't also shade the moon's phase; this
// disc does, using the real sun direction.

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform vec3 sunDirectionLocal;
uniform vec3 radiance;
uniform float earthshine;
// Lunar eclipse: the earth's umbra, in units of the moon's radius.
uniform float umbra;
uniform vec2 umbraCenter;
uniform float umbraRadius;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  float r2 = dot(vUv, vUv);
  float edge = fwidth(sqrt(r2)) * 1.5;
  float coverage = 1.0 - smoothstep(1.0 - edge, 1.0, sqrt(r2));
  if (coverage <= 0.0) discard;
  vec3 n = vec3(vUv, sqrt(max(0.0, 1.0 - r2)));

  // Maria: large dark patches.
  float maria = noise(vUv * 2.2 + 3.0) * 0.6 + noise(vUv * 5.0 + 7.0) * 0.4;
  float albedo = mix(1.0, 0.62, smoothstep(0.45, 0.7, maria));

  float lit = max(dot(n, sunDirectionLocal), 0.0);
  // Faint earthshine on the dark side.
  vec3 color = radiance * albedo * (lit + earthshine);
  if (umbra > 0.5) {
    // The penumbra dims the side nearest the umbra; inside it, only sunlight
    // bent through the earth's atmosphere (all its sunsets) lights the moon,
    // copper-red and brighter toward the edge of the shadow.
    float d = length(vUv - umbraCenter);
    float penumbra = smoothstep(umbraRadius + 1.0, umbraRadius, d);
    float inside = smoothstep(umbraRadius + 0.05, umbraRadius - 0.05, d);
    vec3 copper = vec3(1.0, 0.3, 0.1) * 0.0008 * (0.5 + 1.5 * smoothstep(umbraRadius - 1.2, umbraRadius, d));
    color = mix(color * (1.0 - 0.6 * penumbra), radiance * albedo * copper, inside);
  }
  gl_FragColor = vec4(color * coverage, coverage);
}
`

export function createMoon(): Mesh<PlaneGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      sunDirectionLocal: { value: new Vector3(0, 0, 1) },
      radiance: { value: new Color(1, 1, 1) },
      earthshine: { value: 0.002 },
      umbra: { value: 0 },
      umbraCenter: { value: new Vector2() },
      umbraRadius: { value: 1 }
    },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false
  })
  const mesh = new Mesh(new PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  return mesh
}

/** Place the disc at `distance` along `direction` from `eye`, facing the eye,
 * with the given angular radius. Updates the phase lighting. */
export function placeMoon(
  moon: Mesh<PlaneGeometry, ShaderMaterial>,
  eye: Vector3,
  direction: Vector3,
  angularRadius: number,
  sunDirection: Vector3,
  distance = 150_000
): void {
  moon.position.copy(eye).addScaledVector(direction, distance)
  moon.lookAt(eye)
  moon.scale.setScalar(distance * Math.tan(angularRadius))
  moon.updateMatrixWorld()
  // Sun direction in the disc's local frame (+Z faces the viewer).
  const local = sunDirection.clone().transformDirection(moon.matrixWorld.clone().invert())
  moon.material.uniforms.sunDirectionLocal.value.copy(local)
}
