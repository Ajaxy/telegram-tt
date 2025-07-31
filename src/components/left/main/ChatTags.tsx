import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import ShowTransition from '../../ui/ShowTransition';

import './ChatTags.scss';

type OwnProps = {
  folders?: ApiChatFolder[];
};

const ChatTags: FC<OwnProps> = ({
  folders,
}) => {
  function renderContent() {
    return (
      <div className="ChatTags-wrapper">
        {folders?.map((folder) => (
          <div key={folder.id} className={`ChatTags ChatTags-color-${folder.color}`}>
            {folder.title.text}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ShowTransition isCustom className="ChatTags-transition" isOpen>
      {renderContent()}
    </ShowTransition>
  );
};

export default memo(ChatTags);
