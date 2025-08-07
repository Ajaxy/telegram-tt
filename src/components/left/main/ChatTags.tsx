import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import './ChatTags.scss';

type OwnProps = {
  folders?: ApiChatFolder[];
};

const ChatTags: FC<OwnProps> = ({
  folders,
}) => (
  <div className="ChatTags-wrapper">
    {folders?.map((folder) => folder?.color && (
      <div key={folder.id} className={`ChatTags ChatTags-color-${folder.color}`}>
        <div className="ChatTags-background" />
        {folder.title.text}
      </div>
    ))}
  </div>
);

export default memo(ChatTags);
