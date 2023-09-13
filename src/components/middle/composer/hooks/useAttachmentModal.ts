import { useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiAttachment } from '../../../../api/types';

import {
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import buildAttachment from '../helpers/buildAttachment';

import useLastCallback from '../../../../hooks/useLastCallback';

export default function useAttachmentModal({
  attachments,
  fileSizeLimit,
  setHtml,
  setAttachments,
  chatId,
  canSendAudios,
  canSendVideos,
  canSendPhotos,
  canSendDocuments,
  insertNextText,
}: {
  attachments: ApiAttachment[];
  fileSizeLimit: number;
  setHtml: (html: string) => void;
  setAttachments: (attachments: ApiAttachment[]) => void;
  chatId: string;
  canSendAudios?: boolean;
  canSendVideos?: boolean;
  canSendPhotos?: boolean;
  canSendDocuments?: boolean;
  insertNextText: VoidFunction;
}) {
  const { openLimitReachedModal, showAllowedMessageTypesNotification } = getActions();
  const [shouldForceAsFile, setShouldForceAsFile] = useState<boolean>(false);
  const [shouldForceCompression, setShouldForceCompression] = useState<boolean>(false);
  const [shouldSuggestCompression, setShouldSuggestCompression] = useState<boolean | undefined>(undefined);

  const handleClearAttachments = useLastCallback(() => {
    setAttachments(MEMO_EMPTY_ARRAY);
    insertNextText();
  });

  const handleSetAttachments = useLastCallback(
    (newValue: ApiAttachment[] | ((current: ApiAttachment[]) => ApiAttachment[])) => {
      const newAttachments = typeof newValue === 'function' ? newValue(attachments) : newValue;
      if (!newAttachments.length) {
        handleClearAttachments();
        return;
      }

      if (newAttachments.some((attachment) => {
        const type = getAttachmentType(attachment);

        return (type === 'audio' && !canSendAudios && !canSendDocuments)
          || (type === 'video' && !canSendVideos && !canSendDocuments)
          || (type === 'image' && !canSendPhotos && !canSendDocuments)
          || (type === 'file' && !canSendDocuments);
      })) {
        showAllowedMessageTypesNotification({ chatId });
      } else if (newAttachments.some(({ size }) => size > fileSizeLimit)) {
        openLimitReachedModal({
          limit: 'uploadMaxFileparts',
        });
      } else {
        setAttachments(newAttachments);
        const shouldForce = newAttachments.some((attachment) => {
          const type = getAttachmentType(attachment);

          return (type === 'audio' && !canSendAudios)
            || (type === 'video' && !canSendVideos)
            || (type === 'image' && !canSendPhotos);
        });

        setShouldForceAsFile(Boolean(shouldForce && canSendDocuments));
        setShouldForceCompression(!canSendDocuments);
        setShouldSuggestCompression(undefined);
      }
    },
  );

  const handleAppendFiles = useLastCallback(async (files: File[], isSpoiler?: boolean) => {
    handleSetAttachments([
      ...attachments,
      ...await Promise.all(files.map((file) => (
        buildAttachment(file.name, file, { shouldSendAsSpoiler: isSpoiler || undefined })
      ))),
    ]);
  });

  const handleFileSelect = useLastCallback(async (files: File[], suggestCompression?: boolean) => {
    handleSetAttachments(await Promise.all(files.map((file) => buildAttachment(file.name, file))));
    setShouldSuggestCompression(suggestCompression);
  });

  return {
    shouldSuggestCompression,
    handleAppendFiles,
    handleFileSelect,
    onCaptionUpdate: setHtml,
    handleClearAttachments,
    handleSetAttachments,
    shouldForceCompression,
    shouldForceAsFile,
  };
}

function getAttachmentType(attachment: ApiAttachment) {
  if (attachment.shouldSendAsFile) return 'file';

  if (SUPPORTED_IMAGE_CONTENT_TYPES.has(attachment.mimeType)) {
    return 'image';
  }

  if (SUPPORTED_VIDEO_CONTENT_TYPES.has(attachment.mimeType)) {
    return 'video';
  }

  if (SUPPORTED_AUDIO_CONTENT_TYPES.has(attachment.mimeType)) {
    return 'audio';
  }

  return 'file';
}
