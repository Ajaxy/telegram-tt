import type { ApiPasskeyOption } from '../../../api/types';
import type TelegramClient from './TelegramClient';
import type { Update } from './TelegramClient';

import { DEBUG } from '../../../config';
import { base64UrlToString } from '../../../util/encoding/base64';
import { tryParseBigInt } from '../../../util/numbers';
import { getServerTime } from '../../../util/serverTime';
import { DEFAULT_PRIMITIVES } from '../../../api/gramjs/gramjsBuilders';
import { buildInputPasskeyCredential } from '../../../api/gramjs/gramjsBuilders/passkeys';
import {
  PasskeyCredentialNotFoundError, PasskeyLoginRequestedError, RPCError, UserAlreadyAuthorizedError,
} from '../errors';
import Api from '../tl/api';

import { sleep } from '../Helpers';
import { computeCheck as computePasswordSrpCheck } from '../Password';
import { getDisplayName } from '../Utils';

export interface UserAuthParams {
  phoneNumber: string | (() => Promise<string>);
  webAuthTokenFailed: () => void;
  onPasskeyOption: (passkeyOption: ApiPasskeyOption) => void;
  phoneCode: (isCodeViaApp?: boolean) => Promise<string>;
  password: (hint?: string, noReset?: boolean) => Promise<string>;
  firstAndLastNames: () => Promise<[string, string?]>;
  qrCode: (qrCode: { token: Buffer; expires: number }) => Promise<void>;
  onError: (err: Error) => void;
  forceSMS?: boolean;
  initialMethod?: 'phoneNumber' | 'qrCode';
  shouldThrowIfUnauthorized?: boolean;
  webAuthToken?: string;
  accountIds?: string[];
  hasPasskeySupport?: boolean;
  mockScenario?: string;
}

export interface BotAuthParams {
  botAuthToken: string;
}

interface ApiCredentials {
  apiId: number;
  apiHash: string;
}

type AuthMethod = 'phoneNumber' | 'qrCode';
const DEFAULT_INITIAL_METHOD: AuthMethod = 'phoneNumber';
let lastUsedMethod: AuthMethod = DEFAULT_INITIAL_METHOD;

export async function authFlow(
  client: TelegramClient,
  apiCredentials: ApiCredentials,
  authParams: UserAuthParams | BotAuthParams,
) {
  let me: Api.TypeUser;

  if ('botAuthToken' in authParams) {
    me = await signInBot(client, apiCredentials, authParams);
  } else if ('webAuthToken' in authParams && authParams.webAuthToken) {
    me = await signInUserWithWebToken(client, apiCredentials, authParams);
  } else {
    me = await signInUserWithPreferredMethod(client, apiCredentials, authParams);
  }

  client._log.info(`Signed in successfully as ${getDisplayName(me)}`);
}

export function signInUserWithPreferredMethod(
  client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
): Promise<Api.TypeUser> {
  const { initialMethod = DEFAULT_INITIAL_METHOD } = authParams;

  refreshPasskeyLoginOption(client, apiCredentials, authParams);

  if (initialMethod === 'phoneNumber') {
    return signInUser(client, apiCredentials, authParams);
  } else {
    return signInUserWithQrCode(client, apiCredentials, authParams);
  }
}

function refreshPasskeyLoginOption(
  client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
) {
  if (!authParams.hasPasskeySupport) return;
  obtainPasskeyLoginOption(client, apiCredentials).then((passkeyOption) => {
    if (passkeyOption) {
      authParams.onPasskeyOption(passkeyOption);
    }
  }).catch((err: unknown) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Failed to obtain passkey login option:', err);
    }
  });
}

export async function checkAuthorization(client: TelegramClient, shouldThrow = false) {
  try {
    await client.invoke(new Api.updates.GetState());
    return true;
  } catch (err: unknown) {
    if ((err instanceof Error && err.message === 'Disconnect') || shouldThrow) throw err;
    return false;
  }
}

