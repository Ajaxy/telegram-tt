import { Api as GramJs } from '../../../lib/gramjs';

import { base64UrlToBuffer, base64UrlToString } from '../../../util/encoding/base64';

export function buildInputPasskeyCredential(
  credentialJson: PublicKeyCredentialJSON,
): GramJs.TypeInputPasskeyCredential {
  let response: GramJs.TypeInputPasskeyResponse;
  const clientData = base64UrlToString(credentialJson.response.clientDataJSON);
  if (credentialJson.response.attestationObject) {
    response = new GramJs.InputPasskeyResponseRegister({
      clientData: new GramJs.DataJSON({ data: clientData }),
      attestationData: base64UrlToBuffer(credentialJson.response.attestationObject),
    });
  } else {
    const userHandle = base64UrlToString(credentialJson.response.userHandle);

    response = new GramJs.InputPasskeyResponseLogin({
      clientData: new GramJs.DataJSON({ data: clientData }),
      authenticatorData: base64UrlToBuffer(credentialJson.response.authenticatorData),
      signature: base64UrlToBuffer(credentialJson.response.signature),
      userHandle,
    });
  }

  return new GramJs.InputPasskeyCredentialPublicKey({
    id: credentialJson.id,
    rawId: credentialJson.rawId,
    response,
  });
}
