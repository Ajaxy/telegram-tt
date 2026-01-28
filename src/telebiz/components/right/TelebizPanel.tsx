import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { AnimationLevel } from '../../../types';
import type { ProviderContact, ProviderEntity } from '../../services/types';
import { ProviderEntityType } from '../../services/types';
import { TelebizPanelScreens } from './types';

import { selectChat, selectTabState } from '../../../global/selectors';
import { resolveTransitionName } from '../../../util/resolveTransitionName';

import useScrollNotch from '../../../hooks/useScrollNotch';

import Transition from '../../../components/ui/Transition';
import ConfirmLinkEntity from './TelebizAddRelationship/ConfirmLinkEntity';
import CreateEntity from './TelebizAddRelationship/CreateEntity';
import TelebizAgent from './TelebizAgent';
import AgentHistory from './TelebizAgent/AgentHistory';
import ConfirmAssociateEntity from './TelebizAssociateEntities/ConfirmAssociateEntity';
import CreateAndAssociateEntity from './TelebizAssociateEntities/CreateAndAssociate';
import LinkContactToTelegramUser from './TelebizAssociateEntities/LinkContactToTelegramUser';
import SelectTelegramUser from './TelebizAssociateEntities/SelectTelegramUser';
import TelebizAssociateEntities from './TelebizAssociateEntities/TelebizAssociateEntities';
import TelebizBulkSend from './TelebizBulkSend';
import TelebizChatSettings from './TelebizChatSettings';
import TelebizPanelMain from './TelebizPanelMain';
import TelebizRelationshipsList from './TelebizRelationshipsList';

import styles from './TelebizPanel.module.scss';

const TRANSITION_RENDER_COUNT = Object.keys(TelebizPanelScreens).length / 2;

const MAIN_SCREENS = [
  TelebizPanelScreens.Main,
  TelebizPanelScreens.RelationshipsList,
  TelebizPanelScreens.Settings,
  TelebizPanelScreens.AgentMode,
  TelebizPanelScreens.AgentHistory,
];

interface StateProps {
  isTelebizEnabled: boolean;
  isPrivateChat: boolean;
  telebizPanelScreen?: TelebizPanelScreens;
}

interface OwnProps {
  animationLevel: AnimationLevel;
  chatId: string;
}

