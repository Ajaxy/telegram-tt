import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiEmojiStatusType, ApiPeer, ApiUser,
} from '../../types';

import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildApiPhoto } from '../apiBuilders/common';
import { buildApiPeerId } from '../apiBuilders/peers';
import { buildApiUser, buildApiUserFullInfo, buildApiUserStatuses } from '../apiBuilders/users';
import {
  buildInputContact,
  buildInputEmojiStatus,
  buildInputEntity,
  buildInputPeer,
  buildMtpPeerId,
  getEntityTypeById,
} from '../gramjsBuilders';
import { addPhotoToLocalDb, addUserToLocalDb } from '../helpers/localDb';
import localDb from '../localDb';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { invokeRequest } from './client';
import { searchMessagesInChat } from './messages';

export async function fetchFullUser({
  id,
  accessHash,
}: {
  id: string;
  accessHash?: string;
}) {
  const input = buildInputEntity(id, accessHash);
  if (!(input instanceof GramJs.InputUser)) {
    return undefined;
  }

  const result = await invokeRequest(new GramJs.users.GetFullUser({ id: input }));

  if (!result) {
    return undefined;
  }

  if (result.fullUser.profilePhoto) {
    addPhotoToLocalDb(result.fullUser.profilePhoto);
  }

  if (result.fullUser.personalPhoto) {
    addPhotoToLocalDb(result.fullUser.personalPhoto);
  }

  if (result.fullUser.fallbackPhoto) {
    addPhotoToLocalDb(result.fullUser.fallbackPhoto);
  }

  const botInfo = result.fullUser.botInfo;
  if (botInfo?.descriptionPhoto) {
    addPhotoToLocalDb(botInfo.descriptionPhoto);
  }
  if (botInfo?.descriptionDocument instanceof GramJs.Document) {
    localDb.documents[botInfo.descriptionDocument.id.toString()] = botInfo.descriptionDocument;
  }

  if (result.fullUser.businessIntro?.sticker instanceof GramJs.Document) {
    localDb.documents[result.fullUser.businessIntro.sticker.id.toString()] = result.fullUser.businessIntro.sticker;
  }

  const fullInfo = buildApiUserFullInfo(result);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  const user = users.find(({ id: userId }) => userId === id)!;

  sendApiUpdate({
    '@type': 'updateUser',
    id,
    user,
    fullInfo,
  });

  return {
    user,
    fullInfo,
    users,
    chats,
  };
}

export async function fetchCommonChats(user: ApiUser, maxId?: string) {
  const result = await invokeRequest(new GramJs.messages.GetCommonChats({
    userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
    maxId: maxId ? buildMtpPeerId(maxId, getEntityTypeById(maxId)) : undefined,
  }));

  if (!result) {
    return undefined;
  }

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const chatIds = chats.map(({ id: chatId }) => chatId);
  const count = 'count' in result ? result.count : chatIds.length;

  return { chatIds, count };
}

export async function fetchNearestCountry() {
  const dcInfo = await invokeRequest(new GramJs.help.GetNearestDc());

  return dcInfo?.country;
}

