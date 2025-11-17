import type {
  ApiChat, ApiChatFullInfo, ApiPeerPhotos, ApiPhoto, ApiUser, ApiUserFullInfo,
} from '../../api/types';
import type { GlobalState } from '../types';

import { isUserId } from '../../util/entities/ids';
import { omit, uniqueByField } from '../../util/iteratees';
import { isChatChannel } from '../helpers';
import {
  selectChatFullInfo,
  selectPeer,
  selectPeerPhotos,
  selectUserFullInfo,
} from '../selectors';
import { updateChat, updateChatFullInfo } from './chats';
import { updateUser, updateUserFullInfo } from './users';

// `type` has different types in ApiChat and ApiUser
type ApiPeerSharedFields = Omit<CommonProperties<ApiChat, ApiUser>, 'type'>;
type ApiPeerFullInfoSharedFields = CommonProperties<ApiChatFullInfo, ApiUserFullInfo>;

export function updatePeer<T extends GlobalState>(
  global: T, peerId: string, peerUpdate: Partial<ApiPeerSharedFields>,
) {
  if (isUserId(peerId)) {
    return updateUser(global, peerId, peerUpdate);
  }

  return updateChat(global, peerId, peerUpdate);
}

export function updatePeerFullInfo<T extends GlobalState>(
  global: T, peerId: string, peerFullInfoUpdate: Partial<ApiPeerFullInfoSharedFields>,
) {
  if (isUserId(peerId)) {
    return updateUserFullInfo(global, peerId, peerFullInfoUpdate);
  }

  return updateChatFullInfo(global, peerId, peerFullInfoUpdate);
}

export function updatePeerPhotosIsLoading<T extends GlobalState>(
  global: T,
  peerId: string,
  isLoading: boolean,
) {
  const profilePhotos = selectPeerPhotos(global, peerId);
  if (!profilePhotos) {
    return global;
  }

  return replacePeerPhotos(global, peerId, {
    ...profilePhotos,
    isLoading,
  });
}

export function replacePeerPhotos<T extends GlobalState>(
  global: T,
  peerId: string,
  value?: ApiPeerPhotos,
) {
  if (!value) {
    return {
      ...global,
      peers: {
        ...global.peers,
        profilePhotosById: omit(global.peers.profilePhotosById, [peerId]),
      },
    };
  }

  return {
    ...global,
    peers: {
      ...global.peers,
      profilePhotosById: {
        ...global.peers.profilePhotosById,
        [peerId]: value,
      },
    },
  };
}

export function updatePeerPhotos<T extends GlobalState>(
  global: T,
  peerId: string,
  update: {
    newPhotos: ApiPhoto[];
    count: number;
    nextOffset?: number;
    fullInfo: ApiChatFullInfo | ApiUserFullInfo;
    shouldInvalidateCache?: boolean;
  },
) {
  const profilePhotos = selectPeerPhotos(global, peerId);

  const {
    newPhotos, count, nextOffset, fullInfo, shouldInvalidateCache,
  } = update;
  const currentPhotos = profilePhotos;
  const profilePhoto = fullInfo.profilePhoto;
  const fallbackPhoto = 'fallbackPhoto' in fullInfo ? fullInfo.fallbackPhoto : undefined;
  const personalPhoto = 'personalPhoto' in fullInfo ? fullInfo.personalPhoto : undefined;

  if (!currentPhotos || shouldInvalidateCache) {
    // In some channels, last service message with photo change is deleted, so we need to patch it in
    if (profilePhoto && profilePhoto.id !== newPhotos[0]?.id) {
      newPhotos.unshift(profilePhoto);
    }

    if (personalPhoto && personalPhoto.id !== newPhotos[0]?.id) {
      newPhotos.unshift(personalPhoto);
    }

    if (fallbackPhoto) {
      newPhotos.push(fallbackPhoto);
    }

    return replacePeerPhotos(global, peerId, {
      fallbackPhoto,
      personalPhoto,
      photos: newPhotos,
      count,
      nextOffset,
      isLoading: false,
    });
  }

  const hasFallbackPhoto = fallbackPhoto && currentPhotos.photos.at(-1)?.id === fallbackPhoto.id;
  const currentPhotoArray = hasFallbackPhoto ? currentPhotos.photos.slice(0, -1) : currentPhotos.photos;

  const photos = uniqueByField([...currentPhotoArray, ...newPhotos, fallbackPhoto].filter(Boolean), 'id');
  return replacePeerPhotos(global, peerId, {
    fallbackPhoto,
    personalPhoto,
    photos,
    count,
    nextOffset,
    isLoading: false,
  });
}

export function deletePeerPhoto<T extends GlobalState>(
  global: T,
  peerId: string,
  photoId: string,
  isFromActionMessage?: boolean,
) {
  const peer = selectPeer(global, peerId);
  const profilePhotos = selectPeerPhotos(global, peerId);
  if (!peer || !profilePhotos) {
    return global;
  }
  const isChannel = 'title' in peer && isChatChannel(peer);

  const userFullInfo = selectUserFullInfo(global, peerId);
  const chatFullInfo = selectChatFullInfo(global, peerId);

  const isAvatar = peer.avatarPhotoId === photoId && (!isChannel || isFromActionMessage);
  const nextAvatarPhoto = isAvatar ? profilePhotos.photos[1] : undefined;

  if (userFullInfo) {
    const newFallbackPhoto = userFullInfo.fallbackPhoto?.id === photoId ? undefined : userFullInfo.fallbackPhoto;
    const newPersonalPhoto = userFullInfo.personalPhoto?.id === photoId ? undefined : userFullInfo.personalPhoto;
    const newProfilePhoto = userFullInfo.profilePhoto?.id === photoId ? nextAvatarPhoto : userFullInfo.profilePhoto;
    global = updateUserFullInfo(global, peerId, {
      fallbackPhoto: newFallbackPhoto,
      personalPhoto: newPersonalPhoto,
      profilePhoto: newProfilePhoto,
    });
  }

  if (chatFullInfo) {
    const newProfilePhoto = chatFullInfo.profilePhoto?.id === photoId ? nextAvatarPhoto : chatFullInfo.profilePhoto;
    global = updateChatFullInfo(global, peerId, {
      profilePhoto: newProfilePhoto,
    });
  }

  const avatarPhotoId = isAvatar ? nextAvatarPhoto?.id : peer.avatarPhotoId;
  const shouldKeepInPhotos = isAvatar && 'title' in peer && isChatChannel(peer);
  const photos = shouldKeepInPhotos
    ? profilePhotos.photos.filter((photo) => photo.id !== photoId) : profilePhotos.photos.slice();

  global = updatePeer(global, peerId, {
    avatarPhotoId,
  });

  global = replacePeerPhotos(global, peerId, avatarPhotoId ? {
    ...profilePhotos,
    photos,
    count: profilePhotos.count - 1,
  } : undefined);

  return global;
}
