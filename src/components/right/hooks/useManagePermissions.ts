import type React from '../../../lib/teact/teact';
import { useCallback, useEffect, useState } from '../../../lib/teact/teact';

import type { ApiChatBannedRights } from '../../../api/types';

const FLOATING_BUTTON_ANIMATION_TIMEOUT_MS = 250;
const MEDIA_PERMISSIONS: Array<keyof ApiChatBannedRights> = [
  'embedLinks',
  'sendPolls',
  'sendPhotos',
  'sendVideos',
  'sendRoundvideos',
  'sendVoices',
  'sendAudios',
  'sendDocs',
  'sendStickers',
  'sendGifs',
];
const MESSAGE_PERMISSIONS: typeof MEDIA_PERMISSIONS = [...MEDIA_PERMISSIONS, 'sendPlain'];

export default function useManagePermissions(defaultPermissions: ApiChatBannedRights | undefined) {
  const [permissions, setPermissions] = useState<ApiChatBannedRights>({});
  const [havePermissionChanged, setHavePermissionChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPermissions(defaultPermissions || {});
    setHavePermissionChanged(false);
    setTimeout(() => {
      setIsLoading(false);
    }, FLOATING_BUTTON_ANIMATION_TIMEOUT_MS);
  }, [defaultPermissions]);

  const handlePermissionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name: targetName } = e.target;

    const name = targetName as Exclude<keyof ApiChatBannedRights, 'untilDate'>;

    function getUpdatedPermissionValue(value: true | undefined) {
      return value ? undefined : true;
    }

    const oldPermissions = permissions;

    let newPermissions: ApiChatBannedRights = {
      ...oldPermissions,
      [name]: getUpdatedPermissionValue(oldPermissions[name]),
      ...(name === 'sendStickers' && {
        sendGifs: getUpdatedPermissionValue(oldPermissions[name]),
      }),
    };

    const checkMedia = () => {
      const mediaPermissions = MEDIA_PERMISSIONS.map((key) => newPermissions[key]);
      if (mediaPermissions.some((v) => !v)) {
        newPermissions = {
          ...newPermissions,
          sendMedia: undefined,
        };
      } else if (mediaPermissions.every(Boolean)) {
        newPermissions = {
          ...newPermissions,
          sendMedia: true,
        };
      }
    };

    if (name !== 'sendMedia') {
      checkMedia();
    } else {
      newPermissions = {
        ...newPermissions,
        ...(MEDIA_PERMISSIONS.reduce((acc, key) => (
          Object.assign(acc, { [key]: newPermissions.sendMedia })
        ), {})),
      };
    }

    // Embed links can't be enabled if plain text is banned
    if (name !== 'embedLinks' && !newPermissions.embedLinks && newPermissions.sendPlain) {
      newPermissions = {
        ...newPermissions,
        embedLinks: true,
      };
    }

    if (name !== 'sendPlain' && !newPermissions.embedLinks && newPermissions.sendPlain) {
      newPermissions = {
        ...newPermissions,
        sendPlain: undefined,
      };
    }

    if (name !== 'sendMedia') {
      checkMedia();
    }

    const sendMessages = MESSAGE_PERMISSIONS.every((key) => newPermissions[key]);
    newPermissions = {
      ...newPermissions,
      sendMessages: sendMessages ? true : undefined,
    };

    setPermissions(newPermissions);

    setHavePermissionChanged(!defaultPermissions || Object.keys(newPermissions).some((k) => {
      const key = k as Exclude<keyof ApiChatBannedRights, 'untilDate'>;
      return Boolean(defaultPermissions[key]) !== Boolean(newPermissions[key]);
    }));
  }, [defaultPermissions, permissions]);

  const resetPermissions = useCallback(() => {
    setPermissions(defaultPermissions || {});
    setHavePermissionChanged(false);
  }, [defaultPermissions]);

  return {
    permissions,
    isLoading,
    havePermissionChanged,
    handlePermissionChange,
    setIsLoading,
    resetPermissions,
  };
}
