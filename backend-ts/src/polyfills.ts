/**
 * Polyfills for Node.js environment
 * Required for libraries like pdf-parse that expect browser APIs
 */

// DOMMatrix polyfill for pdf-parse/pdfjs-dist
if (!('DOMMatrix' in globalThis)) {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;

    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        this.m11 = this.a; this.m12 = this.b;
        this.m21 = this.c; this.m22 = this.d;
        this.m41 = this.e; this.m42 = this.f;
      }
    }

    static fromMatrix(other?: DOMMatrixPolyfill) {
      return new DOMMatrixPolyfill();
    }

    static fromFloat32Array(array: Float32Array) {
      return new DOMMatrixPolyfill();
    }

    static fromFloat64Array(array: Float64Array) {
      return new DOMMatrixPolyfill();
    }

    multiply() { return new DOMMatrixPolyfill(); }
    translate() { return new DOMMatrixPolyfill(); }
    scale() { return new DOMMatrixPolyfill(); }
    rotate() { return new DOMMatrixPolyfill(); }
    inverse() { return new DOMMatrixPolyfill(); }
    transformPoint(point: any) { return point; }
  }

  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}

// Path2D polyfill
if (!('Path2D' in globalThis)) {
  class Path2DPolyfill {
    constructor(_path?: string | Path2DPolyfill) {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  }
  (globalThis as any).Path2D = Path2DPolyfill;
}

// ImageData polyfill
if (!('ImageData' in globalThis)) {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: string = 'srgb';

    constructor(width: number, height: number);
    constructor(data: Uint8ClampedArray, width: number, height?: number);
    constructor(arg1: number | Uint8ClampedArray, arg2: number, arg3?: number) {
      if (arg1 instanceof Uint8ClampedArray) {
        this.data = arg1;
        this.width = arg2;
        this.height = arg3 || (arg1.length / (arg2 * 4));
      } else {
        this.width = arg1;
        this.height = arg2;
        this.data = new Uint8ClampedArray(arg1 * arg2 * 4);
      }
    }
  }
  (globalThis as any).ImageData = ImageDataPolyfill;
}

export {};
