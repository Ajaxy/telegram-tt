import { memo, useMemo, useRef } from '../../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../../global';

import type { ApiChatMember } from '../../../../../api/types';
import type { ProviderRelationship } from '../../../../services/types';
import { type ProviderContact, ProviderEntityType } from '../../../../services/types';
import { TelebizPanelScreens } from '../../types';

import { selectChatFullInfo, selectCurrentMessageList } from '../../../../../global/selectors';
import {
  selectTelebizRelationshipsByEntity,
  selectTelebizSelectedRelationship,
} from '../../../../global/selectors';
import buildClassName from '../../../../../util/buildClassName';
import { formatDate } from '../../../../util/dates';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';

import Icon from '../../../../../components/common/icons/Icon';
import PeerChip from '../../../../../components/common/PeerChip';
import Link from '../../../../../components/ui/Link';
import RelationshipItemContextMenu from '../RelationshipEntityContextMenu';

import commonItemCardStyles from '../RelationshipEntityCard.module.scss';
import styles from './Contacts.module.scss';

interface OwnProps {
  contact: ProviderContact;
  onContactSelected: (contact: ProviderContact) => void;
}

type StateProps = {
  relationshipsList: ProviderRelationship[];
  selectedRelationship?: ProviderRelationship;
  chatMembers?: ApiChatMember[];
};

const ContactCard = ({
  contact,
  onContactSelected,
  relationshipsList,
  selectedRelationship,
  chatMembers,
}: OwnProps & StateProps) => {
  const { openTelebizPanelScreen, openChat } = getActions();

  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const chatUsers = useMemo(() => chatMembers?.map((member) => member.userId) || [], [chatMembers]);

  const relationships = useMemo(() => {
    return relationshipsList.filter(
      (x: ProviderRelationship) =>
        String(x.entity_id) === String(contact.id)
        && x.entity_type === ProviderEntityType.Contact
        && x.integration_id === selectedRelationship?.integration_id,
    );
  }, [relationshipsList, contact.id, selectedRelationship?.integration_id]);

  const linkedToUserFromChat = useMemo(() => {
    return chatUsers.some((user) => relationships.map((x: ProviderRelationship) => x.telegram_id).includes(user));
  }, [chatUsers, relationships]);

  return (
    <div
      className={buildClassName(
        commonItemCardStyles.item,
        styles.item,
      )}
      onContextMenu={handleContextMenu}
      ref={ref}
    >
      <div className={styles.userContainer}>
        <div>
          <div className={commonItemCardStyles.itemHeader}>
            <div className={commonItemCardStyles.itemHeaderTitle}>
              <Icon name="user" className={styles.userIcon} />
              <div className={commonItemCardStyles.itemHighlight}>
                {contact.name}
              </div>
            </div>
          </div>
          <div className={commonItemCardStyles.itemBody}>
            <p className={commonItemCardStyles.itemText}>
              {contact.email ? `${String(contact.email)}` : ''}
              {contact.email && contact.phone ? ' \u2022 ' : ''}
              {contact.phone ? `${String(contact.phone)}` : ''}
            </p>
          </div>
          <div className={commonItemCardStyles.itemFooter}>
            <span className={commonItemCardStyles.itemType}>
              {contact.jobTitle ? `${String(contact.jobTitle)}` : ''}
              {contact.company && contact.jobTitle ? ' \u2022 ' : ''}
              {contact.company ? `${String(contact.company)}` : ''}
            </span>
            {contact.lastContact && (
              <span className={commonItemCardStyles.itemType}>
                Last contacted:
                {formatDate(contact.lastContact)}
              </span>
            )}
          </div>
          {!linkedToUserFromChat && (
            <Link
              className={styles.linkButton}
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                e.stopPropagation();
                onContactSelected(contact);
                openTelebizPanelScreen({ screen: TelebizPanelScreens.SelectTelegramUser });
              }}
            >
              Attach telegram user
            </Link>
          )}
          {
            relationships.map((x: ProviderRelationship) => (
              <PeerChip
                key={x.id}
                peerId={x.telegram_id}
                onClick={() => {
                  openChat({ id: x.telegram_id, shouldReplaceHistory: true });
                }}
                className={styles.itemContactChip}
              />
            ))
          }
        </div>
      </div>
      {contextMenuAnchor && (
        <RelationshipItemContextMenu
          type={ProviderEntityType.Contact}
          triggerRef={ref}
          entity={contact}
          rootElementClassName=".TelebizRelationship-module__tabContainer"
          isContextMenuOpen={isContextMenuOpen}
          contextMenuAnchor={contextMenuAnchor}
          handleContextMenuClose={handleContextMenuClose}
          handleContextMenuHide={handleContextMenuHide}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { contact }: OwnProps): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

    return {
      relationshipsList: selectTelebizRelationshipsByEntity(
        global,
        contact.id,
        ProviderEntityType.Contact,
        selectedRelationship?.integration_id || 0,
      ) || [],
      selectedRelationship,
      chatMembers: chatFullInfo?.members,
    };
  },
)(ContactCard));
