import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStory, ApiUser } from '../../api/types';
import type { ApiPrivacySettings, PrivacyVisibility } from '../../types';

import buildClassName from '../../util/buildClassName';
import { selectTabState, selectUserStory } from '../../global/selectors';
import { getUserFullName } from '../../global/helpers';
import stopEvent from '../../util/stopEvent';

import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import ListItem from '../ui/ListItem';
import Switcher from '../ui/Switcher';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import CloseFriends from './privacy/CloseFriends';
import AllowDenyList from './privacy/AllowDenyList';

import styles from './StorySettings.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  story?: ApiStory;
  visibility?: ApiPrivacySettings;
  contactListIds?: string[];
  usersById: Record<string, ApiUser>;
  currentUserId: string;
}

type PrivacyAction = 'blockUserIds' | 'closeFriends' | 'allowUserIds';

interface PrivacyOption {
  name: string;
  value: PrivacyVisibility;
  color: [string, string];
  icon: string;
  actions?: PrivacyAction;
}

const OPTIONS: PrivacyOption[] = [{
  name: 'StoryPrivacyOptionEveryone',
  value: 'everybody',
  color: ['#50ABFF', '#007AFF'],
  icon: 'channel-filled',
  actions: undefined,
}, {
  name: 'StoryPrivacyOptionContacts',
  value: 'contacts',
  color: ['#C36EFF', '#8B60FA'],
  icon: 'user-filled',
  actions: 'blockUserIds',
}, {
  name: 'StoryPrivacyOptionCloseFriends',
  value: 'closeFriends',
  color: ['#88D93A', '#30B73B'],
  icon: 'favorite-filled',
  actions: 'closeFriends',
}, {
  name: 'StoryPrivacyOptionSelectedContacts',
  value: 'selectedContacts',
  color: ['#FFB743', '#F69A36'],
  icon: 'group-filled',
  actions: 'allowUserIds',
}];

enum Screens {
  privacy,
  allowList,
  closeFriends,
  denyList,
}

