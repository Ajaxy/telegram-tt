import Api from '../tl/api';
import TelegramClient from './TelegramClient';
import utils from '../Utils';
import { sleep } from '../Helpers';
import { computeCheck as computePasswordSrpCheck } from '../Password';

export interface UserAuthParams {
    phoneNumber: string | (() => Promise<string>);
    phoneCode: (isCodeViaApp?: boolean) => Promise<string>;
    password: (hint?: string) => Promise<string>;
    firstAndLastNames: () => Promise<[string, string?]>;
    qrCode: (qrCode: { token: Buffer; expires: number }) => Promise<void>;
    onError: (err: Error) => void;
    forceSMS?: boolean;
    initialMethod?: 'phoneNumber' | 'qrCode';
    shouldThrowIfUnauthorized?: boolean;
}

export interface BotAuthParams {
    botAuthToken: string;
}

interface ApiCredentials {
    apiId: number;
    apiHash: string;
}

const DEFAULT_INITIAL_METHOD = 'phoneNumber';
const QR_CODE_TIMEOUT = 30000;

export async function authFlow(
    client: TelegramClient,
    apiCredentials: ApiCredentials,
    authParams: UserAuthParams | BotAuthParams,
) {
    let me: Api.TypeUser;

    if ('botAuthToken' in authParams) {
        me = await signInBot(client, apiCredentials, authParams);
    } else {
        const { initialMethod = DEFAULT_INITIAL_METHOD } = authParams;

        if (initialMethod === 'phoneNumber') {
            me = await signInUser(client, apiCredentials, authParams);
        } else {
            me = await signInUserWithQrCode(client, apiCredentials, authParams);
        }
    }

    client._log.info('Signed in successfully as', utils.getDisplayName(me));
}

export async function checkAuthorization(client: TelegramClient, shouldThrow = false) {
    try {
        await client.invoke(new Api.updates.GetState());
        return true;
    } catch (e: any) {
        if (e.message === 'Disconnect' || shouldThrow) throw e;
        return false;
    }
}

async function signInUser(
    client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
): Promise<Api.TypeUser> {
    let phoneNumber;
    let phoneCodeHash;
    let isCodeViaApp = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            if (typeof authParams.phoneNumber === 'function') {
                try {
                    phoneNumber = await authParams.phoneNumber();
                } catch (err: any) {
                    if (err.message === 'RESTART_AUTH_WITH_QR') {
                        return signInUserWithQrCode(client, apiCredentials, authParams);
                    }

                    throw err;
                }
            } else {
                phoneNumber = authParams.phoneNumber;
            }
            const sendCodeResult = await sendCode(client, apiCredentials, phoneNumber, authParams.forceSMS);
            phoneCodeHash = sendCodeResult.phoneCodeHash;
            isCodeViaApp = sendCodeResult.isCodeViaApp;

            if (typeof phoneCodeHash !== 'string') {
                throw new Error('Failed to retrieve phone code hash');
            }

            break;
        } catch (err: any) {
            if (typeof authParams.phoneNumber !== 'function') {
                throw err;
            }

            authParams.onError(err);
        }
    }

    let phoneCode;
    let isRegistrationRequired = false;
    let termsOfService;

    // eslint-disable-next-line no-constant-condition
    while (1) {
        try {
            try {
                phoneCode = await authParams.phoneCode(isCodeViaApp);
            } catch (err: any) {
                // This is the support for changing phone number from the phone code screen.
                if (err.message === 'RESTART_AUTH') {
                    return signInUser(client, apiCredentials, authParams);
                }
            }

            if (!phoneCode) {
                throw new Error('Code is empty');
            }

            // May raise PhoneCodeEmptyError, PhoneCodeExpiredError,
            // PhoneCodeHashEmptyError or PhoneCodeInvalidError.
            const result = await client.invoke(new Api.auth.SignIn({
                phoneNumber,
                phoneCodeHash,
                phoneCode,
            }));

            if (result instanceof Api.auth.AuthorizationSignUpRequired) {
                isRegistrationRequired = true;
                termsOfService = result.termsOfService;
                break;
            }

            return result.user;
        } catch (err: any) {
            if (err.message === 'SESSION_PASSWORD_NEEDED') {
                return signInWithPassword(client, apiCredentials, authParams);
            } else {
                authParams.onError(err);
            }
        }
    }

    if (isRegistrationRequired) {
        // eslint-disable-next-line no-constant-condition
        while (1) {
            try {
                const [firstName, lastName] = await authParams.firstAndLastNames();
                if (!firstName) {
                    throw new Error('First name is required');
                }

                const { user } = await client.invoke(new Api.auth.SignUp({
                    phoneNumber,
                    phoneCodeHash,
                    firstName,
                    lastName,
                })) as Api.auth.Authorization;

                if (termsOfService) {
                    // This is a violation of Telegram rules: the user should be presented with and accept TOS.
                    await client.invoke(new Api.help.AcceptTermsOfService({ id: termsOfService.id }));
                }

                return user;
            } catch (err: any) {
                authParams.onError(err);
            }
        }
    }

    authParams.onError(new Error('Auth failed'));
    return signInUser(client, apiCredentials, authParams);
}

