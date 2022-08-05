import type { Api } from '..';

import type { BotAuthParams, UserAuthParams } from './auth';
import type { uploadFile, UploadFileParams } from './uploadFile';
import type { downloadFile, DownloadFileParams } from './downloadFile';
import type { TwoFaParams, updateTwoFaSettings } from './2fa';

declare class TelegramClient {
    constructor(...args: any);

    async start(authParams: UserAuthParams | BotAuthParams);

    async invoke<R extends Api.AnyRequest>(request: R, dcId?: number): Promise<R['__response']>;

    async uploadFile(uploadParams: UploadFileParams): ReturnType<typeof uploadFile>;

    async downloadFile(uploadParams: DownloadFileParams): ReturnType<typeof downloadFile>;

    async updateTwoFaSettings(Params: TwoFaParams): ReturnType<typeof updateTwoFaSettings>;

    // Untyped methods.
    [prop: string]: any;
}

export default TelegramClient;
