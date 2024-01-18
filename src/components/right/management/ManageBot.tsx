import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBotInfo, ApiUser } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import {
  getChatAvatarHash, getMainUsername, getUserFirstOrLastName,
} from '../../../global/helpers';
import {
  selectBot,
  selectTabState,
  selectUserFullInfo,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';

import Icon from '../../common/Icon';
import AvatarEditable from '../../ui/AvatarEditable';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import SelectAvatar from '../../ui/SelectAvatar';
import Spinner from '../../ui/Spinner';
import TextArea from '../../ui/TextArea';

import './Management.scss';

type OwnProps = {
  userId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  userId?: string;
  user?: ApiUser;
  chatBot?: ApiBotInfo;
  currentBio?: string;
  progress?: ManagementProgress;
  isMuted?: boolean;
  maxBioLength: number;
};

const ERROR_NAME_MISSING = 'Please provide name';

const ManageBot: FC<OwnProps & StateProps> = ({
  userId,
  user,
  progress,
  onClose,
  currentBio,
  isActive,
  maxBioLength,
}) => {
  const {
    setBotInfo,
    uploadProfilePhoto,
    uploadContactProfilePhoto,
    startBotFatherConversation,
  } = getActions();

  const [isFieldTouched, markFieldTouched, unmarkProfileTouched] = useFlag(false);
  const [isAvatarTouched, markAvatarTouched, unmarkAvatarTouched] = useFlag(false);
  const [error, setError] = useState<string | undefined>();
  const lang = useLang();

  const username = useMemo(() => (user ? getMainUsername(user) : undefined), [user]);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const currentName = user ? getUserFirstOrLastName(user) : '';

  const [photo, setPhoto] = useState<File | undefined>();
  const [name, setName] = useState(currentName || '');
  const [bio, setBio] = useState(currentBio || '');

  const currentAvatarHash = user && getChatAvatarHash(user);
  const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

  useEffect(() => {
    unmarkProfileTouched();
    unmarkAvatarTouched();
  }, [userId]);

  useEffect(() => {
    setName(currentName || '');
    setBio(currentBio || '');
  }, [currentName, currentBio, user]);

  useEffect(() => {
    setPhoto(undefined);
  }, [currentAvatarBlobUrl]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      unmarkProfileTouched();
      unmarkAvatarTouched();
      setError(undefined);
    }
  }, [progress]);

  const handleNameChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    markFieldTouched();

    if (error === ERROR_NAME_MISSING) {
      setError(undefined);
    }
  });

  const handleBioChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setBio(e.target.value);
    markFieldTouched();
  });

  const handlePhotoChange = useLastCallback((newPhoto: File) => {
    setPhoto(newPhoto);
    markAvatarTouched();
  });

  const handleProfileSave = useLastCallback(() => {
    const trimmedName = name.trim();
    const trimmedBio = bio.trim();

    if (!trimmedName.length) {
      setError(ERROR_NAME_MISSING);
      return;
    }

    setBotInfo({
      ...(isFieldTouched && {
        bot: user,
        name: trimmedName,
        description: trimmedBio,
      }),
    });

    if (photo) {
      uploadProfilePhoto({
        file: photo,
        ...(isAvatarTouched && { bot: user }),
      });
    }
  });

  const handleChangeEditIntro = useLastCallback(() => {
    startBotFatherConversation({ param: `${username}-intro` });
  });

  const handleChangeEditCommands = useLastCallback(() => {
    startBotFatherConversation({ param: `${username}-commands` });
  });

  const handleChangeSettings = useLastCallback(() => {
    startBotFatherConversation({ param: `${username}` });
  });

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const isSuggestRef = useRef(false);

  const handleSelectAvatar = useLastCallback((file: File) => {
    markAvatarTouched();
    uploadContactProfilePhoto({ userId, file, isSuggest: isSuggestRef.current });
  });

  if (!user) {
    return undefined;
  }

  const isLoading = progress === ManagementProgress.InProgress;

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <AvatarEditable
            currentAvatarBlobUrl={currentAvatarBlobUrl}
            onChange={handlePhotoChange}
            title={lang('ChatSetPhotoOrVideo')}
            disabled={isLoading}
          />
          <InputText
            id="user-name"
            label={lang('PaymentCheckoutName')}
            onChange={handleNameChange}
            value={name}
            error={error === ERROR_NAME_MISSING ? error : undefined}
            teactExperimentControlled
          />
          <TextArea
            value={bio}
            onChange={handleBioChange}
            label={lang('DescriptionPlaceholder')}
            disabled={isLoading}
            maxLength={maxBioLength}
            maxLengthIndicator={maxBioLength ? (maxBioLength - bio.length).toString() : undefined}
          />
        </div>
        <div className="section">
          <div className="dialog-buttons">
            <ListItem icon="bot-commands-filled" ripple onClick={handleChangeEditIntro}>
              <span>{lang('BotEditIntro')}</span>
            </ListItem>
            <ListItem icon="bot-command" ripple onClick={handleChangeEditCommands}>
              <span>{lang('BotEditCommands')}</span>
            </ListItem>
            <ListItem icon="bots" ripple onClick={handleChangeSettings}>
              <span>{lang('BotChangeSettings')}</span>
            </ListItem>
            <div className="section-info section-info_push">
              {renderText(lang('BotManageInfo'), ['links'])}
            </div>
          </div>
        </div>
      </div>
      <FloatingActionButton
        isShown={isFieldTouched || isAvatarTouched}
        onClick={handleProfileSave}
        disabled={isLoading}
        ariaLabel={lang('Save')}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <Icon name="check" />
        )}
      </FloatingActionButton>
      <SelectAvatar
        onChange={handleSelectAvatar}
        inputRef={inputRef}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const user = selectBot(global, userId);
    const userFullInfo = selectUserFullInfo(global, userId);
    const { progress } = selectTabState(global).management;
    const maxBioLength = selectCurrentLimit(global, 'aboutLength');

    return {
      userId,
      user,
      progress,
      currentBio: userFullInfo?.bio,
      maxBioLength,
    };
  },
)(ManageBot));
