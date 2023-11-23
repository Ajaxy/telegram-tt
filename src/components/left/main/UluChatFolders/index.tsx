import type { RefObject } from 'react';
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { FC } from '../../../../lib/teact/teact';
import { memo, useState } from '../../../../lib/teact/teact';

import ChatFoldersTree from './ChatFoldersTree';

import 'react-complex-tree/lib/style-modern.css';

const uluChatFoldersRootId = 'chat-folders-tree-root';

const uluChatFoldersElement = document.getElementById(uluChatFoldersRootId);
const uluChatFoldersRoot = createRoot(uluChatFoldersElement!);

// TODO clean-up

type OwnProps = {
  portalRef: RefObject<HTMLDivElement>;
};

const UluChatFolders: FC<OwnProps> = ({
  portalRef,
}) => {
  const [hookedToPortalRefState, setHookedToPortalRefState] = useState(false);
  const hookToPortalRefInterval = setInterval(() => {
    if (portalRef.current) {
      setHookedToPortalRefState(true);
      clearInterval(hookToPortalRefInterval);
    }
  }, 0);

  if (hookedToPortalRefState) {
    uluChatFoldersRoot.render(
      createPortal(<ChatFoldersTree />, portalRef.current!),
    );
  }

  return undefined;
};

export default memo(UluChatFolders);
