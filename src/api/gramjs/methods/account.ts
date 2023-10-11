import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiPeer, ApiPhoto, ApiReportReason,
} from '../../types';

import { buildInputPeer, buildInputPhoto, buildInputReportReason } from '../gramjsBuilders';
import { invokeRequest } from './client';

export async function reportPeer({
  peer,
  reason,
  description,
}: {
  peer: ApiPeer; reason: ApiReportReason; description?: string;
}) {
  const result = await invokeRequest(new GramJs.account.ReportPeer({
    peer: buildInputPeer(peer.id, peer.accessHash),
    reason: buildInputReportReason(reason),
    message: description,
  }));

  return result;
}

export async function reportProfilePhoto({
  peer,
  photo,
  reason,
  description,
}: {
  peer: ApiPeer; photo: ApiPhoto; reason: ApiReportReason; description?: string;
}) {
  const photoId = buildInputPhoto(photo);
  if (!photoId) return undefined;

  const result = await invokeRequest(new GramJs.account.ReportProfilePhoto({
    peer: buildInputPeer(peer.id, peer.accessHash),
    photoId,
    reason: buildInputReportReason(reason),
    message: description,
  }));

  return result;
}

export async function changeSessionSettings({
  hash, areCallsEnabled, areSecretChatsEnabled, isConfirmed,
}: {
  hash: string; areCallsEnabled?: boolean; areSecretChatsEnabled?: boolean; isConfirmed?: boolean;
}) {
  const result = await invokeRequest(new GramJs.account.ChangeAuthorizationSettings({
    hash: BigInt(hash),
    ...(areCallsEnabled !== undefined ? { callRequestsDisabled: !areCallsEnabled } : undefined),
    ...(areSecretChatsEnabled !== undefined ? { encryptedRequestsDisabled: !areSecretChatsEnabled } : undefined),
    ...(isConfirmed && { confirmed: isConfirmed }),
  }));

  return result;
}

export async function changeSessionTtl({
  days,
}: {
  days: number;
}) {
  const result = await invokeRequest(new GramJs.account.SetAuthorizationTTL({
    authorizationTtlDays: days,
  }));

  return result;
}
