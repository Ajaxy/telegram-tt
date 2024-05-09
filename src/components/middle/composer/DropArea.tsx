import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { canReplaceMessageMedia, isUploadingFileSticker } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import buildAttachment from './helpers/buildAttachment';
import getFilesFromDataTransferItems from './helpers/getFilesFromDataTransferItems';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevious from '../../../hooks/usePrevious';
import useShowTransition from '../../../hooks/useShowTransition';

import Portal from '../../ui/Portal';
import DropTarget from './DropTarget';

import './DropArea.scss';

export type OwnProps = {
  isOpen: boolean;
  withQuick?: boolean;
  onHide: NoneToVoidFunction;
  onFileSelect: (files: File[], suggestCompression?: boolean) => void;
  editingMessage?: ApiMessage | undefined;
};

export enum DropAreaState {
  None = 'none',
  Document = 'document',
  QuickFile = 'quick_file',
}

const DROP_LEAVE_TIMEOUT_MS = 150;

const DropArea: FC<OwnProps> = ({
  isOpen, withQuick, onHide, onFileSelect, editingMessage,
}) => {
  const lang = useLang();
  const { showNotification } = getActions();
  // eslint-disable-next-line no-null/no-null
  const hideTimeoutRef = useRef<number>(null);
  const prevWithQuick = usePrevious(withQuick);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen);
  const isInAlbum = editingMessage && editingMessage?.groupedId;

  useEffect(() => (isOpen ? captureEscKeyListener(onHide) : undefined), [isOpen, onHide]);

  const handleFilesDrop = useLastCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    const { dataTransfer: dt } = e;
    let files: File[] = [];

    if (dt.files && dt.files.length > 0 && (!dt.items || !dt.items.length)) {
      files = files.concat(Array.from(dt.files));
    } else if (dt.items && dt.items.length > 0) {
      const folderFiles = await getFilesFromDataTransferItems(dt.items);
      const newAttachment = folderFiles && await buildAttachment(folderFiles[0].name, folderFiles[0]);
      const canReplace = editingMessage && newAttachment && canReplaceMessageMedia(editingMessage, newAttachment);
      const isFileSticker = newAttachment && isUploadingFileSticker(newAttachment);

      if (canReplace || isFileSticker) {
        showNotification({ message: lang(isInAlbum ? 'lng_edit_media_album_error' : 'lng_edit_media_invalid_file') });
        return;
      }
      if (folderFiles?.length) {
        files = files.concat(folderFiles);
      }
    }

    onHide();
    onFileSelect(files, withQuick ? false : undefined);
  });

  const handleQuickFilesDrop = useLastCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { dataTransfer: dt } = e;

    if (dt.files && dt.files.length > 0) {
      onHide();
      onFileSelect(Array.from(dt.files), true);
    }
  });

  const handleDragLeave = useLastCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();

    const { target: fromTarget, relatedTarget: toTarget } = e;

    // Esc button pressed during drag event
    if (
      (fromTarget as HTMLDivElement).matches('.DropTarget, .DropArea') && (
        !toTarget || !(toTarget as HTMLDivElement)!.matches('.DropTarget, .DropArea')
      )
    ) {
      hideTimeoutRef.current = window.setTimeout(() => {
        onHide();
      }, DROP_LEAVE_TIMEOUT_MS);
    }
  });

  const handleDragOver = () => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
    }
  };

  if (!shouldRender) {
    return undefined;
  }

  const shouldRenderQuick = withQuick || prevWithQuick;

  const className = buildClassName(
    'DropArea',
    transitionClassNames,
  );

  return (
    <Portal containerId="#middle-column-portals">
      <div
        className={className}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={onHide}
        onClick={onHide}
      >
        <DropTarget onFileSelect={handleFilesDrop} isGeneric={!shouldRenderQuick} />
        {shouldRenderQuick && <DropTarget onFileSelect={handleQuickFilesDrop} isQuick />}
      </div>
    </Portal>
  );
};

export default memo(DropArea);
