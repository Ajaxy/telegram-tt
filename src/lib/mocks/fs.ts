// Mock for Node.js 'fs' module in browser environment
// Used to prevent Cloudflare Pages build errors

const mockFs = {
  readFile: (path: string, encoding: string, callback: Function) => {
    callback(new Error('fs.readFile is not available in browser environment'));
  },
  readFileSync: (path: string) => {
    throw new Error('fs.readFileSync is not available in browser environment');
  },
  writeFile: (path: string, data: unknown, callback: Function) => {
    callback(new Error('fs.writeFile is not available in browser environment'));
  },
  writeFileSync: (path: string, data: unknown) => {
    throw new Error('fs.writeFileSync is not available in browser environment');
  },
  stat: (path: string, callback: Function) => {
    callback(new Error('fs.stat is not available in browser environment'));
  },
  statSync: (path: string) => {
    throw new Error('fs.statSync is not available in browser environment');
  },
  existsSync: (path: string) => false,
  mkdirSync: (path: string) => {
    throw new Error('fs.mkdirSync is not available in browser environment');
  },
  readdirSync: (path: string) => [],
  rmSync: (path: string, options?: unknown) => {
    // No-op for cache cleanup
  },
};

export default mockFs;
export const readFile = mockFs.readFile;
export const readFileSync = mockFs.readFileSync;
export const writeFile = mockFs.writeFile;
export const writeFileSync = mockFs.writeFileSync;
export const stat = mockFs.stat;
export const statSync = mockFs.statSync;
export const existsSync = mockFs.existsSync;
export const mkdirSync = mockFs.mkdirSync;
export const readdirSync = mockFs.readdirSync;
export const rmSync = mockFs.rmSync;
