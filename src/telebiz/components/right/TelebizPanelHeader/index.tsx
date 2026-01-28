import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ProviderRelationship } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { selectCurrentMessageList, selectTabState } from '../../../../global/selectors';
import { selectTelebizIsAddingRelationship, selectTelebizSelectedRelationship } from '../../../global/selectors';
import { selectIsTelebizTemplatesChat } from '../../../global/selectors/templatesChats';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import NewAiChat from '../../icons/NewAiChat';
import AIProviderSwitcher from './AIProviderSwitcher';
import TelebizPanelHeader from './TelebizPanelHeader';

type StateProps = {
  telebizPanelScreen: TelebizPanelScreens;
  selectedRelationship?: ProviderRelationship;
  isAddingRelationship?: boolean;
  isTemplatesChat?: boolean;
};

const Header: FC<StateProps> = ({
  telebizPanelScreen,
  selectedRelationship,
  isAddingRelationship,
  isTemplatesChat,
}) => {
  const { openTelebizPanelScreen, createAgentConversation, setTelebizIsAddingRelationship } = getActions();
  const lang = useTelebizLang();

  const handleOpenHistory = useLastCallback(() => {
    openTelebizPanelScreen({ screen: TelebizPanelScreens.AgentHistory });
  });

  const handleNewChat = useLastCallback(() => {
    createAgentConversation();
    openTelebizPanelScreen({ screen: TelebizPanelScreens.AgentMode });
  });

  switch (telebizPanelScreen) {
    case TelebizPanelScreens.Main: {
      // For templates chats, show a simple header without integration/relationship buttons
      if (isTemplatesChat) {
        return (
          <TelebizPanelHeader
            title={lang('BulkSend.Title')}
            withIntegrationIcon={false}
          />
        );
      }
      const title = isAddingRelationship || !selectedRelationship?.entity_type
        ? lang('RelationshipPanelHeader.NewRelationship')
        : selectedRelationship?.entity_type;
      return (
        <TelebizPanelHeader
          title={title}
          withIntegrationIcon
          ctaButton={!isAddingRelationship && (
            <Button
              round
              size="smaller"
              color="translucent"
              onClick={() => openTelebizPanelScreen({ screen: TelebizPanelScreens.RelationshipsList })}
              ariaLabel={lang('RelationshipPanelMenu.ViewAll')}
              iconName="forums"
            />
          )}
        />
      );
    }
    case TelebizPanelScreens.CreateContact:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.CreateContact')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.CreateDeal:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.CreateDeal')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.CreateCompany:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.CreateCompany')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.CreatePage:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.CreatePage')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.ConfirmLinkContact:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.LinkContactToChat')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.ConfirmLinkDeal:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.LinkDealToChat')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.ConfirmLinkCompany:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.LinkCompanyToChat')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.ConfirmLinkPage:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.LinkPageToChat')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.AddContactToEntity:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AddContactToEntity')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.CreateAndAddContactToEntity:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.CreateNewContact')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.AddExistingContactToEntity:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AddContactToEntity')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.AddCompanyToEntity:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AddCompanyToEntity')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.CreateAndAddCompanyToEntity:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.CreateNewCompany')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.AddExistingCompanyToEntity:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AddCompanyToEntity')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.LinkTelegramUser:
    case TelebizPanelScreens.SelectTelegramUser:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.LinkUser')}
          withIntegrationIcon
        />
      );
    case TelebizPanelScreens.RelationshipsList:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AllRelationships')}
          withIntegrationIcon={false}
          ctaButton={(
            <Button
              round
              size="smaller"
              color="translucent"
              iconName="add"
              onClick={() => {
                setTelebizIsAddingRelationship({ isAdding: true });
                openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
              }}
            />
          )}
        />
      );
    case TelebizPanelScreens.Settings:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.Settings')}
          withIntegrationIcon={false}
        />
      );
    case TelebizPanelScreens.AgentMode:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AgentMode')}
          withIntegrationIcon={false}
          ctaButton={(
            <>
              <AIProviderSwitcher />
              <Button
                round
                size="smaller"
                color="translucent"
                onClick={handleOpenHistory}
                ariaLabel={lang('Agent.History')}
                iconName="clock"
              />
            </>
          )}
        />
      );
    case TelebizPanelScreens.AgentHistory:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.AgentHistory')}
          withIntegrationIcon={false}
          ctaButton={(
            <Button
              round
              size="smaller"
              color="translucent"
              onClick={handleNewChat}
              ariaLabel={lang('Agent.NewChat')}
            >
              <NewAiChat />
            </Button>
          )}
        />
      );
    case TelebizPanelScreens.BulkSend:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.BulkSend')}
          withIntegrationIcon={false}
        />
      );
    default:
      return (
        <TelebizPanelHeader
          title={lang('RelationshipPanelHeader.Telebiz')}
          withIntegrationIcon={false}
        />
      );
  }
};

export default memo(withGlobal(
  (global): StateProps => {
    const { telebizPanelScreen } = selectTabState(global);
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId
      ? selectTelebizSelectedRelationship(global, chatId)
      : undefined;
    const isTemplatesChat = chatId
      ? selectIsTelebizTemplatesChat(global, chatId)
      : false;

    return {
      telebizPanelScreen: telebizPanelScreen || TelebizPanelScreens.Main,
      selectedRelationship,
      isAddingRelationship: selectTelebizIsAddingRelationship(global),
      isTemplatesChat,
    };
  },
)(Header));
