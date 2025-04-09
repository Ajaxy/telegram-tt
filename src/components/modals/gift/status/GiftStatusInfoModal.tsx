import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiUser,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { selectIsCurrentUserPremium, selectUser } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useCustomEmoji from '../../../common/hooks/useCustomEmoji';

import Avatar from '../../../common/Avatar';
import FullNameTitle from '../../../common/FullNameTitle';
import Icon from '../../../common/icons/Icon';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import Button from '../../../ui/Button';
import TableAboutModal, { type TableAboutData } from '../../common/TableAboutModal';

import styles from './GiftStatusInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftStatusInfoModal'];
};

type StateProps = {
  currentUser: ApiUser;
  isCurrentUserPremium?: boolean;
};

const GiftStatusInfoModal = ({
  modal,
  currentUser,
  isCurrentUserPremium,
}: OwnProps & StateProps) => {
  const {
    closeGiftStatusInfoModal,
    setEmojiStatus,
  } = getActions();
  const lang = useLang();
  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const { emojiStatus } = renderingModal || {};

  const subtitleColor = emojiStatus?.textColor;

  const patternIcon = useCustomEmoji(emojiStatus?.patternDocumentId);

  const handleClose = useLastCallback(() => {
    closeGiftStatusInfoModal();
  });

  const onWearClick = useLastCallback(() => {
    if (emojiStatus) {
      setEmojiStatus({ emojiStatus });
    }
    closeGiftStatusInfoModal();
  });

  const radialPatternBackdrop = useMemo(() => {
    if (!emojiStatus || !isOpen) return undefined;

    const backdropColors = [emojiStatus.centerColor, emojiStatus.edgeColor];
    const patternColor = emojiStatus.patternColor;

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternColor={patternColor}
        patternIcon={patternIcon.customEmoji}
      />
    );
  }, [emojiStatus, isOpen, patternIcon]);

  const mockPeerWithStatus = useMemo(() => {
    return {
      ...currentUser,
      emojiStatus,
    } satisfies ApiUser;
  }, [currentUser, emojiStatus]);

  const header = useMemo(() => {
    return (
      <div className={styles.header}>
        <div
          className={buildClassName(styles.profileBlock)}
          style={buildStyle(subtitleColor && `color: ${subtitleColor}`)}
        >

          {radialPatternBackdrop}
          <Avatar peer={mockPeerWithStatus} size="jumbo" className={styles.avatar} />
          <FullNameTitle
            peer={mockPeerWithStatus}
            className={styles.userTitle}
            withEmojiStatus
            noFake
            noVerified
            statusSparklesColor={subtitleColor}
          />
          <p className={styles.status} style={buildStyle(subtitleColor && `color: ${subtitleColor}`)}>
            {lang('Online')}
          </p>
        </div>
        <div className={styles.titleContainer}>
          <div className={styles.giftTitle}>{
            lang('UniqueStatusWearTitle', {
              gift: mockPeerWithStatus?.emojiStatus?.title,
            })
          }
          </div>
          <div className={styles.infoDescription}>{
            lang('UniqueStatusBenefitsDescription')
          }
          </div>
        </div>
      </div>
    );
  }, [subtitleColor, radialPatternBackdrop, mockPeerWithStatus, lang]);

  const listItemData = [
    ['radial-badge', lang('UniqueStatusBadgeBenefitTitle'), lang('UniqueStatusBadgeDescription')],
    ['unique-profile', lang('UniqueStatusProfileDesignBenefitTitle'), lang('UniqueStatusProfileDesignDescription')],
    ['proof-of-ownership', lang('UniqueStatusProofOfOwnershipBenefitTitle'),
      lang('UniqueStatusProofOfOwnershipDescription')],
  ] satisfies TableAboutData;

  const footer = useMemo(() => {
    if (!isOpen) return undefined;
    return (
      <div className={styles.footer}>
        <Button
          size="smaller"
          onClick={onWearClick}
        >
          {lang('UniqueStatusWearButton')}
          {!isCurrentUserPremium && <Icon name="lock-badge" className={styles.lockIcon} />}
        </Button>
      </div>
    );
  }, [lang, isCurrentUserPremium, isOpen]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      header={header}
      listItemData={listItemData}
      footer={footer}
      hasBackdrop
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const currentUser = selectUser(global, global.currentUserId!)!;
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      currentUser,
      isCurrentUserPremium,
    };
  },
)(GiftStatusInfoModal));
