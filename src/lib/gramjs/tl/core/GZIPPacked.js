const { serializeBytes } = require('../index');
const { inflate } = require('pako/dist/pako_inflate');

//CONTEST const { deflate } = require('pako/dist/pako_deflate')

class GZIPPacked {
    static CONSTRUCTOR_ID = 0x3072cfa1;
    static classType = 'constructor';

    constructor(data) {
        this.data = data;
        this.CONSTRUCTOR_ID = 0x3072cfa1;
        this.classType = 'constructor';
    }

    static async gzipIfSmaller(contentRelated, data) {
        if (contentRelated && data.length > 512) {
            const gzipped = await (new GZIPPacked(data)).toBytes();
            if (gzipped.length < data.length) {
                return gzipped;
            }
        }
        return data;
    }

    static gzip(input) {
        return Buffer.from(input);
        // TODO this usually makes it faster for large requests
        //return Buffer.from(deflate(input, { level: 9, gzip: true }))
    }

    static ungzip(input) {
        return Buffer.from(inflate(input));
    }

    static async read(reader) {
        const constructor = reader.readInt(false);
        if (constructor !== GZIPPacked.CONSTRUCTOR_ID) {
            throw new Error('not equal');
        }
        return await GZIPPacked.gzip(reader.tgReadBytes());
    }

    static async fromReader(reader) {
        return new GZIPPacked(await GZIPPacked.ungzip(reader.tgReadBytes()));
    }

    async toBytes() {
        const g = Buffer.alloc(4);
        g.writeUInt32LE(GZIPPacked.CONSTRUCTOR_ID, 0);
        return Buffer.concat([
            g,
            serializeBytes(await GZIPPacked.gzip(this.data)),
        ]);
    }
}

module.exports = GZIPPacked;