function StorySettings({
  isOpen, story, visibility, contactListIds, usersById, currentUserId, onClose,
}: OwnProps & StateProps) {
  const { editStoryPrivacy, toggleStoryPinned } = getActions();

  const lang = useLang();
  const [isOpenModal, openModal, closeModal] = useFlag(false);
  const [privacy, setPrivacy] = useState<ApiPrivacySettings | undefined>(visibility);
  const [isPinned, setIsPinned] = useState(story?.isPinned);
  const [activeKey, setActiveKey] = useState<Screens>(Screens.privacy);
  const isBackButton = activeKey !== Screens.privacy;

  const closeFriendIds = useMemo(() => {
    return (contactListIds || []).filter((userId) => usersById[userId]?.isCloseFriend);
  }, [contactListIds, usersById]);

  const lockedIds = useMemo(() => {
    if (activeKey === Screens.allowList
      && (!privacy?.allowUserIds?.length || privacy.allowUserIds[0] === currentUserId)
    ) {
      return [currentUserId];
    }

    return undefined;
  }, [activeKey, currentUserId, privacy?.allowUserIds]);

  const handleAllowUserIdsChange = useLastCallback((newIds: string[]) => {
    setPrivacy({
      ...privacy!,
      allowUserIds: newIds?.length ? newIds?.filter((id) => id !== currentUserId) : [currentUserId],
    });
  });

  const handleDenyUserIdsChange = useLastCallback((newIds: string[]) => {
    setPrivacy({
      ...privacy!,
      blockUserIds: newIds,
    });
  });

  useEffect(() => {
    if (isOpen) {
      setActiveKey(Screens.privacy);
      openModal();
    }
  }, [isOpen]);

  useEffect(() => {
    setPrivacy(visibility);
  }, [visibility]);

  const handleCloseButtonClick = useLastCallback(() => {
    if (activeKey === Screens.privacy) {
      closeModal();
      return;
    }

    setActiveKey(Screens.privacy);
  });

  function handleVisibilityChange(newVisibility: PrivacyVisibility) {
    setPrivacy({
      ...privacy!,
      visibility: newVisibility,
    });
  }

  function handleActionClick(e: React.MouseEvent<HTMLDivElement>, action: PrivacyAction) {
    stopEvent(e);

    switch (action) {
      case 'closeFriends':
        setActiveKey(Screens.closeFriends);
        break;
      case 'allowUserIds':
        setActiveKey(Screens.allowList);
        break;
      case 'blockUserIds':
        setActiveKey(Screens.denyList);
    }
  }

  const handleIsPinnedToggle = useLastCallback(() => {
    setIsPinned(!isPinned);
  });

  // console.warn(privacy?.visibility, story?.visibility, OPTIONS);

  const handleSubmit = useLastCallback(() => {
    editStoryPrivacy({
      storyId: story!.id,
      privacy: privacy!,
    });
    if (story!.isPinned !== isPinned) {
      toggleStoryPinned({ storyId: story!.id, isPinned });
    }
    closeModal();
  });

  function renderActionName(action: PrivacyAction) {
    if (action === 'closeFriends') {
      if (closeFriendIds.length === 0) {
        return lang('StoryPrivacyOptionCloseFriendsDetail');
      }

      if (closeFriendIds.length === 1) {
        return getUserFullName(usersById[closeFriendIds[0]]);
      }

      return lang('StoryPrivacyOptionPeople', closeFriendIds.length, 'i');
    }

    if (action === 'blockUserIds') {
      if (!privacy?.blockUserIds || privacy.blockUserIds.length === 0) {
        return lang('StoryPrivacyOptionContactsDetail');
      }

      if (privacy.blockUserIds.length === 1) {
        return lang('StoryPrivacyOptionExcludePerson', getUserFullName(usersById[closeFriendIds[0]]));
      }

      return lang('StoryPrivacyOptionExcludePeople', privacy.blockUserIds.length, 'i');
    }

    if (!privacy?.allowUserIds || privacy.allowUserIds.length === 0) {
      return lang('StoryPrivacyOptionSelectedContactsDetail');
    }

    if (privacy.allowUserIds.length === 1) {
      return getUserFullName(usersById[privacy.allowUserIds[0]]);
    }

    return lang('StoryPrivacyOptionPeople', privacy.allowUserIds.length, 'i');
  }

  // eslint-disable-next-line consistent-return
  function renderHeaderContent() {
    switch (activeKey) {
      case Screens.privacy:
        return <h3 className={styles.headerTitle}>{lang('StoryPrivacyAlertEditTitle')}</h3>;
      case Screens.allowList:
        return <h3 className={styles.headerTitle}>{lang('StoryPrivacyAlertSelectContactsTitle')}</h3>;
      case Screens.closeFriends:
        return <h3 className={styles.headerTitle}>{lang('CloseFriends')}</h3>;
      case Screens.denyList:
        return <h3 className={styles.headerTitle}>{lang('StoryPrivacyAlertExcludedContactsTitle')}</h3>;
    }
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean) {
    switch (activeKey) {
      case Screens.privacy:
        return renderPrivacyList();
      case Screens.closeFriends:
        return (
          <CloseFriends
            key="close-friends"
            isActive={isActive}
            contactListIds={contactListIds}
            currentUserId={currentUserId}
            usersById={usersById}
            onClose={handleCloseButtonClick}
          />
        );
      case Screens.denyList:
        return (
          <AllowDenyList
            key="deny-list"
            id="deny-list"
            contactListIds={contactListIds}
            currentUserId={currentUserId}
            usersById={usersById}
            selectedIds={privacy?.blockUserIds}
            onSelect={handleDenyUserIdsChange}
          />
        );
      case Screens.allowList:
        return (
          <AllowDenyList
            key="allow-list"
            id="allow-list"
            contactListIds={contactListIds}
            lockedIds={lockedIds}
            currentUserId={currentUserId}
            usersById={usersById}
            selectedIds={privacy?.allowUserIds}
            onSelect={handleAllowUserIdsChange}
          />
        );
    }
  }

  function renderPrivacyList() {
    const storyLifeTime = story ? convertSecondsToHours(story.expireDate - story.date) : 0;

    return (
      <>
        <div className={styles.section}>
          <h3 className={styles.title}>{lang('StoryPrivacyAlertSubtitleProfile')}</h3>
          <div className={styles.list}>
            {OPTIONS.map((option) => (
              <label
                key={option.value}
                className={buildClassName(styles.option, option.value === privacy?.visibility && styles.checked)}
              >
                <input
                  type="radio"
                  name="story_privacy"
                  className={styles.input}
                  value={option.value}
                  checked={option.value === privacy?.visibility}
                  onChange={() => handleVisibilityChange(option.value)}
                  teactExperimentControlled
                />
                <span
                  className={styles.icon}
                  style={`--color-from: ${option.color[0]}; --color-to: ${option.color[1]}`}
                >
                  <i className={`icon icon-${option.icon}`} />
                </span>
                <div className={styles.optionContent}>
                  <span className={buildClassName(styles.option_name)}>{lang(option.name)}</span>
                  {option.actions && (
                    <div
                      tabIndex={0}
                      role="button"
                      className={styles.action}
                      aria-label={lang('Change List')}
                      onClick={(e) => { handleActionClick(e, option.actions!); }}
                    >
                      <span className={styles.actionInner}>{renderActionName(option.actions)}</span>
                      <i className="icon icon-next" aria-hidden />
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <ListItem ripple onClick={handleIsPinnedToggle}>
            <span>{lang('StoryKeep')}</span>
            <Switcher
              id="group-notifications"
              label={lang('StoryKeep')}
              checked={isPinned}
              inactive
            />
          </ListItem>
        </div>
        <div className={styles.footer}>
          <div className={styles.info}>{lang('StoryKeepInfo', storyLifeTime)}</div>
          <div className={styles.submit}>
            <Button onClick={handleSubmit}>{lang('StoryPrivacyButtonSave')}</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpenModal}
      className={buildClassName(styles.modal, 'component-theme-dark')}
      onClose={closeModal}
      noBackdrop
      onCloseAnimationEnd={onClose}
    >
      <div className={styles.header}>
        <Button
          className={buildClassName(styles.closeButton, 'close-button')}
          round
          color="translucent"
          size="smaller"
          onClick={handleCloseButtonClick}
          ariaLabel={isBackButton ? lang('Common.Back') : lang('Common.Close')}
        >
          <div className={buildClassName('animated-close-icon', isBackButton && 'state-back')} />
        </Button>
        <Transition name="slideFade" activeKey={activeKey}>
          {renderHeaderContent()}
        </Transition>
      </div>
      <Transition
        activeKey={activeKey}
        name="slideFade"
        slideClassName="ChatOrUserPicker_slide"
        className={styles.content}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    storyViewer: {
      storyId, userId,
    },
  } = selectTabState(global);
  const story = (userId && storyId)
    ? selectUserStory(global, userId, storyId)
    : undefined;

  return {
    story: story && 'content' in story ? story as ApiStory : undefined,
    visibility: story && 'visibility' in story ? story.visibility : undefined,
    contactListIds: global.contactList?.userIds,
    usersById: global.users.byId,
    currentUserId: global.currentUserId!,
  };
})(StorySettings));

function convertSecondsToHours(seconds: number): number {
  const secondsInHour = 3600;
  const minutesInHour = 60;

  const hours = Math.floor(seconds / secondsInHour);
  const remainingSeconds = seconds % secondsInHour;
  const remainingMinutes = Math.floor(remainingSeconds / minutesInHour);

  // If remaining minutes are greater than or equal to 30, round up the hours
  return remainingMinutes >= 30 ? hours + 1 : hours;
}
