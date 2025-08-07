import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { selectChatFolder } from '../../../global/selectors';

import './ChatTags.scss';

type OwnProps = {
  folderIds?: number[];
};

const ChatTags: FC<OwnProps> = ({
  folderIds,
}) => {
  const global = getGlobal();

  return (
    <div className="ChatTags-wrapper">
      {folderIds?.map((folderId) => {
        const folder = selectChatFolder(global, folderId);
        return folder && (
          <div key={folder.id} className={`ChatTags ChatTags-color-${folder.color}`}>
            <div className="ChatTags-background" />
            {folder.title.text}
          </div>
        );
      })}
    </div>
  );
};

export default memo(ChatTags);
