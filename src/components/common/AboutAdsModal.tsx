import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useSelectorSignal from '../../hooks/useSelectorSignal';

import Button from '../ui/Button';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import Separator from '../ui/Separator';
import Icon from './Icon';
import SafeLink from './SafeLink';

import styles from './AboutAdsModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  isRevenueSharing?: boolean;
  onClose: NoneToVoidFunction;
};

const AboutAdsModal: FC<OwnProps> = ({
  isOpen,
  isRevenueSharing,
  onClose,
}) => {
  const lang = useLang();

  const minLevelSignal = useSelectorSignal((global) => global.appConfig?.channelRestrictAdsLevelMin);
  const minLevelToRestrictAds = useDerivedState(minLevelSignal);

  const regularAdContent = useMemo(() => {
    return (
      <>
        <h3>{lang('SponsoredMessageInfoScreen.Title')}</h3>
        <p>{renderText(lang('SponsoredMessageInfoDescription1'), ['br'])}</p>
        <p>{renderText(lang('SponsoredMessageInfoDescription2'), ['br'])}</p>
        <p>{renderText(lang('SponsoredMessageInfoDescription3'), ['br'])}</p>
        <p>
          <SafeLink
            url={lang('SponsoredMessageAlertLearnMoreUrl')}
            text={lang('SponsoredMessageAlertLearnMoreUrl')}
          />
        </p>
        <p>{renderText(lang('SponsoredMessageInfoDescription4'), ['br'])}</p>
      </>
    );
  }, [lang]);

  const revenueSharingAdContent = useMemo(() => {
    return (
      <>
        <div className={styles.topIcon}><Icon name="channel" /></div>
        <h3 className={styles.title}>{lang('AboutRevenueSharingAds')}</h3>
        <p className={buildClassName(styles.description, styles.secondary)}>
          {lang('RevenueSharingAdsAlertSubtitle')}
        </p>
        <ListItem
          isStatic
          multiline
          icon="lock"
        >
          <span className="title">{lang('RevenueSharingAdsInfo1Title')}</span>
          <span className="subtitle">
            {renderText(lang('RevenueSharingAdsInfo1Subtitle'), ['simple_markdown'])}
          </span>
        </ListItem>
        <ListItem
          isStatic
          multiline
          icon="revenue-split"
        >
          <span className="title">{lang('RevenueSharingAdsInfo2Title')}</span>
          <span className="subtitle">
            {renderText(lang('RevenueSharingAdsInfo2Subtitle'), ['simple_markdown'])}
          </span>
        </ListItem>
        <ListItem
          isStatic
          multiline
          icon="nochannel"
        >
          <span className="title">{lang('RevenueSharingAdsInfo3Title')}</span>
          <span className="subtitle">
            {renderText(lang('RevenueSharingAdsInfo3Subtitle', minLevelToRestrictAds), ['simple_markdown'])}
          </span>
        </ListItem>
        <Separator className={styles.separator} />
        <h3 className={styles.title}>{renderText(lang('RevenueSharingAdsInfo4Title'), ['simple_markdown'])}</h3>
        <p className={styles.description}>
          {renderText(lang('RevenueSharingAdsInfo4Subtitle2', ''), ['simple_markdown'])}
          <SafeLink
            url={lang('PromoteUrl')}
            text={lang('LearnMoreArrow')}
          />
        </p>
      </>
    );
  }, [lang, minLevelToRestrictAds]);

  return (
    <Modal
      isOpen={isOpen}
      contentClassName={styles.content}
      onClose={onClose}
    >
      {isRevenueSharing ? revenueSharingAdContent : regularAdContent}
      <Button
        size="smaller"
        onClick={onClose}
      >
        {lang('RevenueSharingAdsUnderstood')}
      </Button>
    </Modal>
  );
};

export default memo(AboutAdsModal);
