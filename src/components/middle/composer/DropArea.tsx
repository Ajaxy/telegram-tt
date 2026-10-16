import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { canReplaceMessageMedia } from '../../../global/helpers';
import { revokeAttachmentUrls } from '../../../util/attachments';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { validateFiles } from '../../../util/files';
import buildAttachment from './helpers/buildAttachment';
import getFilesFromDataTransferItems from './helpers/getFilesFromDataTransferItems';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import Portal from '../../ui/Portal';
import DropTarget from './DropTarget';

import './DropArea.scss';

export type OwnProps = {
  isOpen: boolean;
  withQuick?: boolean;
  editingMessage?: ApiMessage;
  onHide: NoneToVoidFunction;
  onFileSelect: (files: File[]) => void;
};

export enum DropAreaState {
  None = 'none',
  Document = 'document',
  QuickFile = 'quick_file',
}

const DropArea = ({
  isOpen, withQuick, editingMessage, onHide, onFileSelect,
}: OwnProps) => {
  const { showNotification, updateAttachmentSettings } = getActions();
  const prevWithQuick = usePreviousDeprecated(withQuick);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const lang = useLang();

  useEffect(() => (isOpen ? captureEscKeyListener(onHide) : undefined), [isOpen, onHide]);

  const handleFilesDrop = useLastCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    const { dataTransfer: dt } = e;
    let files: File[] = [];

    if (dt.files && dt.files.length > 0 && (!dt.items || !dt.items.length)) {
      files = files.concat(validateFiles(dt.files) ?? []);
    } else if (dt.items && dt.items.length > 0) {
      const folderFiles = await getFilesFromDataTransferItems(dt.items);
      if (folderFiles?.length) {
        files = files.concat(folderFiles);
      }
    }

    if (!await validateReplacement(files)) return;

    onHide();
    updateAttachmentSettings({ shouldCompress: withQuick ? false : undefined });
    onFileSelect(files);
  });

  const handleQuickFilesDrop = useLastCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    const { dataTransfer: dt } = e;

    const files = validateFiles(dt.files);
    if (files?.length) {
      if (!await validateReplacement(files)) return;

      onHide();
      updateAttachmentSettings({ shouldCompress: true });
      onFileSelect(files);
    }
  });

  async function validateReplacement(files: File[]) {
    if (!editingMessage) return true;

    if (files.length !== 1) {
      showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: files.length }) });
      return false;
    }

    const attachment = await buildAttachment(files[0].name, files[0]);
    const canReplace = canReplaceMessageMedia(editingMessage, attachment);
    revokeAttachmentUrls(attachment);
    if (!canReplace) {
      showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: files.length }) });
    }

    return canReplace;
  }

  if (!shouldRender) {
    return undefined;
  }

  const shouldRenderQuick = withQuick || prevWithQuick;

  const className = buildClassName(
    'DropArea',
    transitionClassNames,
  );

  return (
    <Portal containerSelector="#middle-column-portals">
      <div className={className} onClick={onHide}>
        <DropTarget onFileSelect={handleFilesDrop} isGeneric={!shouldRenderQuick} />
        {shouldRenderQuick && <DropTarget onFileSelect={handleQuickFilesDrop} isQuick />}
      </div>
    </Portal>
  );
};

export default memo(DropArea);
