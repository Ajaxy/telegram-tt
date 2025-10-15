import { inflate } from 'pako/dist/pako_inflate';

import type { BinaryReader } from '../../extensions';

import { serializeBytes } from '..';

export default class GZIPPacked {
    static CONSTRUCTOR_ID = 0x3072cfa1;

    static classType = 'constructor';

    data: Buffer<ArrayBuffer>;

    private CONSTRUCTOR_ID: number;

    private classType: string;

    constructor(data: Buffer<ArrayBuffer>) {
        this.data = data;
        this.CONSTRUCTOR_ID = 0x3072cfa1;
        this.classType = 'constructor';
    }

    static async gzipIfSmaller(contentRelated: boolean, data: Buffer<ArrayBuffer>) {
        if (contentRelated && data.length > 512) {
            const gzipped = await new GZIPPacked(data).toBytes();
            if (gzipped.length < data.length) {
                return gzipped;
            }
        }
        return data;
    }

    static gzip(input: Buffer<ArrayBuffer>) {
        return Buffer.from(input);
        // TODO this usually makes it faster for large requests
        // return Buffer.from(deflate(input, { level: 9, gzip: true }))
    }

    static ungzip(input: Buffer) {
        return Buffer.from(inflate(input));
    }

    async toBytes() {
        const g = Buffer.alloc(4);
        g.writeUInt32LE(GZIPPacked.CONSTRUCTOR_ID, 0);
        return Buffer.concat([
            g,
            serializeBytes(await GZIPPacked.gzip(this.data)),
        ]);
    }

    static read(reader: BinaryReader) {
        const constructor = reader.readInt(false);
        if (constructor !== GZIPPacked.CONSTRUCTOR_ID) {
            throw new Error('not equal');
        }
        return GZIPPacked.gzip(reader.tgReadBytes());
    }

    static async fromReader(reader: BinaryReader) {
        const data = reader.tgReadBytes();
        return new GZIPPacked(await GZIPPacked.ungzip(data));
    }
}
