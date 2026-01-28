import { memo } from '@teact';
import { getActions } from '../../../../global';

import type { Integration } from '../../../services/types';
import { TelebizSettingsScreens } from '../../left/types';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import ShieldWarningFill from '../../icons/ShieldWarningFill';

import styles from './TelebizIntegrationNotAvailable.module.scss';

const TelebizIntegrationNotAvailable = ({ integration }: { integration?: Partial<Integration> }) => {
  const { openTelebizSettingsScreen } = getActions();
  const lang = useTelebizLang();

  const integrationName = integration?.provider?.display_name;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <img src="/providers/placeholder.svg" alt="No integrations" />
          <div>
            <div className={styles.title}>{lang('Integration not available')}</div>
            <div className={styles.description}>
              You need to connect
              {' '}
              {integrationName}
              {' '}
              to view this entity.
            </div>
          </div>
        </div>
        <div className={styles.details}>
          <ul>
            <li>Link chats to deals, contacts, or other records</li>
            <li>Sync meetings, tasks, and notes in real time</li>
            <li>More features coming soon ...</li>
          </ul>
        </div>
        <div className={styles.footer}>
          <Button onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Integrations })}>
            Connect
            {' '}
            {integrationName}
          </Button>
          <div className={styles.privacy}>
            <ShieldWarningFill />
            <span>
              Telebiz will never save or log your data without your permission.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TelebizIntegrationNotAvailable);
