import type {
    PasswordResult, TmpPasswordResult, TwoFaParams, TwoFaPasswordParams, updateTwoFaSettings,
} from './2fa';
import type { BotAuthParams, UserAuthParams } from './auth';
import type { downloadFile, DownloadFileParams } from './downloadFile';
import type { uploadFile, UploadFileParams } from './uploadFile';

import type { Api } from '..';

declare class TelegramClient {
    constructor(...args: any);

    async start(authParams: UserAuthParams | BotAuthParams);

    async invoke<R extends Api.AnyRequest>(
        request: R, dcId?: number, abortSignal?: AbortSignal, shouldRetryOnTimeout?: boolean,
    ): Promise<R['__response']>;

    async invokeBeacon<R extends Api.AnyRequest>(request: R, dcId?: number): void;

    async uploadFile(uploadParams: UploadFileParams): ReturnType<typeof uploadFile>;

    async downloadFile(uploadParams: DownloadFileParams): ReturnType<typeof downloadFile>;

    async updateTwoFaSettings(Params: TwoFaParams): ReturnType<typeof updateTwoFaSettings>;

    async getTmpPassword(currentPassword: string, ttl?: number): Promise<TmpPasswordResult>;

    async getCurrentPassword(Params: TwoFaPasswordParams): Promise<PasswordResult>;

    setPingCallback(callback: () => Promise<void>);

    setForceHttpTransport: (forceHttpTransport: boolean) => void;

    setAllowHttpTransport: (allowHttpTransport: boolean) => void;

    // Untyped methods.
    [prop: string]: any;
}

export default TelegramClient;
