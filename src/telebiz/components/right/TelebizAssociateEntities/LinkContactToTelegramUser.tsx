import { memo, useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiUser } from '../../../../api/types';
import type {
  LinkProviderEntityData,
  Organization,
  ProviderContact,
  ProviderEntity,
  ProviderRelationship,
} from '../../../services';
import { TelebizPanelScreens } from '../types';

import { getMainUsername } from '../../../../global/helpers';
import { selectCurrentMessageList, selectUser } from '../../../../global/selectors';
import {
  selectCurrentTelebizOrganization,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';
import { ProviderEntityType } from '../../../services';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ProfileInfo from '../../../../components/common/profile/ProfileInfo';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';
import RelationshipLinkView from '../TelebizAddRelationship/RelationshipLinkView';

import styles from '../TelebizAddRelationship/TelebizAddRelationship.module.scss';

interface OwnProps {
  userId: string;
  contact: ProviderContact;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  currentOrganization?: Organization;
  user?: ApiUser;
};

const LinkContactToTelegramUser = ({
  userId,
  contact,
  selectedRelationship,
  currentOrganization,
  user,
}: OwnProps & StateProps) => {
  const { openTelebizPanelScreen, linkTelebizEntity } = getActions();
  const lang = useTelebizLang();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId || !contact) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [userId, contact, openTelebizPanelScreen]);

  const onLink = useCallback(() => {
    setIsLoading(true);
    if (!contact || !selectedRelationship) return;

    const finalEntityId = contact.id;

    const linkData: LinkProviderEntityData = {
      integrationId: selectedRelationship.integration_id,
      telegramId: userId,
      telegramHandle: user ? getMainUsername(user) : undefined,
      organizationId: currentOrganization?.id,
      entityType: ProviderEntityType.Contact,
      entityId: finalEntityId,
    };

    try {
      linkTelebizEntity(linkData);
      setIsLoading(false);
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  }, [contact,
    selectedRelationship,
    userId,
    currentOrganization?.id,
    linkTelebizEntity,
    openTelebizPanelScreen,
    user,
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <RelationshipLinkView
          parentEntity={contact as unknown as ProviderEntity}
          parentEntityType={ProviderEntityType.Contact}
        >
          <ProfileInfo
            peerId={userId}
            canPlayVideo={false}
            isExpanded={false}
          />
        </RelationshipLinkView>
      </div>
      <FloatingActionButton
        isShown
        onClick={onLink}
        disabled={isLoading}
        ariaLabel={lang('AddRelationshipPanel.LinkTelegramUser.Link')}
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};

    return {
      selectedRelationship: chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined,
      currentOrganization: selectCurrentTelebizOrganization(global),
      user: selectUser(global, userId),
    };
  },
)(LinkContactToTelegramUser));
