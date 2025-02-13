import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiPrivacySettings, ApiStory, ApiUser, PrivacyVisibility,
} from '../../api/types';
import type { IconName } from '../../types/icons';

import { getPeerTitle, getUserFullName } from '../../global/helpers';
import { selectPeerStory, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getHours } from '../../util/dates/units';
import stopEvent from '../../util/stopEvent';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import Switcher from '../ui/Switcher';
import Transition from '../ui/Transition';
import AllowDenyList from './privacy/AllowDenyList';
import CloseFriends from './privacy/CloseFriends';

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

type PrivacyAction = 'blockUserIds' | 'closeFriends' | 'blockContactUserIds' | 'allowUserIds';

interface PrivacyOption {
  name: string;
  value: PrivacyVisibility;
  color: [string, string];
  icon: IconName;
  actions?: PrivacyAction;
}

const OPTIONS: PrivacyOption[] = [{
  name: 'StoryPrivacyOptionEveryone',
  value: 'everybody',
  color: ['#50ABFF', '#007AFF'],
  icon: 'channel-filled',
  actions: 'blockUserIds',
}, {
  name: 'StoryPrivacyOptionContacts',
  value: 'contacts',
  color: ['#C36EFF', '#8B60FA'],
  icon: 'user-filled',
  actions: 'blockContactUserIds',
}, {
  name: 'StoryPrivacyOptionCloseFriends',
  value: 'closeFriends',
  color: ['#88D93A', '#30B73B'],
  icon: 'favorite-filled',
  actions: 'closeFriends',
}, {
  name: 'StoryPrivacyOptionSelectedContacts',
  value: 'nobody',
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
  isOpen,
  story,
  visibility,
  contactListIds,
  usersById,
  currentUserId,
  onClose,
}: OwnProps & StateProps) {
  const { editStoryPrivacy, toggleStoryInProfile } = getActions();

  const lang = useOldLang();
  const [isOpenModal, openModal, closeModal] = useFlag(false);
  const [privacy, setPrivacy] = useState<ApiPrivacySettings | undefined>(visibility);
  const [isPinned, setIsPinned] = useState(story?.isInProfile);
  const [activeKey, setActiveKey] = useState<Screens>(Screens.privacy);
  const [editingBlockingCategory, setEditingBlockingCategory] = useState<PrivacyVisibility>('everybody');
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

  const selectedBlockedIds = useMemo(() => {
    if (editingBlockingCategory !== privacy?.visibility) return [];
    return privacy?.blockUserIds || [];
  }, [editingBlockingCategory, privacy?.blockUserIds, privacy?.visibility]);

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
      visibility: editingBlockingCategory,
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
        setEditingBlockingCategory('everybody');
        break;
      case 'blockContactUserIds':
        setActiveKey(Screens.denyList);
        setEditingBlockingCategory('contacts');
        break;
    }
  }

  const handleIsPinnedToggle = useLastCallback(() => {
    setIsPinned(!isPinned);
  });

  // console.warn(privacy?.visibility, story?.visibility, OPTIONS);

  const handleSubmit = useLastCallback(() => {
    editStoryPrivacy({
      peerId: story!.peerId,
      storyId: story!.id,
      privacy: privacy!,
    });
    if (story!.isInProfile !== isPinned) {
      toggleStoryInProfile({ peerId: story!.peerId, storyId: story!.id, isInProfile: isPinned });
    }
    closeModal();
  });

  function renderActionName(action: PrivacyAction) {
    if (action === 'closeFriends') {
      if (closeFriendIds.length === 0) {
        return lang('StoryPrivacyOptionCloseFriendsDetail');
      }

      if (closeFriendIds.length === 1) {
        return getPeerTitle(lang, usersById[closeFriendIds[0]]);
      }

      return lang('StoryPrivacyOptionPeople', closeFriendIds.length, 'i');
    }

    if ((action === 'blockUserIds' && privacy?.visibility === 'everybody')
      || (action === 'blockContactUserIds' && privacy?.visibility === 'contacts')) {
      if (!privacy?.blockUserIds?.length) {
        return lang('StoryPrivacyOptionContactsDetail');
      }

      if (privacy.blockUserIds.length === 1) {
        return lang('StoryPrivacyOptionExcludePerson', getUserFullName(usersById[privacy.blockUserIds[0]]));
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
            selectedIds={selectedBlockedIds}
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
            selectedIds={privacy?.allowUserIds}
            onSelect={handleAllowUserIdsChange}
          />
        );
    }
  }

  function renderPrivacyList() {
    const storyLifeTime = story ? getHours(story.expireDate - story.date) : 0;

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
                  <Icon name={option.icon} />
                </span>
                <div className={styles.optionContent}>
                  <span className={buildClassName(styles.option_name)}>{lang(option.name)}</span>
                  {option.actions && (
                    <div
                      tabIndex={0}
                      role="button"
                      className={styles.action}
                      aria-label={lang('Edit')}
                      onClick={(e) => { handleActionClick(e, option.actions!); }}
                    >
                      <span className={styles.actionInner}>{renderActionName(option.actions)}</span>
                      <Icon name="next" />
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
      storyId, peerId,
    },
  } = selectTabState(global);
  const story = (peerId && storyId)
    ? selectPeerStory(global, peerId, storyId)
    : undefined;

  return {
    story: story && 'content' in story ? story as ApiStory : undefined,
    visibility: story && 'visibility' in story ? story.visibility : undefined,
    contactListIds: global.contactList?.userIds,
    usersById: global.users.byId,
    currentUserId: global.currentUserId!,
  };
})(StorySettings));
