import { memo, useEffect, useState } from '@teact';

import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ChartDonutFill from '../../icons/ChartDonutFill';
import FileDashedFill from '../../icons/FileDashedFill';
import Logo from '../../icons/Logo';
import PlugsFill from '../../icons/PlugsFill';
import ShieldWarningFill from '../../icons/ShieldWarningFill';
import StarsBg from '../../icons/StarsBg';

import styles from './TelebizWelcomeModal.module.scss';

interface TelebizWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

const FEATURES = [
  {
    icon: <ChartDonutFill />,
    titleKey: 'TelebizWelcome.Features.CRM.Title' as const,
    descKey: 'TelebizWelcome.Features.CRM.Description' as const,
  },
  {
    icon: <FileDashedFill />,
    titleKey: 'TelebizWelcome.Features.Templates.Title' as const,
    descKey: 'TelebizWelcome.Features.Templates.Description' as const,
  },
  {
    icon: <PlugsFill />,
    titleKey: 'TelebizWelcome.Features.AI.Title' as const,
    descKey: 'TelebizWelcome.Features.AI.Description' as const,
  },
  /* {
    icon: <ChartDonutFill />,
    titleKey: 'TelebizWelcome.Features.Analytics.Title' as const,
    descKey: 'TelebizWelcome.Features.Analytics.Description' as const,
  }, */
  {
    icon: <PlugsFill />,
    titleKey: 'TelebizWelcome.Features.Integrations.Title' as const,
    descKey: 'TelebizWelcome.Features.Integrations.Description' as const,
  },
];

const TelebizWelcomeModal = ({
  isOpen,
  onClose,
  onLogin,
}: TelebizWelcomeModalProps) => {
  const lang = useTelebizLang();

  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = useLastCallback(() => {
    setIsLoading(true);
    onLogin();
  });

  useEffect(() => {
    if (!isOpen && isLoading) {
      setIsLoading(false);
    }
  }, [isOpen, isLoading]);

  return (
    <Modal
      className={styles.welcomeModal}
      isOpen={isOpen}
      onClose={onClose}
      contentClassName={styles.welcomeContent}
    >
      {/* <Button
        round
        color="translucent"
        size="smaller"
        className={styles.close}button"
        onClick={onClose}
      >
        <Icon name="close" />
      </Button> */}
      <div className={styles.welcomeContent}>
        {/* Header with logo/icon */}
        <div className={styles.welcomeHeader}>
          <div className={styles.welcomeIcon}>
            <StarsBg />
            <Logo className={styles.welcomeIconLogo} />
          </div>
          <h2 className={styles.welcomeTitle}>{lang('TelebizWelcome.Subtitle')}</h2>
          <p className={styles.welcomeDescription}>
            {lang('TelebizWelcome.Description')}
          </p>
        </div>

        {/* Features list */}
        <div className={styles.welcomeFeatures}>
          <div className={styles.featuresTitle}>{lang('TelebizWelcome.Features.Title')}</div>
          <div className={styles.featuresList}>
            {FEATURES.map((feature) => (
              <div key={feature.titleKey} className={styles.featureItem}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <div className={styles.featureContent}>
                  <h4 className={styles.featureTitle}>{lang(feature.titleKey)}</h4>
                  <p className={styles.featureDescription}>{lang(feature.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy and trust section */}
        <div className={styles.welcomePrivacy}>
          <div className={styles.privacyIcon}><ShieldWarningFill /></div>
          <div className={styles.privacyContainer}>
            <div className={styles.privacyHeader}>
              <div className={styles.privacyContent}>
                <h3 className={styles.privacyTitle}>{lang('TelebizWelcome.Privacy.Title')}</h3>
                <p className={styles.privacyDescription}>
                  {lang('TelebizWelcome.Privacy.Description')}
                </p>
              </div>
            </div>
            <ul className={styles.privacyPoints}>
              <li>{lang('TelebizWelcome.Privacy.Point1')}</li>
              <li>{lang('TelebizWelcome.Privacy.Point2')}</li>
              <li>{lang('TelebizWelcome.Privacy.Point3')}</li>
            </ul>
          </div>
        </div>

        {/* Folder explanation */}
        {/* <div className={styles.welcomeFolder}>
          <div className={styles.folderIcon}>📁</div>
          <h3 className={styles.folderTitle}>{lang('TelebizWelcome.Folder.Title')}</h3>
          <p className={styles.folderDescription}>
            {lang('TelebizWelcome.Folder.Description')}
          </p>
        </div> */}

        {/* Action buttons */}
        <div className={styles.welcomeActions}>
          <Button
            className={buildClassName(styles.welcomeButton, 'primary')}
            onClick={handleGetStarted}
            size="default"
            isLoading={isLoading}
          >
            {lang('TelebizWelcome.GetStarted')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(TelebizWelcomeModal);
