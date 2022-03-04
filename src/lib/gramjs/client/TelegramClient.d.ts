import { Api } from '..';

import { BotAuthParams, UserAuthParams } from './auth';
import { uploadFile, UploadFileParams } from './uploadFile';
import { downloadFile, DownloadFileParams } from './downloadFile';
import { TwoFaParams, updateTwoFaSettings } from './2fa';

declare class TelegramClient {
    constructor(...args: any);

    async start(authParams: UserAuthParams | BotAuthParams);

    async invoke<R extends Api.AnyRequest>(request: R): Promise<R['__response']>;

    async uploadFile(uploadParams: UploadFileParams): ReturnType<typeof uploadFile>;

    async downloadFile(uploadParams: DownloadFileParams): ReturnType<typeof downloadFile>;

    async updateTwoFaSettings(Params: TwoFaParams): ReturnType<typeof updateTwoFaSettings>;

    // Untyped methods.
    [prop: string]: any;
}

export default TelegramClient;
