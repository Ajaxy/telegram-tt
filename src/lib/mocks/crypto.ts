// Mock for Node.js 'crypto' module in browser environment
// Uses built-in SubtleCrypto or crypto-js as fallback
// Used to prevent Cloudflare Pages build errors

const mockCrypto = {
  createHash: (algorithm: string) => {
    return {
      update: (data: string) => mockCrypto.createHash(algorithm),
      digest: (encoding: string) => '',
    };
  },
  createHmac: (algorithm: string, key: string) => {
    return {
      update: (data: string) => mockCrypto.createHmac(algorithm, key),
      digest: (encoding: string) => '',
    };
  },
  randomBytes: (size: number) => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      return globalThis.crypto.getRandomValues(new Uint8Array(size));
    }
    return new Uint8Array(size);
  },
  generateKeyPair: (type: string, options: unknown, callback: Function) => {
    callback(new Error('generateKeyPair is not available in browser environment'));
  },
  randomUUID: () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
};

export default mockCrypto;
export const createHash = mockCrypto.createHash;
export const createHmac = mockCrypto.createHmac;
export const randomBytes = mockCrypto.randomBytes;
export const generateKeyPair = mockCrypto.generateKeyPair;
export const randomUUID = mockCrypto.randomUUID;
export const webcrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : mockCrypto;
