import { useEffect, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiAttachment, ApiMessage } from '../../../../api/types';

import { GIF_MIME_TYPE, SUPPORTED_PHOTO_CONTENT_TYPES } from '../../../../config';
import { canReplaceMessageMedia, getAttachmentMediaType } from '../../../../global/helpers';
import { revokeAttachmentUrls } from '../../../../util/attachments';
import generateUniqueId from '../../../../util/generateUniqueId';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { rafPromise } from '../../../../util/schedulers';
import buildAttachment, {
  getPreparedPhotoDimensions,
  prepareAttachment,
} from '../helpers/buildAttachment';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

export default function useAttachmentModal({
  attachments,
  fileSizeLimit,
  setAttachments,
  chatId,
  canAttachFiles,
  canSendAudios,
  canSendVideos,
  canSendPhotos,
  canSendDocuments,
  editedMessage,
  shouldSendInHighQuality,
}: {
  attachments: ApiAttachment[];
  fileSizeLimit: number;
  setAttachments: (
    attachments: ApiAttachment[] | ((current: ApiAttachment[]) => ApiAttachment[]),
  ) => void;
  chatId: string;
  canAttachFiles: boolean;
  canSendAudios?: boolean;
  canSendVideos?: boolean;
  canSendPhotos?: boolean;
  canSendDocuments?: boolean;
  editedMessage: ApiMessage | undefined;
  shouldSendInHighQuality?: boolean;
}) {
  const lang = useLang();
  const { openLimitReachedModal, showAllowedMessageTypesNotification, showNotification } = getActions();
  const [shouldForceAsFile, setShouldForceAsFile] = useState<boolean>(false);
  const [shouldForceCompression, setShouldForceCompression] = useState<boolean>(false);

  const handleClearAttachments = useLastCallback(() => {
    setAttachments((currentAttachments) => {
      currentAttachments.forEach((attachment) => revokeAttachmentUrls(attachment));
      return MEMO_EMPTY_ARRAY;
    });
  });

  const preparePendingAttachments = useLastCallback((pendingAttachments: ApiAttachment[]) => {
    pendingAttachments.forEach((pendingAttachment) => {
      void prepareAndUpdateAttachment(pendingAttachment);
    });

    async function prepareAndUpdateAttachment(pendingAttachment: ApiAttachment) {
      await rafPromise();

      let preparedAttachment: ApiAttachment;
      let hasPhotoPreparationFailed = false;
      try {
        preparedAttachment = await prepareAttachment(pendingAttachment);
      } catch {
        hasPhotoPreparationFailed = SUPPORTED_PHOTO_CONTENT_TYPES.has(pendingAttachment.mimeType);
        preparedAttachment = {
          ...pendingAttachment,
          quick: hasPhotoPreparationFailed ? undefined : pendingAttachment.quick,
          isPreparing: undefined,
          shouldSendAsFile: hasPhotoPreparationFailed ? true : pendingAttachment.shouldSendAsFile,
        };
      }

      let shouldNotifyPreparationFailure = false;
      setAttachments((currentAttachments) => {
        const currentAttachment = currentAttachments.find(
          ({ uniqueId }) => uniqueId === pendingAttachment.uniqueId,
        );
        if (!currentAttachment?.isPreparing) {
          revokeAttachmentUrls(preparedAttachment, currentAttachments);
          return currentAttachments;
        }

        shouldNotifyPreparationFailure = hasPhotoPreparationFailed;
        if (hasPhotoPreparationFailed && !canSendDocuments) {
          revokeAttachmentUrls(preparedAttachment);
          return currentAttachments.filter(({ uniqueId }) => uniqueId !== pendingAttachment.uniqueId);
        }

        const nextAttachment: ApiAttachment = {
          ...preparedAttachment,
          shouldSendAsSpoiler: currentAttachment.shouldSendAsSpoiler,
        };
        if (hasPhotoPreparationFailed && editedMessage && !canReplaceMessageMedia(editedMessage, nextAttachment)) {
          revokeAttachmentUrls(preparedAttachment);
          return currentAttachments.filter(({ uniqueId }) => uniqueId !== pendingAttachment.uniqueId);
        }

        revokeAttachmentUrls(currentAttachment, [nextAttachment]);
        return currentAttachments.map((attachment) => (
          attachment.uniqueId === pendingAttachment.uniqueId ? nextAttachment : attachment
        ));
      });
      if (shouldNotifyPreparationFailure) {
        showNotification({ message: lang('RichMediaUploadFailed') });
      }
    }
  });

  const handleSetAttachments = useLastCallback(
    (newValue: ApiAttachment[] | ((current: ApiAttachment[]) => ApiAttachment[])) => {
      const newAttachments = typeof newValue === 'function' ? newValue(attachments) : newValue;
      if (!newAttachments.length) {
        handleClearAttachments();
        return;
      }

      if (!canAttachFiles) {
        newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment, attachments));
        return;
      }

      if (newAttachments.some((attachment) => {
        const type = getAttachmentMediaType(attachment);

        return (type === 'audio' && !canSendAudios && !canSendDocuments)
          || (type === 'video' && !canSendVideos && !canSendDocuments)
          || (type === 'photo' && !canSendPhotos && !canSendDocuments)
          || (type === 'file' && !canSendDocuments);
      })) {
        newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment, attachments));
        showAllowedMessageTypesNotification({ chatId });
      } else if (newAttachments.some(({ size }) => size > fileSizeLimit)) {
        newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment, attachments));
        openLimitReachedModal({
          limit: 'uploadMaxFileparts',
        });
      } else {
        const pendingAttachments = newAttachments.filter(({ isPreparing, uniqueId }) => (
          isPreparing && !attachments.some((attachment) => attachment.uniqueId === uniqueId)
        ));
        attachments.forEach((attachment) => revokeAttachmentUrls(attachment, newAttachments));
        setAttachments(newAttachments);
        preparePendingAttachments(pendingAttachments);
        const shouldForce = newAttachments.some((attachment) => {
          const type = getAttachmentMediaType(attachment);

          return (type === 'audio' && !canSendAudios)
            || (type === 'video' && !canSendVideos)
            || (type === 'photo' && !canSendPhotos);
        });

        setShouldForceAsFile(Boolean(shouldForce && canSendDocuments));
        setShouldForceCompression(!canSendDocuments);
      }
    },
  );

  const handleAppendFiles = useLastCallback(async (files: File[], isSpoiler?: boolean) => {
    if (!canAttachFiles) {
      return;
    }

    if (editedMessage) {
      if (editedMessage.groupedId && files[0].type === GIF_MIME_TYPE) {
        showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: 1 }) });
        return;
      }

      const newAttachment = await buildAttachment(files[0].name, files[0]);
      const canReplace = editedMessage && canReplaceMessageMedia(editedMessage, newAttachment);

      if (editedMessage?.groupedId) {
        if (canReplace) {
          handleSetAttachments([newAttachment]);
        } else {
          revokeAttachmentUrls(newAttachment);
          showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: files.length }) });
        }
      } else {
        handleSetAttachments([newAttachment]);
      }
    } else {
      const newAttachments = await Promise.all(files.map((file) => (
        buildAttachment(file.name, file,
          { shouldSendAsSpoiler: isSpoiler || undefined, shouldSendInHighQuality })
      )));
      handleSetAttachments([...attachments, ...newAttachments]);
    }
  });

  const handleFileSelect = useLastCallback(async (files: File[]) => {
    if (!canAttachFiles) {
      return;
    }

    if (editedMessage) {
      if (editedMessage.groupedId && files[0].type === GIF_MIME_TYPE) {
        showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: 1 }) });
        return;
      }

      const newAttachment = await buildAttachment(files[0].name, files[0]);
      const canReplace = editedMessage && canReplaceMessageMedia(editedMessage, newAttachment);

      if (editedMessage?.groupedId) {
        if (canReplace) {
          handleSetAttachments([newAttachment]);
        } else {
          revokeAttachmentUrls(newAttachment);
          showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: files.length }) });
        }
      } else {
        handleSetAttachments([newAttachment]);
      }
    } else {
      const newAttachments = await Promise.all(files.map((file) =>
        buildAttachment(file.name, file, { shouldSendInHighQuality })));
      handleSetAttachments(newAttachments);
    }
  });

  const handleUpdateAttachmentsQuality = useLastCallback(() => {
    const newAttachments = attachments.map((attachment) => {
      if (!attachment.blob || !SUPPORTED_PHOTO_CONTENT_TYPES.has(attachment.mimeType)) return attachment;

      return {
        ...attachment,
        quick: attachment.shouldSendAsFile ? undefined : getPreparedPhotoDimensions(
          attachment.sourceDimensions!.width,
          attachment.sourceDimensions!.height,
          attachment.mimeType,
          shouldSendInHighQuality,
        ),
        isPreparing: true,
        shouldSendInHighQuality,
        uniqueId: generateUniqueId(),
      } satisfies ApiAttachment;
    });
    handleSetAttachments(newAttachments);
  });

  useEffect(() => {
    handleUpdateAttachmentsQuality();
  }, [shouldSendInHighQuality]);

  return {
    handleAppendFiles,
    handleFileSelect,
    handleClearAttachments,
    handleSetAttachments,
    shouldForceCompression,
    shouldForceAsFile,
  };
}
