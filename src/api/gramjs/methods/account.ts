import {
  ApiChat, ApiPhoto, ApiReportReason, ApiUser,
} from '../../types';
import { invokeRequest } from './client';
import { Api as GramJs } from '../../../lib/gramjs';
import { buildInputPeer, buildInputReportReason, buildInputPhoto } from '../gramjsBuilders';

export async function reportPeer({
  peer,
  reason,
  description,
}: {
  peer: ApiChat | ApiUser; reason: ApiReportReason; description?: string;
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
  peer: ApiChat | ApiUser; photo: ApiPhoto; reason: ApiReportReason; description?: string;
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