async function signInUserWithQrCode(
    client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
): Promise<Api.TypeUser> {
    let isScanningComplete = false;

    const inputPromise = (async () => {
        // eslint-disable-next-line no-constant-condition
        while (1) {
            if (isScanningComplete) {
                break;
            }

            const result = await client.invoke(new Api.auth.ExportLoginToken({
                apiId: Number(process.env.TELEGRAM_T_API_ID),
                apiHash: process.env.TELEGRAM_T_API_HASH,
                exceptIds: [],
            }));
            if (!(result instanceof Api.auth.LoginToken)) {
                throw new Error('Unexpected');
            }

            const { token, expires } = result;

            await Promise.race([
                authParams.qrCode({ token, expires }),
                sleep(QR_CODE_TIMEOUT),
            ]);
        }
    })();

    const updatePromise = new Promise<void>((resolve) => {
        client.addEventHandler((update: Api.TypeUpdate) => {
            if (update instanceof Api.UpdateLoginToken) {
                resolve();
            }
        }, { build: (update: object) => update });
    });

    try {
        // Either we receive an update that QR is successfully scanned,
        // or we receive a rejection caused by user going back to the regular auth form
        await Promise.race([updatePromise, inputPromise]);
    } catch (err: any) {
        if (err.message === 'RESTART_AUTH') {
            return await signInUser(client, apiCredentials, authParams);
        }

        throw err;
    } finally {
        isScanningComplete = true;
    }

    try {
        const result2 = await client.invoke(new Api.auth.ExportLoginToken({
            apiId: Number(process.env.TELEGRAM_T_API_ID),
            apiHash: process.env.TELEGRAM_T_API_HASH,
            exceptIds: [],
        }));

        if (result2 instanceof Api.auth.LoginTokenSuccess && result2.authorization instanceof Api.auth.Authorization) {
            return result2.authorization.user;
        } else if (result2 instanceof Api.auth.LoginTokenMigrateTo) {
            await client._switchDC(result2.dcId);
            const migratedResult = await client.invoke(new Api.auth.ImportLoginToken({
                token: result2.token,
            }));

            if (migratedResult instanceof Api.auth.LoginTokenSuccess
                && migratedResult.authorization instanceof Api.auth.Authorization) {
                return migratedResult.authorization.user;
            }
        }
    } catch (err: any) {
        if (err.message === 'SESSION_PASSWORD_NEEDED') {
            return signInWithPassword(client, apiCredentials, authParams);
        }

        throw err;
    }

    // This is a workaround for TypeScript (never actually reached)
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw undefined;
}

async function sendCode(
    client: TelegramClient, apiCredentials: ApiCredentials, phoneNumber: string, forceSMS = false,
): Promise<{
        phoneCodeHash: string;
        isCodeViaApp: boolean;
    }> {
    try {
        const { apiId, apiHash } = apiCredentials;
        const sendResult = await client.invoke(new Api.auth.SendCode({
            phoneNumber,
            apiId,
            apiHash,
            settings: new Api.CodeSettings(),
        }));

        // If we already sent a SMS, do not resend the phoneCode (hash may be empty)
        if (!forceSMS || (sendResult.type instanceof Api.auth.SentCodeTypeSms)) {
            return {
                phoneCodeHash: sendResult.phoneCodeHash,
                isCodeViaApp: sendResult.type instanceof Api.auth.SentCodeTypeApp,
            };
        }

        const resendResult = await client.invoke(new Api.auth.ResendCode({
            phoneNumber,
            phoneCodeHash: sendResult.phoneCodeHash,
        }));

        return {
            phoneCodeHash: resendResult.phoneCodeHash,
            isCodeViaApp: resendResult.type instanceof Api.auth.SentCodeTypeApp,
        };
    } catch (err: any) {
        if (err.message === 'AUTH_RESTART') {
            return sendCode(client, apiCredentials, phoneNumber, forceSMS);
        } else {
            throw err;
        }
    }
}

async function signInWithPassword(
    client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
): Promise<Api.TypeUser> {
    // eslint-disable-next-line no-constant-condition
    while (1) {
        try {
            const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
            const password = await authParams.password(passwordSrpResult.hint);
            if (!password) {
                throw new Error('Password is empty');
            }

            const passwordSrpCheck = await computePasswordSrpCheck(passwordSrpResult, password);
            const { user } = await client.invoke(new Api.auth.CheckPassword({
                password: passwordSrpCheck,
            })) as Api.auth.Authorization;

            return user;
        } catch (err: any) {
            authParams.onError(err);
        }
    }

    // eslint-disable-next-line no-unreachable
    return undefined!; // Never reached (TypeScript fix)
}

async function signInBot(client: TelegramClient, apiCredentials: ApiCredentials, authParams: BotAuthParams) {
    const { apiId, apiHash } = apiCredentials;
    const { botAuthToken } = authParams;

    const { user } = await client.invoke(new Api.auth.ImportBotAuthorization({
        apiId,
        apiHash,
        botAuthToken,
    })) as Api.auth.Authorization;

    return user;
}
