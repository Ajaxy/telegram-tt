import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect,
  useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatBannedRights, ApiChatMember } from '../../../api/types';
import { ManagementProgress, ManagementScreens } from '../../../types';

import {
  DEFAULT_CHARGE_FOR_MESSAGES,
} from '../../../config';
import {
  selectChat,
  selectChatFullInfo,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useManagePermissions from '../hooks/useManagePermissions';

import PaidMessagePrice from '../../common/paidMessage/PaidMessagePrice';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import PermissionCheckboxList from '../../main/PermissionCheckboxList';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: string, isPromotedByCurrentUser?: boolean) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  progress?: ManagementProgress;
  currentUserId?: string;
  removedUsersCount: number;
  members?: ApiChatMember[];
  arePaidMessagesAvailable?: boolean;
  groupPeersPaidStars: number;
  canChargeForMessages?: boolean;
};

const ITEM_HEIGHT = 48;
const BEFORE_ITEMS_COUNT = 2;
const ITEMS_COUNT = 9;

function getLangKeyForBannedRightKey(key: keyof ApiChatBannedRights) {
  switch (key) {
    case 'sendMessages':
      return 'UserRestrictionsNoSend';
    case 'sendMedia':
      return 'UserRestrictionsNoSendMedia';
    case 'sendStickers':
      return 'UserRestrictionsNoSendStickers';
    case 'embedLinks':
      return 'UserRestrictionsNoEmbedLinks';
    case 'sendPolls':
      return 'UserRestrictionsNoSendPolls';
    case 'changeInfo':
      return 'UserRestrictionsNoChangeInfo';
    case 'inviteUsers':
      return 'UserRestrictionsInviteUsers';
    case 'pinMessages':
      return 'UserRestrictionsPinMessages';
    case 'manageTopics':
      return 'GroupPermission.NoManageTopics';
    case 'sendPlain':
      return 'UserRestrictionsNoSendText';
    case 'sendDocs':
      return 'UserRestrictionsNoSendDocs';
    case 'sendRoundvideos':
      return 'UserRestrictionsNoSendRound';
    case 'sendVoices':
      return 'UserRestrictionsNoSendVoice';
    case 'sendAudios':
      return 'UserRestrictionsNoSendMusic';
    case 'sendVideos':
      return 'UserRestrictionsNoSendVideos';
    case 'sendPhotos':
      return 'UserRestrictionsNoSendPhotos';
    default:
      return undefined;
  }
}

