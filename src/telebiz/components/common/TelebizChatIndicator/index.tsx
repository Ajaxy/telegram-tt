import { memo } from '@teact';
import { withGlobal } from '../../../../global';
import { selectChatHasTelebizNotifications, selectTelebizChatRelationships } from '../../../global';

import type { ProviderRelationship } from '../../../services';

import { selectTelebizChatSettings } from '../../../global/selectors/settings';
import { selectIsTelebizTemplatesChat } from '../../../global/selectors/templatesChats';
import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';

import styles from './TelebizChatIndicator.module.scss';

type OwnProps = {
  chatId: string;
};

type StateProps = {
  relationships: ProviderRelationship[];
  isTemplatesChat: boolean;
  hasNotifications: boolean;
  hasFollowupsEnabled: boolean;
};

const TelebizChatIndicator = ({
  relationships, isTemplatesChat, hasNotifications, hasFollowupsEnabled,
}: OwnProps & StateProps) => {
  const hasRelationships = relationships.length > 0;

  if (!hasRelationships && !isTemplatesChat && !hasNotifications && !hasFollowupsEnabled) return undefined;

  // Determine indicator style - notifications take priority
  const indicatorStyle = hasNotifications
    ? styles.notification
    : isTemplatesChat
      ? styles.templates
      : hasRelationships
        ? styles.entity
        : undefined;

  const shouldShowBar = hasRelationships || isTemplatesChat || hasNotifications;

  return (
    <>
      {shouldShowBar && (
        <div className={buildClassName(styles.chatIndicator, indicatorStyle)} />
      )}
      {hasFollowupsEnabled && (
        <Icon name="timer" className={styles.followupsIcon} />
      )}
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => ({
    isTemplatesChat: selectIsTelebizTemplatesChat(global, chatId),
    relationships: selectTelebizChatRelationships(global, chatId),
    hasNotifications: selectChatHasTelebizNotifications(global, chatId),
    hasFollowupsEnabled: selectTelebizChatSettings(global, chatId)?.followup_enabled ?? false,
  }),
)(TelebizChatIndicator));
