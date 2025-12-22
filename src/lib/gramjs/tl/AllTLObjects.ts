import { Api } from '.';

const tlobjects: Record<number, any> = {};

for (const tl of Object.values(Api)) {
    if ('CONSTRUCTOR_ID' in tl) {
        tlobjects[tl.CONSTRUCTOR_ID] = tl;
    } else {
        for (const sub of Object.values(tl)) {
            tlobjects[sub.CONSTRUCTOR_ID] = sub;
        }
    }
}

export const LAYER = 220;

export { tlobjects };
