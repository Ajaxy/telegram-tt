import React, {
  FC, useState, useCallback, useEffect, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ChatCreationProgress } from '../../../types';

import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import InputText from '../../ui/InputText';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import AvatarEditable from '../../ui/AvatarEditable';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';

export type OwnProps = {
  isChannel?: boolean;
  isActive: boolean;
  memberIds: number[];
  onReset: (forceReturnToChatList?: boolean) => void;
};

type StateProps = {
  creationProgress?: ChatCreationProgress;
  creationError?: string;
};

type DispatchProps = Pick<GlobalActions, 'createGroupChat' | 'createChannel'>;

// TODO @implement
const MAX_USERS_FOR_LEGACY_CHAT = 199; // Accounting for current user

const NewChatStep2: FC<OwnProps & StateProps & DispatchProps> = ({
  isChannel,
  isActive,
  memberIds,
  onReset,
  creationProgress,
  creationError,
  createGroupChat,
  createChannel,
}) => {
  const lang = useLang();

  useHistoryBack(isActive, onReset);

  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();

  const chatTitleEmptyError = 'Chat title can\'t be empty';
  const channelTitleEmptyError = 'Channel title can\'t be empty';
  const chatTooManyUsersError = 'Sorry, creating supergroups is not yet supported';

  const isLoading = creationProgress === ChatCreationProgress.InProgress;

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    const newValue = value.replace(/^\s+/, '');

    setTitle(newValue);

    if (newValue !== value) {
      e.currentTarget.value = newValue;
    }
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAbout(e.currentTarget.value);
  }, []);

  const handleCreateGroup = useCallback(() => {
    if (!title.length) {
      setError(chatTitleEmptyError);
      return;
    }

    if (memberIds.length > MAX_USERS_FOR_LEGACY_CHAT) {
      setError(chatTooManyUsersError);
      return;
    }

    createGroupChat({
      title,
      photo,
      memberIds,
    });
  }, [title, memberIds, createGroupChat, photo, chatTitleEmptyError, chatTooManyUsersError]);

  const handleCreateChannel = useCallback(() => {
    if (!title.length) {
      setError(channelTitleEmptyError);
      return;
    }

    createChannel({
      title,
      about,
      photo,
      memberIds,
    });
  }, [title, createChannel, about, photo, memberIds, channelTitleEmptyError]);

  useEffect(() => {
    if (creationProgress === ChatCreationProgress.Complete) {
      onReset(true);
    }
  }, [creationProgress, onReset]);

  const renderedError = creationError || (
    error !== chatTitleEmptyError && error !== channelTitleEmptyError
      ? error
      : undefined
  );

  return (
    <div className="NewChat">
      <div className="left-header">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={() => onReset()}
          ariaLabel="Return to member selection"
        >
          <i className="icon-arrow-left" />
        </Button>
        <h3>{lang(isChannel ? 'NewChannel' : 'NewGroup')}</h3>
      </div>
      <div className="NewChat-inner step-2">
        <AvatarEditable
          onChange={setPhoto}
          title={lang('AddPhoto')}
        />
        <InputText
          value={title}
          onChange={handleTitleChange}
          label={lang(isChannel ? 'EnterChannelName' : 'GroupName')}
          error={error === chatTitleEmptyError || error === channelTitleEmptyError ? error : undefined}
        />
        {isChannel && (
          <>
            <InputText
              value={about}
              onChange={handleDescriptionChange}
              label={lang('DescriptionOptionalPlaceholder')}
            />
            <p className="note">{lang('DescriptionInfo')}</p>
          </>
        )}

        {renderedError && (
          <p className="error">{renderedError}</p>
        )}

        {memberIds.length > 0 && (
          <>
            <h3 className="chat-members-heading">{lang('GroupInfo.ParticipantCount', memberIds.length, 'i')}</h3>

            <div className="chat-members-list custom-scroll">
              {memberIds.map((id) => (
                <ListItem inactive className="chat-item-clickable">
                  <PrivateChatInfo userId={id} />
                </ListItem>
              ))}
            </div>
          </>
        )}
      </div>

      <FloatingActionButton
        isShown={title.length !== 0}
        onClick={isChannel ? handleCreateChannel : handleCreateGroup}
        disabled={isLoading}
        ariaLabel={isChannel ? lang('ChannelIntro.CreateChannel') : 'Create Group'}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-arrow-right" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      progress: creationProgress,
      error: creationError,
    } = global.chatCreation || {};

    return {
      creationProgress,
      creationError,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'createGroupChat', 'createChannel',
  ]),
)(NewChatStep2));