const TelebizPanel: FC<OwnProps & StateProps> = ({
  animationLevel,
  telebizPanelScreen,
  chatId,
  isPrivateChat,
}) => {
  const { openTelebizPanelScreen, setTelebizActiveTab, setTelebizIsAddingRelationship } = getActions();
  const containerRef = useRef<HTMLDivElement>();
  const prevChatIdRef = useRef<string>(chatId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<ProviderEntityType | undefined>(undefined);
  const [selectedEntity, setSelectedEntity] = useState<ProviderEntity | undefined>(undefined);
  const [selectedTelegramUserId, setSelectedTelegramUserId] = useState<string | undefined>(undefined);

  const selectEntityType = useCallback((entityType: ProviderEntityType) => {
    setSelectedEntityType(entityType);
  }, []);

  // Reset to main screen when switching chats while on a creating screen
  useEffect(() => {
    setTelebizActiveTab({ tabIndex: 0 });
    if (prevChatIdRef.current !== chatId) {
      if (!MAIN_SCREENS.includes(telebizPanelScreen!)) {
        openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
        setTelebizActiveTab({ tabIndex: 0 });
      }
      setTelebizIsAddingRelationship({ isAdding: false });
      prevChatIdRef.current = chatId;
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [chatId, openTelebizPanelScreen, setTelebizActiveTab]);

  useEffect(() => {
    setSelectedEntityType(isPrivateChat ? ProviderEntityType.Contact : ProviderEntityType.Deal);
  }, [isPrivateChat]);

  const onSelectEntity = useCallback((entity: ProviderEntity, entityType: ProviderEntityType) => {
    setSelectedEntityType(entityType);
    setSelectedEntity(entity);
    switch (entityType) {
      case ProviderEntityType.Contact:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.ConfirmLinkContact });
        break;
      case ProviderEntityType.Deal:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.ConfirmLinkDeal });
        break;
      case ProviderEntityType.Company:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.ConfirmLinkCompany });
        break;
      case ProviderEntityType.Page:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.ConfirmLinkPage });
        break;
      default:
        break;
    }
  }, [openTelebizPanelScreen, setSelectedEntity, setSelectedEntityType]);

  const onSelectTelegramUser = useCallback((userId: string) => {
    setSelectedTelegramUserId(userId);
    openTelebizPanelScreen({ screen: TelebizPanelScreens.LinkTelegramUser });
  }, [openTelebizPanelScreen, setSelectedTelegramUserId]);

  useScrollNotch({
    containerRef,
    selector: '#TelebizPanel',
  }, [telebizPanelScreen]);

  function renderCurrentSectionContent() {
    switch (telebizPanelScreen) {
      case TelebizPanelScreens.Main:
        return (
          <TelebizPanelMain
            chatId={chatId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setSelectedEntity={onSelectEntity}
            setSelectedEntityType={selectEntityType}
            selectedEntityType={selectedEntityType!}
          />
        );
      case TelebizPanelScreens.RelationshipsList:
        return (
          <TelebizRelationshipsList
            chatId={chatId}
          />
        );
      case TelebizPanelScreens.CreateContact:
      case TelebizPanelScreens.CreateDeal:
      case TelebizPanelScreens.CreatePage:
      case TelebizPanelScreens.CreateCompany:
        if (!selectedEntityType) return undefined;
        return (
          <CreateEntity
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            chatId={chatId}
            entityType={selectedEntityType}
          />
        );
      case TelebizPanelScreens.ConfirmLinkContact:
      case TelebizPanelScreens.ConfirmLinkDeal:
      case TelebizPanelScreens.ConfirmLinkCompany:
      case TelebizPanelScreens.ConfirmLinkPage:
        if (!selectedEntity || !selectedEntityType) return undefined;
        return (
          <ConfirmLinkEntity
            entity={selectedEntity}
            entityType={selectedEntityType}
            chatId={chatId}
            setSearchQuery={setSearchQuery}
          />
        );
      case TelebizPanelScreens.AddContactToEntity:
        return (
          <TelebizAssociateEntities
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onEntitySelected={(entity) => {
              setSelectedEntity(entity);
              setSelectedEntityType(ProviderEntityType.Contact);
            }}
            entityType={ProviderEntityType.Contact}
          />
        );
      case TelebizPanelScreens.CreateAndAddContactToEntity:
        return (
          <CreateAndAssociateEntity
            searchQuery={searchQuery}
            chatId={chatId}
            setSearchQuery={setSearchQuery}
            entityType={ProviderEntityType.Contact}
          />
        );
      case TelebizPanelScreens.AddExistingContactToEntity:
        return (
          <ConfirmAssociateEntity
            entity={selectedEntity!}
            setSearchQuery={setSearchQuery}
            entityType={ProviderEntityType.Contact}
          />
        );
      case TelebizPanelScreens.AddCompanyToEntity:
        return (
          <TelebizAssociateEntities
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onEntitySelected={(entity) => {
              setSelectedEntity(entity);
              setSelectedEntityType(ProviderEntityType.Company);
            }}
            entityType={ProviderEntityType.Company}
          />
        );
      case TelebizPanelScreens.CreateAndAddCompanyToEntity:
        return (
          <CreateAndAssociateEntity
            searchQuery={searchQuery}
            chatId={chatId}
            setSearchQuery={setSearchQuery}
            entityType={ProviderEntityType.Company}
          />
        );
      case TelebizPanelScreens.AddExistingCompanyToEntity:
        return (
          <ConfirmAssociateEntity
            entity={selectedEntity!}
            setSearchQuery={setSearchQuery}
            entityType={ProviderEntityType.Company}
          />
        );
      case TelebizPanelScreens.SelectTelegramUser:
        return (
          <SelectTelegramUser
            chatId={chatId}
            onUserSelected={onSelectTelegramUser}
            selectedContact={selectedEntity as ProviderContact}
          />
        );
      case TelebizPanelScreens.LinkTelegramUser:
        return (
          <LinkContactToTelegramUser
            userId={selectedTelegramUserId!}
            contact={selectedEntity as ProviderContact}
          />
        );
      case TelebizPanelScreens.Settings:
        return (
          <TelebizChatSettings chatId={chatId} />
        );
      case TelebizPanelScreens.AgentMode:
        return (
          <TelebizAgent />
        );
      case TelebizPanelScreens.AgentHistory:
        return (
          <AgentHistory />
        );
      case TelebizPanelScreens.BulkSend:
        return (
          <TelebizBulkSend chatId={chatId} />
        );
      default:
        return (
          <div className="settings-content custom-scroll">
            <div>
              Unknown screen:
              {telebizPanelScreen}
            </div>
          </div>
        );
    }
  }

  return (
    <Transition
      ref={containerRef}
      id="TelebizPanel"
      className={styles.telebizPanel}
      name={resolveTransitionName('layers', animationLevel, false)}
      activeKey={telebizPanelScreen!}
      renderCount={TRANSITION_RENDER_COUNT}
      shouldWrap
      withSwipeControl
    >
      {renderCurrentSectionContent}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const isTelebizEnabled = true;
    const { telebizPanelScreen } = selectTabState(global);
    const isPrivateChat = chat ? chat.type === 'chatTypePrivate' : false;
    return {
      telebizPanelScreen,
      isTelebizEnabled,
      isPrivateChat,
    };
  },
)(TelebizPanel));
