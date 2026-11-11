import { useLayoutEffect, useMemo, useState } from '../lib/teact/teact';
import { getActions } from '../global';

import { IS_DOCUMENT_PICTURE_IN_PICTURE_SUPPORTED } from '../util/browser/windowEnvironment';
import {
  closeDocumentPictureInPicture, requestDocumentPictureInPicture,
} from '../util/documentPictureInPicture';
import useLastCallback from './useLastCallback';

export default function useDocumentPictureInPicture(
  ownerId?: string,
  options?: DocumentPictureInPictureOptions,
) {
  const { showNotification } = getActions();
  const [pictureInPictureWindow, setPictureInPictureWindow] = useState<Window>();
  const owner = useMemo(() => (ownerId ? {
    id: ownerId,
    onWindowChange: setPictureInPictureWindow,
    onError: () => showNotification({ message: { key: 'ErrorUnexpected' } }),
  } : undefined), [ownerId]);

  useLayoutEffect(() => {
    if (!owner) return undefined;

    return () => closeDocumentPictureInPicture(owner);
  }, [owner]);

  const requestPictureInPicture = useLastCallback(() => {
    if (!owner || !IS_DOCUMENT_PICTURE_IN_PICTURE_SUPPORTED) return;

    requestDocumentPictureInPicture(owner, options);
  });

  const closePictureInPicture = useLastCallback(() => {
    if (!owner) return;

    closeDocumentPictureInPicture(owner);
  });

  return { pictureInPictureWindow, requestPictureInPicture, closePictureInPicture };
}
