import { useCallback, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiAttachment } from '../../../../api/types';

import buildAttachment from '../helpers/buildAttachment';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';

export default function useAttachmentModal({
  attachments,
  fileSizeLimit,
  setHtml,
  setAttachments,
}: {
  attachments: ApiAttachment[];
  fileSizeLimit: number;
  setHtml: (html: string) => void;
  setAttachments: (attachments: ApiAttachment[]) => void;
}) {
  const { openLimitReachedModal } = getActions();
  const [shouldSuggestCompression, setShouldSuggestCompression] = useState<boolean | undefined>(undefined);

  const handleClearAttachments = useCallback(() => {
    setAttachments(MEMO_EMPTY_ARRAY);
  }, [setAttachments]);

  const handleDeleteAttachment = useCallback((index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments?.length ? newAttachments : MEMO_EMPTY_ARRAY);
  }, [attachments, setAttachments]);

  const handleSetAttachments = useCallback(
    (newValue: ApiAttachment[] | ((current: ApiAttachment[]) => ApiAttachment[])) => {
      const newAttachments = typeof newValue === 'function' ? newValue(attachments) : newValue;
      if (newAttachments.some(({ size }) => size > fileSizeLimit)) {
        openLimitReachedModal({
          limit: 'uploadMaxFileparts',
        });
      } else {
        setAttachments(newAttachments);
      }
    }, [attachments, fileSizeLimit, openLimitReachedModal, setAttachments],
  );

  const handleAppendFiles = useCallback(async (files: File[]) => {
    handleSetAttachments([
      ...attachments,
      ...await Promise.all(files.map((file) => buildAttachment(file.name, file))),
    ]);
  }, [attachments, handleSetAttachments]);

  const handleFileSelect = useCallback(async (files: File[], suggestCompression?: boolean) => {
    handleSetAttachments(await Promise.all(files.map((file) => buildAttachment(file.name, file))));
    setShouldSuggestCompression(suggestCompression);
  }, [handleSetAttachments]);

  return {
    shouldSuggestCompression,
    handleAppendFiles,
    handleFileSelect,
    onCaptionUpdate: setHtml,
    handleClearAttachments,
    handleDeleteAttachment,
    handleSetAttachments,
  };
}
