import type { FC } from '../../../lib/teact/teact.ts';
import type React from '../../../lib/teact/teact.ts';
import { useState } from '../../../lib/teact/teact.ts';
import { memo } from '../../../lib/teact/teact.ts';

import type { ApiChat } from '../../../api/types/index';
import type { ManagementScreens } from '../../../types/index';
import { ChatCreationProgress } from '../../../types/index';

import { getActions, withGlobal } from '../../../global/index';
import { selectChat, selectTabState } from '../../../global/selectors/index';

import useHistoryBack from '../../../hooks/useHistoryBack.ts';
import useLang from '../../../hooks/useLang.ts';
import useLastCallback from '../../../hooks/useLastCallback.ts';

import AvatarEditable from '../../ui/AvatarEditable.tsx';
import FloatingActionButton from '../../ui/FloatingActionButton.tsx';
import InputText from '../../ui/InputText.tsx';

type OwnProps = {
  chatId: string;
  isActive: boolean;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  creationProgress?: ChatCreationProgress;
  creationError?: string;
};

const NewDiscussionGroup: FC<OwnProps & StateProps> = ({
  chat,
  onClose,
  isActive,
  creationProgress,
  creationError,
}) => {
  const { createChannel } = getActions();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const [title, setTitle] = useState(() => lang('NewDiscussionChatTitle', { name: chat?.title }));
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();

  const isLoading = creationProgress === ChatCreationProgress.InProgress;

  const handleTitleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    const newValue = value.trimStart();

    setTitle(newValue);

    if (newValue !== value) {
      e.currentTarget.value = newValue;
    }
  });

  const renderedError = (creationError && lang('NewChatTitleEmptyError')) || (
    error !== lang('NewChatTitleEmptyError') && error !== lang('NewChannelTitleEmptyError')
      ? error
      : undefined
  );

  const handleCreateGroup = useLastCallback(() => {
    if (!title.length) {
      setError(lang('NewChatTitleEmptyError'));
      return;
    }
    if (!chat) return;

    createChannel({
      discussionChannelId: chat.id,
      title,
      photo,
      isSuperGroup: true,
    });
  });

  return (
    <div className="Management">
      <div className="panel-content custom-scroll">
        <div className="NewChat">
          <div className="NewChat-inner step-2">
            <AvatarEditable
              onChange={setPhoto}
              title={lang('AddPhoto')}
            />
            <InputText
              value={title}
              onChange={handleTitleChange}
              label={lang('GroupName')}
              error={error === lang('NewChatTitleEmptyError')
                || error === lang('NewChannelTitleEmptyError') ? error : undefined}
            />

            {renderedError && (
              <p className="error">{renderedError}</p>
            )}
          </div>

          <FloatingActionButton
            isShown={title.length !== 0}
            onClick={handleCreateGroup}
            disabled={isLoading}
            ariaLabel={lang('DiscussionCreateGroup')}
            iconName="arrow-right"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const {
      progress: creationProgress,
      error: creationError,
    } = selectTabState(global).chatCreation || {};
    const chat = selectChat(global, chatId);

    return {
      chat,
      creationProgress,
      creationError,
    };
  },
)(NewDiscussionGroup));
