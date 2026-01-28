import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Integration, Organization } from '../../../services/types';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../left/types';

import {
  selectCurrentTelebizOrganization,
  selectTelebizIntegrationsList,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';

import styles from './TelebizAddRelationship.module.scss';

type OwnProps = {
  selectedIntegrationId?: number;
};

type StateProps = {
  currentOrganization?: Organization;
  integrations: Integration[];
};

const CompleteSteps: FC<OwnProps & StateProps> = ({
  selectedIntegrationId,
  currentOrganization,
  integrations,
}) => {
  const lang = useTelebizLang();
  const selectedIntegration = integrations.find((it) => it.id === selectedIntegrationId);

  const { openTelebizSettingsScreen, openLeftColumnContent } = getActions();

  const openTelebizSettings = useCallback((screen: TelebizSettingsScreens) => {
    openLeftColumnContent({
      contentKey: LeftColumnContent.Telebiz,
    });
    openTelebizSettingsScreen({
      screen,
    });
  }, [openLeftColumnContent, openTelebizSettingsScreen]);

  const Step: FC<{
    number: number;
    checked: boolean;
    disabled: boolean;
    title: string;
    screen: TelebizSettingsScreens;
    screenName: string;
  }> = memo(({
    number,
    checked,
    disabled,
    title,
    screen,
    screenName,
  }) => {
    return (
      <div className={buildClassName(
        styles.completeStepsWarningStep, (checked || disabled) && styles.completeStepsWarningStepInactive,
      )}
      >
        <div className={buildClassName(
          styles.completeStepsWarningStepIcon, checked && styles.completeStepsWarningStepIconCheck,
        )}
        >
          {checked ? <Icon name="check" /> : number}
        </div>
        <div>
          {title}
          {' '}
          <span
            className={styles.link}
            onClick={() => {
              openTelebizSettings(TelebizSettingsScreens.Main);
            }}
          >
            {lang('Telebiz Settings')}
          </span>
          {' '}
          →
          {' '}
          <span
            className={buildClassName(styles.link, styles.linkActive)}
            onClick={() => {
              openTelebizSettings(screen);
            }}
          >
            {screenName}
          </span>
        </div>
      </div>
    );
  });

  return (
    <div className={styles.completeStepsWarning}>
      <div className={styles.completeStepsWarningMessage}>
        {lang('To be able to use Telebiz, you need to complete the following steps:')}
      </div>
      <div className={styles.completeStepsWarningSteps}>
        <Step
          number={1}
          disabled={false}
          checked={Boolean(currentOrganization)}
          title={lang('Join an organization')}
          screen={TelebizSettingsScreens.Organizations}
          screenName={lang('Organizations')}
        />
        <Step
          number={2}
          disabled={!currentOrganization}
          checked={Boolean(selectedIntegration)}
          title={lang('Connect a provider')}
          screen={TelebizSettingsScreens.Integrations}
          screenName={lang('Integrations')}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    currentOrganization: selectCurrentTelebizOrganization(global),
    integrations: selectTelebizIntegrationsList(global),
  }),
)(CompleteSteps));
