import type { AuthKey } from '../crypto/AuthKey';

export default abstract class Session {
    abstract setDC(dcId: number, serverAddress: string, port: number, isTestServer?: boolean): void;

    abstract get dcId(): number;

    abstract get serverAddress(): string;

    abstract get port(): number;

    abstract get isTestServer(): boolean | undefined;

    abstract getAuthKey(dcId?: number): AuthKey;

    abstract setAuthKey(authKey: AuthKey | undefined, dcId?: number): void;

    abstract save(): void;

    abstract load(): Promise<void>;

    abstract delete(): void;
}
