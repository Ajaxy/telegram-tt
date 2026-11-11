import { memo, useEffect, useMemo } from '../../lib/teact/teact';

import type { ApiAvatarUpload } from '../../api/types';
import type { MediaEditorResult } from './mediaEditor/MediaEditor';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLastCallback from '../../hooks/useLastCallback';

import MediaEditor from './mediaEditor/MediaEditor.async';

type OwnProps = {
  file?: Blob;
  isForForum?: boolean;
  isOwn?: boolean;
  initialCoverTime?: number;
  onChange: (avatar: ApiAvatarUpload) => void;
  onClose: NoneToVoidFunction;
};

const AvatarEditor = ({
  file,
  isForForum,
  isOwn,
  initialCoverTime,
  onChange,
  onClose,
}: OwnProps) => {
  const currentSource = useMemo(() => (file ? {
    blobUrl: URL.createObjectURL(file),
    mimeType: file.type,
    filename: file instanceof File ? file.name : '',
  } : undefined), [file]);
  const source = useCurrentOrPrev(currentSource, true);

  useEffect(() => (currentSource ? () => URL.revokeObjectURL(currentSource.blobUrl) : undefined), [currentSource]);

  const handleApply = useLastCallback((result: MediaEditorResult) => {
    if (result.kind === 'avatar') onChange(result.avatar);
  });

  return (
    <MediaEditor
      isOpen={Boolean(file)}
      source={source}
      avatarShape={isForForum ? 'roundedSquare' : 'circle'}
      isOwnAvatar={isOwn}
      initialCoverTime={initialCoverTime}
      onClose={onClose}
      onApply={handleApply}
    />
  );
};

export default memo(AvatarEditor);
