import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

const WASM_PATH = path.join(process.cwd(), 'src', 'lib', 'tlottie', 'tlottie.wasm');
const DEFAULT_SIZE = 320;
const AVIF_QUALITY = 60;
const AVIF_EFFORT = 9;
const RGBA_CHANNELS = 4;

// Raw wasm ABI, see `src/lib/tlottie/tlottie.worker.ts`
interface TLottieExports {
  memory: WebAssembly.Memory;
  tlottie_alloc: (len: number) => number;
  tlottie_new_with_options: (
    jsonPtr: number, jsonLen: number, fitzModifier: number, replacementsPtr: number, replacementsLength: number,
  ) => number;
  tlottie_render: (instance: number, frame: number, width: number, height: number, antialias: number) => number;
}

function parseArgs() {
  const [tgsPath, sizeArg] = process.argv.slice(2);
  const size = sizeArg === undefined ? DEFAULT_SIZE : Number(sizeArg);

  if (!tgsPath || !Number.isInteger(size) || size <= 0) {
    throw new Error('Usage: npm run tgs:avif -- <path/to/file.tgs> [size]');
  }

  return { tgsPath, size };
}

function getOutputPath(tgsPath: string) {
  const { dir, name } = path.parse(path.resolve(tgsPath));
  return path.join(dir.replace(/([\\/])tgs(?=[\\/]|$)/, '$1tgs-previews'), `${name}.avif`);
}

async function renderFirstFrame(tgsPath: string, size: number) {
  const { instance: { exports } } = await WebAssembly.instantiate(await fs.readFile(WASM_PATH), {});
  const tlottie = exports as unknown as TLottieExports;

  const animationData = gunzipSync(await fs.readFile(tgsPath));
  const jsonPtr = tlottie.tlottie_alloc(animationData.length);
  // Heap views must be re-derived after every exported call: memory growth detaches buffers
  new Uint8Array(tlottie.memory.buffer).set(animationData, jsonPtr);

  const instance = tlottie.tlottie_new_with_options(jsonPtr, animationData.length, 0, 0, 0);
  const pixelsPtr = instance && tlottie.tlottie_render(instance, 0, size, size, 1);
  if (!pixelsPtr) {
    throw new Error(`Failed to render ${tgsPath}`);
  }

  return Buffer.from(new Uint8Array(tlottie.memory.buffer, pixelsPtr, size * size * RGBA_CHANNELS));
}

async function main() {
  const { tgsPath, size } = parseArgs();
  const outputPath = getOutputPath(tgsPath);
  const pixels = await renderFirstFrame(tgsPath, size);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const { size: outputSize } = await sharp(pixels, { raw: { width: size, height: size, channels: RGBA_CHANNELS } })
    .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT, chromaSubsampling: '4:4:4' })
    .toFile(outputPath);

  // eslint-disable-next-line no-console
  console.log(`${path.relative(process.cwd(), outputPath)}: ${size}x${size}, ${outputSize} bytes`);
}

await main();
