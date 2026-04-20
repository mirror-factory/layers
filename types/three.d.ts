declare module "three" {
  export class Scene {
    add(object: any): void;
    remove(object: any): void;
  }
  export class OrthographicCamera {
    constructor(left: number, right: number, top: number, bottom: number, near?: number, far?: number);
  }
  export class WebGLRenderer {
    constructor(params?: any);
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setPixelRatio(ratio: number): void;
    setClearColor(color: any, alpha?: number): void;
    render(scene: any, camera: any): void;
    dispose(): void;
    domElement: HTMLCanvasElement;
  }
  export class Color {
    constructor(color: string | number);
  }
  export class Mesh {
    constructor(geometry: any, material: any);
    geometry: any;
    material: any;
  }
  export class PlaneGeometry {
    constructor(width: number, height: number, widthSegments?: number, heightSegments?: number);
    dispose(): void;
  }
  export class BufferGeometry {
    constructor();
    setAttribute(name: string, attribute: any): void;
    dispose(): void;
  }
  export class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number, normalized?: boolean);
  }
  export class Float32BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number);
  }
  export class ShaderMaterial {
    constructor(params?: any);
    uniforms: Record<string, { value: any }>;
    dispose(): void;
  }
  export class RawShaderMaterial {
    constructor(params?: any);
    uniforms: Record<string, { value: any }>;
    dispose(): void;
  }
  export class Material {
    dispose(): void;
  }
  export const DoubleSide: number;
}