const ManageGroupPermissions: FC<OwnProps & StateProps> = ({
  onScreenSelect,
  onChatMemberSelect,
  chat,
  progress,
  currentUserId,
  removedUsersCount,
  members,
  onClose,
  isActive,
  arePaidMessagesAvailable,
  canChargeForMessages,
  groupPeersPaidStars,
}) => {
  const { updateChatDefaultBannedRights, updatePaidMessagesPrice } = getActions();

  const {
    permissions, havePermissionChanged, isLoading, handlePermissionChange, setIsLoading,
  } = useManagePermissions(chat?.defaultBannedRights);
  const oldLang = useOldLang();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleRemovedUsersClick = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupRemovedUsers);
  }, [onScreenSelect]);

  const handleAddExceptionClick = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupUserPermissionsCreate);
  }, [onScreenSelect]);

  const handleExceptionMemberClick = useCallback((member: ApiChatMember) => {
    onChatMemberSelect(member.userId, member.promotedByUserId === currentUserId);
    onScreenSelect(ManagementScreens.GroupUserPermissions);
  }, [currentUserId, onChatMemberSelect, onScreenSelect]);

  const [isMediaDropdownOpen, setIsMediaDropdownOpen] = useState(false);

  const [isPriceForMessagesChanged, markPriceForMessagesChanged, unmarkPriceForMessagesChanged] = useFlag();
  const [isPriceForMessagesOpen, setIsPriceForMessagesOpen] = useState(canChargeForMessages);
  const [chargeForMessages, setChargeForMessages] = useState<number>(groupPeersPaidStars);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      unmarkPriceForMessagesChanged();
    }
  }, [progress]);

  const handleSavePermissions = useLastCallback(() => {
    if (!chat) {
      return;
    }

    setIsLoading(true);
    updateChatDefaultBannedRights({ chatId: chat.id, bannedRights: permissions });
  });

  const handleUpdatePaidMessagesPrice = useLastCallback(() => {
    if (!chat) return;
    updatePaidMessagesPrice({
      chatId: chat?.id,
      paidMessagesStars: isPriceForMessagesOpen ? chargeForMessages : 0,
    });
  });

  const handleUpdatePermissions = useLastCallback(() => {
    if (isPriceForMessagesChanged) {
      handleUpdatePaidMessagesPrice();
    }
    if (havePermissionChanged) {
      handleSavePermissions();
    }
  });

  const exceptionMembers = useMemo(() => {
    if (!members) {
      return [];
    }

    return members.filter(({ bannedRights }) => Boolean(bannedRights));
  }, [members]);

  const getMemberExceptions = useCallback((member: ApiChatMember) => {
    const { bannedRights } = member;
    if (!bannedRights || !chat) {
      return undefined;
    }

    const { defaultBannedRights } = chat;

    return Object.keys(bannedRights).reduce((result, k) => {
      const key = k as keyof ApiChatBannedRights;
      if (
        !bannedRights[key]
        || (defaultBannedRights?.[key])
        || key === 'sendInline' || key === 'viewMessages' || key === 'sendGames'
      ) {
        return result;
      }

      const langKey = getLangKeyForBannedRightKey(key);

      if (!langKey) {
        return result;
      }

      const translatedString = oldLang(langKey);

      return `${result}${!result.length ? translatedString : `, ${translatedString}`}`;
    }, '');
  }, [chat, oldLang]);

  const handleChargeStarsForMessages = useLastCallback(() => {
    setIsPriceForMessagesOpen(!isPriceForMessagesOpen);
    markPriceForMessagesChanged();
  });

  const handleChargeForMessagesChange = useLastCallback((value: number) => {
    setChargeForMessages(value);
    markPriceForMessagesChanged();
  });

  const arePermissionsChanged = isPriceForMessagesChanged || havePermissionChanged;
  const arePermissionsLoading = progress === ManagementProgress.InProgress || isLoading;

  return (
    <div
      className="Management with-shifted-dropdown"
      style={`--shift-height: ${ITEMS_COUNT * ITEM_HEIGHT}px;`
        + `--before-shift-height: ${BEFORE_ITEMS_COUNT * ITEM_HEIGHT}px;`}
    >
      <div className="panel-content custom-scroll">
        <div className="section without-bottom-shadow">
          <h3 className="section-heading" dir="auto">{lang('ChannelPermissionsHeader')}</h3>
          <PermissionCheckboxList
            chatId={chat?.id}
            isMediaDropdownOpen={isMediaDropdownOpen}
            setIsMediaDropdownOpen={setIsMediaDropdownOpen}
            handlePermissionChange={handlePermissionChange}
            permissions={permissions}
            dropdownClassName="DropdownListTrap"
            className={buildClassName(
              'DropdownList',
              isMediaDropdownOpen && 'DropdownList--open',
            )}
            shiftedClassName={buildClassName('part', isMediaDropdownOpen && 'shifted')}
          />
        </div>

        {arePaidMessagesAvailable && (
          <div
            className={buildClassName(
              'section',
              isMediaDropdownOpen && 'shifted',
            )}
          >
            <ListItem onClick={handleChargeStarsForMessages}>
              <span>{lang('GroupMessagesChargePrice')}</span>
              <Switcher
                id="charge_for_messages"
                label={lang('GroupMessagesChargePrice')}
                checked={isPriceForMessagesOpen}
              />
            </ListItem>
            <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('RightsChargeStarsAbout')}
            </p>
          </div>
        )}

        {isPriceForMessagesOpen && (
          <div
            className={buildClassName(
              'section',
              isMediaDropdownOpen && 'shifted',
            )}
          >
            <PaidMessagePrice
              canChangeChargeForMessages
              isGroupChat
              chargeForMessages={chargeForMessages}
              onChange={handleChargeForMessagesChange}
            />
          </div>
        )}

        <div
          className={buildClassName(
            'section',
            isMediaDropdownOpen && 'shifted',
          )}
        >
          <ListItem
            icon="delete-user"
            multiline
            narrow
            onClick={handleRemovedUsersClick}
          >
            <span className="title">{lang('ChannelBlockedUsers')}</span>
            <span className="subtitle">{removedUsersCount}</span>
          </ListItem>
        </div>

        <div
          className={buildClassName(
            'section',
            isMediaDropdownOpen && 'shifted',
          )}
        >
          <h3 className="section-heading" dir="auto">{lang('PrivacyExceptions')}</h3>

          <ListItem
            icon="add-user"
            onClick={handleAddExceptionClick}
          >
            {lang('ChannelAddException')}
          </ListItem>

          {exceptionMembers.map((member) => (
            <ListItem
              key={member.userId}
              className="chat-item-clickable exceptions-member"

              onClick={() => handleExceptionMemberClick(member)}
            >
              <PrivateChatInfo
                userId={member.userId}
                status={getMemberExceptions(member)}
                forceShowSelf
              />
            </ListItem>
          ))}
        </div>
      </div>

      <FloatingActionButton
        isShown={arePermissionsChanged}
        onClick={handleUpdatePermissions}
        ariaLabel={lang('Save')}
        disabled={arePermissionsLoading}
        iconName="check"
        isLoading={arePermissionsLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const fullInfo = selectChatFullInfo(global, chatId);
    const { progress } = selectTabState(global).management;

    const paidMessagesStars = chat?.paidMessagesStars;
    const configStarsPaidMessageCommissionPermille = global.appConfig.starsPaidMessageCommissionPermille;

    return {
      chat,
      progress,
      currentUserId: global.currentUserId,
      removedUsersCount: fullInfo?.kickedMembers?.length || 0,
      members: fullInfo?.members,
      arePaidMessagesAvailable: Boolean(fullInfo?.arePaidMessagesAvailable && configStarsPaidMessageCommissionPermille),
      canChargeForMessages: Boolean(paidMessagesStars && configStarsPaidMessageCommissionPermille),
      groupPeersPaidStars: paidMessagesStars || DEFAULT_CHARGE_FOR_MESSAGES,
    };
  },
)(ManageGroupPermissions));
