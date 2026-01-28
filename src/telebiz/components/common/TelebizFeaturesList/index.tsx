import { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';

import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';
import ListItem from '../../../../components/ui/ListItem';
import AgentMode from '../../icons/AgentMode';
import TasksIcon from '../../icons/TasksIcon';

import styles from './TelebizFeaturesList.module.scss';

type FeatureIconColor = 'primary' | 'orange' | 'yellow' | 'teal' | 'blue' | 'purple';

function FeatureIcon({ icon, color, customIcon }: {
  icon?: string;
  color: FeatureIconColor;
  customIcon?: React.ReactNode;
}) {
  const colorClass = `featureIcon${color.charAt(0).toUpperCase()}${color.slice(1)}`;
  return (
    <span className={buildClassName(styles.featureIcon, styles[colorClass])}>
      {customIcon || <Icon name={icon as any} />}
    </span>
  );
}

type OwnProps = {
  showWelcome?: boolean;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
};

const TelebizFeaturesList = ({
  showWelcome = false,
  welcomeTitle = 'Explore Telebiz',
  welcomeSubtitle = 'Discover features to supercharge your Telegram',
}: OwnProps) => {
  const { telebizOpenFeaturesModal } = getActions();

  return (
    <div className={styles.featurePromo}>
      {showWelcome && (
        <div className={styles.featurePromoWelcome}>
          <h3 className={styles.featurePromoWelcomeTitle}>{welcomeTitle}</h3>
          <p className={styles.featurePromoWelcomeSubtitle}>{welcomeSubtitle}</p>
        </div>
      )}

      <div className={styles.featureList}>
        <ListItem
          className={styles.featureListItem}
          multiline
          leftElement={<FeatureIcon icon="link" color="primary" />}
          onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.CrmIntegration })}
        >
          <span className={styles.featureListTitle}>CRM Integration</span>
          <span className={styles.featureListDesc}>Connect HubSpot, Pipedrive, or Notion</span>
        </ListItem>
        <ListItem
          className={styles.featureListItem}
          multiline
          leftElement={<FeatureIcon icon="document" color="orange" />}
          onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.MessageTemplates })}
        >
          <span className={styles.featureListTitle}>Message Templates</span>
          <span className={styles.featureListDesc}>Turn any chat into a template source</span>
        </ListItem>
        <ListItem
          className={styles.featureListItem}
          multiline
          leftElement={<FeatureIcon color="yellow" customIcon={<AgentMode />} />}
          onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.AiAgent })}
        >
          <span className={styles.featureListTitle}>AI Agent</span>
          <span className={styles.featureListDesc}>Bring your own LLM via OpenRouter</span>
        </ListItem>
        <ListItem
          className={styles.featureListItem}
          multiline
          leftElement={<FeatureIcon icon="schedule" color="teal" />}
          onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.AutomatedFollowups })}
        >
          <span className={styles.featureListTitle}>Automated Follow-ups</span>
          <span className={styles.featureListDesc}>Get notified when chats go silent</span>
        </ListItem>
        <ListItem
          className={styles.featureListItem}
          multiline
          leftElement={<FeatureIcon icon="calendar" color="blue" />}
          onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.MessageReminders })}
        >
          <span className={styles.featureListTitle}>Message Reminders</span>
          <span className={styles.featureListDesc}>Right-click any message to set a reminder</span>
        </ListItem>
        <ListItem
          className={styles.featureListItem}
          multiline
          leftElement={<FeatureIcon color="purple" customIcon={<TasksIcon />} />}
          onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.FocusMode })}
        >
          <span className={styles.featureListTitle}>Tasks Mode</span>
          <span className={styles.featureListDesc}>See chats based on your follow-up rules</span>
        </ListItem>
      </div>

      <div className={styles.featurePromoFooter}>
        <span
          className={styles.featurePromoLearnMore}
          onClick={() => telebizOpenFeaturesModal()}
          role="button"
          tabIndex={0}
        >
          <Icon name="info" />
          See all features
        </span>
      </div>
    </div>
  );
};

export default memo(TelebizFeaturesList);