export async function fetchTopUsers() {
  const topPeers = await invokeRequest(new GramJs.contacts.GetTopPeers({
    correspondents: true,
  }));
  if (!(topPeers instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  const users = topPeers.users.map(buildApiUser).filter((user): user is ApiUser => Boolean(user) && !user.isSelf);
  const ids = users.map(({ id }) => id);

  return {
    ids,
  };
}

export async function fetchContactList() {
  const result = await invokeRequest(new GramJs.contacts.GetContacts({ hash: BigInt('0') }));
  if (!result || result instanceof GramJs.contacts.ContactsNotModified) {
    return undefined;
  }

  const users = result.users.map(buildApiUser).filter(Boolean) as ApiUser[];
  const userStatusesById = buildApiUserStatuses(result.users);

  return {
    users,
    userStatusesById,
  };
}

export async function fetchUsers({ users }: { users: ApiUser[] }) {
  const result = await invokeRequest(new GramJs.users.GetUsers({
    id: users.map(({ id, accessHash }) => buildInputPeer(id, accessHash)),
  }));
  if (!result || !result.length) {
    return undefined;
  }

  const apiUsers = result.map(buildApiUser).filter(Boolean) as ApiUser[];
  const userStatusesById = buildApiUserStatuses(result);

  return {
    users: apiUsers,
    userStatusesById,
  };
}

export async function importContact({
  phone,
  firstName,
  lastName,
}: {
  phone?: string;
  firstName?: string;
  lastName?: string;
}) {
  const result = await invokeRequest(new GramJs.contacts.ImportContacts({
    contacts: [buildInputContact({
      phone: phone || '',
      firstName: firstName || '',
      lastName: lastName || '',
    })],
  }));

  if (result instanceof GramJs.contacts.ImportedContacts && result.users.length) {
    addUserToLocalDb(result.users[0]);
  }

  return result?.imported.length ? buildApiPeerId(result.imported[0].userId, 'user') : undefined;
}

export function updateContact({
  id,
  accessHash,
  phoneNumber = '',
  firstName = '',
  lastName = '',
  shouldSharePhoneNumber = false,
}: {
  id: string;
  accessHash?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  shouldSharePhoneNumber?: boolean;
}) {
  return invokeRequest(new GramJs.contacts.AddContact({
    id: buildInputEntity(id, accessHash) as GramJs.InputUser,
    firstName,
    lastName,
    phone: phoneNumber,
    ...(shouldSharePhoneNumber && { addPhonePrivacyException: shouldSharePhoneNumber }),
  }), {
    shouldReturnTrue: true,
  });
}

export async function deleteContact({
  id,
  accessHash,
}: {
  id: string;
  accessHash?: string;
}) {
  const input = buildInputEntity(id, accessHash);
  if (!(input instanceof GramJs.InputUser)) {
    return;
  }

  const result = await invokeRequest(new GramJs.contacts.DeleteContacts({ id: [input] }));

  if (!result) {
    return;
  }

  sendApiUpdate({
    '@type': 'deleteContact',
    id,
  });
}

export async function fetchProfilePhotos({
  peer,
  offset = 0,
  limit = 0,
}: {
  peer: ApiPeer;
  offset?: number;
  limit?: number;
}) {
  const chat = 'title' in peer ? peer as ApiChat : undefined;
  const user = !chat ? peer as ApiUser : undefined;
  if (user) {
    const { id, accessHash } = user;

    const result = await invokeRequest(new GramJs.photos.GetUserPhotos({
      userId: buildInputEntity(id, accessHash) as GramJs.InputUser,
      limit,
      offset,
      maxId: BigInt('0'),
    }));

    if (!result) {
      return undefined;
    }

    result.photos.forEach(addPhotoToLocalDb);

    const count = result instanceof GramJs.photos.PhotosSlice ? result.count : result.photos.length;
    const proposedNextOffsetId = offset + result.photos.length;
    const nextOffsetId = proposedNextOffsetId < count ? proposedNextOffsetId : undefined;

    return {
      count,
      photos: result.photos
        .filter((photo): photo is GramJs.Photo => photo instanceof GramJs.Photo)
        .map((photo) => buildApiPhoto(photo)),
      nextOffsetId,
    };
  }

  if (chat?.isRestricted) return undefined;

  const result = await searchMessagesInChat({
    peer,
    type: 'profilePhoto',
    limit,
  });

  if (!result) {
    return undefined;
  }

  const {
    messages, totalCount, nextOffsetId,
  } = result;

  return {
    count: totalCount,
    photos: messages.map((message) => message.content.action!.photo).filter(Boolean),
    nextOffsetId,
  };
}

export function reportSpam(userOrChat: ApiPeer) {
  const { id, accessHash } = userOrChat;

  return invokeRequest(new GramJs.messages.ReportSpam({
    peer: buildInputPeer(id, accessHash),
  }), {
    shouldReturnTrue: true,
  });
}

export function updateEmojiStatus(emojiStatus: ApiEmojiStatusType) {
  return invokeRequest(new GramJs.account.UpdateEmojiStatus({
    emojiStatus: buildInputEmojiStatus(emojiStatus),
  }), {
    shouldReturnTrue: true,
  });
}

export function saveCloseFriends(userIds: string[]) {
  const id = userIds.map((userId) => buildMtpPeerId(userId, 'user'));

  return invokeRequest(new GramJs.contacts.EditCloseFriends({ id }), {
    shouldReturnTrue: true,
  });
}
