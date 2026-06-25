// Mock for Node.js 'path' module in browser environment
// Used to prevent Cloudflare Pages build errors

const mockPath = {
  resolve: (...args: string[]) => args.join('/'),
  join: (...args: string[]) => args.join('/'),
  dirname: (path: string) => {
    const parts = path.split('/');
    return parts.slice(0, -1).join('/');
  },
  basename: (path: string, ext?: string) => {
    const name = path.split('/').pop() || '';
    return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
  },
  extname: (path: string) => {
    const name = path.split('/').pop() || '';
    const dotIndex = name.lastIndexOf('.');
    return dotIndex > 0 ? name.slice(dotIndex) : '';
  },
  normalize: (path: string) => path.replace(/\/+/g, '/'),
  sep: '/',
  delimiter: ':',
};

export default mockPath;
export const resolve = mockPath.resolve;
export const join = mockPath.join;
export const dirname = mockPath.dirname;
export const basename = mockPath.basename;
export const extname = mockPath.extname;
export const normalize = mockPath.normalize;
export const sep = mockPath.sep;
export const delimiter = mockPath.delimiter;
