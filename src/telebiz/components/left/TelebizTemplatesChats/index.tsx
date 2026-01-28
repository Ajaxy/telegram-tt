import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';
import { TelebizSettingsScreens } from '../types';

import { selectTelebizTemplatesChatsList } from '../../../global/selectors/templatesChats';
import buildClassName from '../../../../util/buildClassName';
import { isUserId } from '../../../../util/entities/ids';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import GroupChatInfo from '../../../../components/common/GroupChatInfo';
import PrivateChatInfo from '../../../../components/common/PrivateChatInfo';
import ListItem from '../../../../components/ui/ListItem';
import ShieldWarningFill from '../../icons/ShieldWarningFill';

import styles from './TelebizTemplatesChats.module.scss';

interface StateProps {
  templatesChats: string[];
}

const TelebizTemplatesChats = ({ templatesChats }: StateProps) => {
  const { openTelebizSettingsScreen, openChat, telebizOpenFeaturesModal } = getActions();

  const lang = useTelebizLang();

  const onAddChats = () => {
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.ManageTemplatesChats });
  };

  const renderChats = () => {
    return (
      <>
        {templatesChats.map((chatId) => (
          <ListItem
            key={chatId}
            className={styles.settingsFoldersListItem}
            onClick={() => openChat({ id: chatId, shouldReplaceHistory: true })}
            narrow
          >
            {isUserId(chatId) ? (
              <PrivateChatInfo avatarSize="small" userId={chatId} noStatusOrTyping />
            ) : (
              <GroupChatInfo avatarSize="small" chatId={chatId} noStatusOrTyping />
            )}
          </ListItem>
        ))}
      </>
    );
  };

  return (
    <div className="settings-content no-border custom-scroll">
      <div id="telebiz-templates-chats">
        <div className="settings-item">
          <h4 className="settings-item-header">
            {lang('TemplatesChats.Description')}
          </h4>
          <p className="settings-item-description pt-1">
            Turn any group or private chat into a Templates Chat. Once designated, all messages in that chat
            become available to send in any other chat.
            {' '}
            <a
              className="text-entity-link"
              onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.MessageTemplates })}
            >
              {lang('TelebizFeatures.LearnMoreShort')}
            </a>
          </p>

          <ListItem
            icon="add"
            narrow
            withPrimaryColor
            onClick={onAddChats}
          >
            {lang('TemplatesChats.AddChats')}
          </ListItem>
          {renderChats()}
          <p className="settings-item-description pt-2">
            *
            {' '}
            {lang('TemplatesChats.BulkSendDescription')}
            {' '}
            <a
              className="text-entity-link"
              onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.BulkSend })}
            >
              {lang('TelebizFeatures.LearnMoreShort')}
            </a>
          </p>
          <div className={buildClassName(styles.hint, 'mt-4')}>
            <div className={styles.hintIcon}>
              <ShieldWarningFill />
            </div>
            <div className={styles.hintText}>
              Each group member must add this chats to their Templates Chats.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      templatesChats: selectTelebizTemplatesChatsList(global),
    };
  },
)(TelebizTemplatesChats));
