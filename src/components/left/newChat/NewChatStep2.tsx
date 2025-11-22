import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo,
  useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { ChatCreationProgress } from '../../../types';

import { getUserFirstOrLastName } from '../../../global/helpers';
import { selectTabState } from '../../../global/selectors';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import AvatarEditable from '../../ui/AvatarEditable';
import Button from '../../ui/Button';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';

export type OwnProps = {
  isChannel?: boolean;
  isActive: boolean;
  memberIds: string[];
  onReset: (forceReturnToChatList?: boolean) => void;
};

type StateProps = {
  creationProgress?: ChatCreationProgress;
  creationError?: string;
  maxGroupSize?: number;
};

const MAX_MEMBERS_FOR_GENERATE_CHAT_NAME = 4;

const NewChatStep2: FC<OwnProps & StateProps> = ({
  isChannel,
  isActive,
  memberIds,
  maxGroupSize,
  creationProgress,
  creationError,
  onReset,
}) => {
  const {
    createGroupChat,
    createChannel,
  } = getActions();

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();

  const chatTitleEmptyError = 'Chat title can\'t be empty';
  const channelTitleEmptyError = 'Channel title can\'t be empty';
  const chatTooManyUsersError = 'Sorry, creating supergroups is not yet supported';

  const isLoading = creationProgress === ChatCreationProgress.InProgress;

  useEffect(() => {
    if (isChannel) {
      return;
    }
    if (!memberIds.length || memberIds.length > MAX_MEMBERS_FOR_GENERATE_CHAT_NAME) {
      setTitle('');
      return;
    }
    const global = getGlobal();
    const usersById = global.users.byId;
    const memberFirstNames = [global.currentUserId!, ...memberIds]
      .map((userId) => getUserFirstOrLastName(usersById[userId]))
      .filter(Boolean);
    const generatedChatName = memberFirstNames.slice(0, -1).join(', ')
      + lang('CreateGroup.PeersTitleLastDelimeter')
      + memberFirstNames[memberFirstNames.length - 1];
    setTitle(generatedChatName);
  }, [isChannel, memberIds, lang]);

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

    if (maxGroupSize && memberIds.length >= maxGroupSize) {
      setError(chatTooManyUsersError);
      return;
    }

    createGroupChat({
      title,
      photo,
      memberIds,
    });
  }, [title, memberIds, maxGroupSize, createGroupChat, photo]);

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
      isChannel: true,
    });
  }, [title, createChannel, about, photo, memberIds, channelTitleEmptyError]);

  useEffect(() => {
    if (creationProgress === ChatCreationProgress.Complete) {
      onReset(true);
    }
  }, [creationProgress, onReset]);

  const renderedError = (creationError && lang(creationError)) || (
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
          iconName="arrow-left"
        />
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
        iconName="arrow-right"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      progress: creationProgress,
      error: creationError,
    } = selectTabState(global).chatCreation || {};

    return {
      creationProgress,
      creationError,
      maxGroupSize: global.config?.maxGroupSize,
    };
  },
)(NewChatStep2));
