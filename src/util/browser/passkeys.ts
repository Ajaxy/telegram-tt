import type { ApiPasskeyOption, ApiPasskeyRegistrationOption } from '../../api/types';

export function toCredentialCreationOptions(option: ApiPasskeyRegistrationOption): CredentialCreationOptions {
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(option.publicKey);

  return {
    publicKey,
  };
}

export function toCredentialRequestOptions(option: ApiPasskeyOption): CredentialRequestOptions {
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(option.publicKey);

  return {
    publicKey,
  };
}
