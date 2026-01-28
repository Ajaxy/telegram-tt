import { useCallback } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { TelebizPanelScreens } from '../components/right/types';

import { selectTabState } from '../../global/selectors';
import { selectTelebizIsAddingRelationship } from '../global/selectors';

export default function useTelebizPanel() {
  const closePanel = useCallback(() => {
    const {
      toggleTelebizPanel,
      openTelebizPanelScreen,
      setTelebizIsAddingRelationship,
    } = getActions();

    const global = getGlobal();
    const telebizPanelScreen = selectTabState(global).telebizPanelScreen;
    const isAddingRelationship = selectTelebizIsAddingRelationship(global);

    switch (telebizPanelScreen) {
      case TelebizPanelScreens.AgentMode:
        toggleTelebizPanel({ force: false });
        break;
      case TelebizPanelScreens.AgentHistory:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.AgentMode });
        break;
      case TelebizPanelScreens.Main:
        if (isAddingRelationship) {
          setTelebizIsAddingRelationship({ isAdding: false });
          openTelebizPanelScreen({ screen: TelebizPanelScreens.RelationshipsList });
        } else {
          toggleTelebizPanel({ force: false });
        }
        break;
      case TelebizPanelScreens.CreateContact:
      case TelebizPanelScreens.CreateDeal:
      case TelebizPanelScreens.CreateCompany:
      case TelebizPanelScreens.CreatePage:
      case TelebizPanelScreens.ConfirmLinkContact:
      case TelebizPanelScreens.ConfirmLinkDeal:
      case TelebizPanelScreens.ConfirmLinkPage:
      case TelebizPanelScreens.ConfirmLinkCompany:
      case TelebizPanelScreens.AddContactToEntity:
      case TelebizPanelScreens.AddCompanyToEntity:
      case TelebizPanelScreens.RelationshipsList:
      case TelebizPanelScreens.SelectTelegramUser:
      case TelebizPanelScreens.Settings:
      case TelebizPanelScreens.BulkSend:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
        break;
      case TelebizPanelScreens.CreateAndAddContactToEntity:
      case TelebizPanelScreens.AddExistingContactToEntity:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.AddContactToEntity });
        break;
      case TelebizPanelScreens.CreateAndAddCompanyToEntity:
      case TelebizPanelScreens.AddExistingCompanyToEntity:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.AddCompanyToEntity });
        break;
      case TelebizPanelScreens.LinkTelegramUser:
        openTelebizPanelScreen({ screen: TelebizPanelScreens.SelectTelegramUser });
        break;
      default:
        break;
    }
  }, []);

  return {
    closePanel,
  };
}