async function signInUserWithWebToken(
  client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
): Promise<Api.TypeUser> {
  try {
    const { apiId, apiHash } = apiCredentials;
    const sendResult = await client.invoke(new Api.auth.ImportWebTokenAuthorization({
      webAuthToken: authParams.webAuthToken!,
      apiId,
      apiHash,
    }));

    if (sendResult instanceof Api.auth.Authorization) {
      return sendResult.user;
    } else {
      throw new Error('SIGN_UP_REQUIRED');
    }
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return signInWithPassword(client, apiCredentials, authParams, true);
    } else {
      client._log.error(`Failed to login with web token: ${String(err)}`);
      authParams.webAuthTokenFailed();
      return signInUserWithPreferredMethod(client, apiCredentials, {
        ...authParams,
        webAuthToken: undefined,
      });
    }
  }
}

async function signInUser(
  client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams,
): Promise<Api.TypeUser> {
  let phoneNumber;
  let phoneCodeHash;
  let isCodeViaApp = false;
  lastUsedMethod = 'phoneNumber';

  while (true) {
    try {
      if (typeof authParams.phoneNumber === 'function') {
        try {
          phoneNumber = await authParams.phoneNumber();
        } catch (err: unknown) {
          if (err instanceof Error && err.message === 'RESTART_AUTH_WITH_QR') {
            return await signInUserWithQrCode(client, apiCredentials, authParams);
          }

          if (err instanceof PasskeyLoginRequestedError) {
            return await signInUserWithPasskey(client, apiCredentials, authParams, err.credentialJson);
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
      } catch (err: unknown) {
        // This is the support for changing phone number from the phone code screen.
        if (err instanceof Error && err.message === 'RESTART_AUTH') {
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
    } catch (err: unknown) {
      if (err instanceof RPCError && err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        return signInWithPassword(client, apiCredentials, authParams);
      } else if (err instanceof Error) {
        authParams.onError(err);
      } else {
        // eslint-disable-next-line no-console
        console.warn('Unexpected error:', err);
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
          lastName: lastName || DEFAULT_PRIMITIVES.STRING,
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

  const { apiId, apiHash } = apiCredentials;
  const exceptIds = authParams.accountIds?.map((id) => tryParseBigInt(id)).filter(Boolean) || [];

  lastUsedMethod = 'qrCode';

  const inputPromise = (async () => {
    // eslint-disable-next-line no-constant-condition
    while (1) {
      if (isScanningComplete) {
        break;
      }

      const result = await client.invoke(new Api.auth.ExportLoginToken({
        apiId,
        apiHash,
        exceptIds,
      }));
      if (!(result instanceof Api.auth.LoginToken)) {
        throw new Error('Unexpected');
      }

      const { token, expires } = result;

      await Promise.race([
        authParams.qrCode({ token, expires }),
        sleep((expires - getServerTime()) * 1000),
      ]);
    }
  })();

  const updatePromise = new Promise<void>((resolve) => {
    client.addEventHandler((update: Api.TypeUpdate) => {
      if (update instanceof Api.UpdateLoginToken) {
        resolve();
      }
    }, { build: (update: Update) => update });
  });

  try {
    // Either we receive an update that QR is successfully scanned,
    // or we receive a rejection caused by user going back to the regular auth form
    await Promise.race([updatePromise, inputPromise]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'RESTART_AUTH') {
      return await signInUser(client, apiCredentials, authParams);
    }

    if (err instanceof PasskeyLoginRequestedError) {
      return await signInUserWithPasskey(client, apiCredentials, authParams, err.credentialJson);
    }

    throw err;
  } finally {
    isScanningComplete = true;
  }

  try {
    const result2 = await client.invoke(new Api.auth.ExportLoginToken({
      apiId,
      apiHash,
      exceptIds,
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
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return signInWithPassword(client, apiCredentials, authParams);
    }

    throw err;
  }

  // This is a workaround for TypeScript (never actually reached)
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw undefined;
}

export async function obtainPasskeyLoginOption(
  client: TelegramClient, apiCredentials: ApiCredentials,
): Promise<ApiPasskeyOption | undefined> {
  const { apiId, apiHash } = apiCredentials;
  const passkeyLoginOptions = await client.invoke(new Api.auth.InitPasskeyLogin({
    apiId,
    apiHash,
  }));

  if (!passkeyLoginOptions) return undefined;

  try {
    return JSON.parse(passkeyLoginOptions.options.data) as ApiPasskeyOption;
  } catch (err: unknown) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Failed to parse passkey login options:', err);
    }
  }
  return undefined;
}

export async function signInUserWithPasskey(
  client: TelegramClient,
  apiCredentials: ApiCredentials,
  authParams: UserAuthParams,
  credentialJson: PublicKeyCredentialJSON,
): Promise<Api.TypeUser> {
  try {
    if (!credentialJson.response.userHandle) {
      throw new Error('User handle is empty');
    }

    const userHandle = base64UrlToString(credentialJson.response.userHandle);
    const [userDcIdStr, userId] = userHandle.split(':');
    if (!userDcIdStr || !userId || isNaN(Number(userDcIdStr))) {
      throw new Error('Unexpected user handle format');
    }

    const userDcId = Number(userDcIdStr);
    if (authParams.accountIds?.includes(userId)) {
      throw new UserAlreadyAuthorizedError(userId);
    }

    const fromDcId = client.session.dcId;
    const unsignedFromAuthKeyId = client.session.getAuthKey(fromDcId).keyId; // Auth key id bytes are stored as unsigned 64-bit integer, long is signed
    const signedFromAuthKeyId = unsignedFromAuthKeyId ? BigInt.asIntN(64, unsignedFromAuthKeyId) : undefined;

    const isSwitchingDc = fromDcId !== userDcId;
    if (isSwitchingDc) {
      await client._switchDC(userDcId);
    }

    const result = await client.invoke(new Api.auth.FinishPasskeyLogin({
      credential: buildInputPasskeyCredential(credentialJson),
      fromDcId: isSwitchingDc ? fromDcId : undefined,
      fromAuthKeyId: isSwitchingDc ? signedFromAuthKeyId : undefined,
    }));

    if (result instanceof Api.auth.Authorization) {
      return result.user;
    }

    throw new Error('Unexpected sign up in passkey login');
  } catch (err: unknown) {
    // We cannot call finishPasskeyLogin again with the same challenge
    refreshPasskeyLoginOption(client, apiCredentials, authParams);

    const isPasskeyUnknownError = err instanceof PasskeyCredentialNotFoundError;

    if (isPasskeyUnknownError) {
      authParams.onError(err);
    }

    if (err instanceof Error) {
      if (err.message === 'RESTART_AUTH' || (isPasskeyUnknownError && lastUsedMethod === 'phoneNumber')) {
        return signInUser(client, apiCredentials, authParams);
      }

      if (err.message === 'RESTART_AUTH_WITH_QR' || (isPasskeyUnknownError && lastUsedMethod === 'qrCode')) {
        return signInUserWithQrCode(client, apiCredentials, authParams);
      }
    }

    if (err instanceof RPCError && err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return signInWithPassword(client, apiCredentials, authParams);
    }

    if (err instanceof Error) {
      authParams.onError(err);
    }

    throw err;
  }
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

    if (!(sendResult instanceof Api.auth.SentCode)) {
      throw Error('Unexpected SentCodeSuccess');
    }

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

    if (!(resendResult instanceof Api.auth.SentCode)) {
      throw Error('Unexpected SentCodeSuccess');
    }

    return {
      phoneCodeHash: resendResult.phoneCodeHash,
      isCodeViaApp: resendResult.type instanceof Api.auth.SentCodeTypeApp,
    };
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'AUTH_RESTART') {
      return sendCode(client, apiCredentials, phoneNumber, forceSMS);
    } else {
      throw err;
    }
  }
}

async function signInWithPassword(
  client: TelegramClient, apiCredentials: ApiCredentials, authParams: UserAuthParams, noReset = false,
): Promise<Api.TypeUser> {
  // eslint-disable-next-line no-constant-condition
  while (1) {
    try {
      const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
      const password = await authParams.password(passwordSrpResult.hint, noReset);
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
