import type { TeactNode } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  ApiUser,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getUserFullName } from '../../../../global/helpers';
import { selectUser } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { formatStarsAsIcon, formatStarsAsText } from '../../../../util/localization/format';
import { CUSTOM_PEER_HIDDEN } from '../../../../util/objects/customPeer';
import { getServerTime } from '../../../../util/serverTime';
import { formatInteger, formatPercent } from '../../../../util/textFormat';
import { getGiftAttributes, getStickerFromGift } from '../../../common/helpers/gifts';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import BadgeButton from '../../../common/BadgeButton';
import StarIcon from '../../../common/icons/StarIcon';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import Button from '../../../ui/Button';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import Link from '../../../ui/Link';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';

import styles from './GiftInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftInfoModal'];
};

type StateProps = {
  userFrom?: ApiUser;
  targetUser?: ApiUser;
  currentUserId?: string;
  starGiftMaxConvertPeriod?: number;
};

const STICKER_SIZE = 120;

const GiftInfoModal = ({
  modal, userFrom, targetUser, currentUserId, starGiftMaxConvertPeriod,
}: OwnProps & StateProps) => {
  const {
    closeGiftInfoModal,
    changeGiftVisibility,
    convertGiftToStars,
    openChatWithInfo,
    focusMessage,
  } = getActions();

  const [isConvertConfirmOpen, openConvertConfirm, closeConvertConfirm] = useFlag();

  const lang = useLang();
  const oldLang = useOldLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const { gift: typeGift } = renderingModal || {};
  const isUserGift = typeGift && 'gift' in typeGift;
  const userGift = isUserGift ? typeGift : undefined;
  const isSender = userGift?.fromId === currentUserId;
  const canConvertDifference = (userGift && starGiftMaxConvertPeriod && (
    userGift.date + starGiftMaxConvertPeriod - getServerTime()
  )) || 0;
  const conversionLeft = Math.ceil(canConvertDifference / 60 / 60 / 24);

  const gift = isUserGift ? typeGift.gift : typeGift;
  const giftSticker = gift && getStickerFromGift(gift);

  const canFocusUpgrade = Boolean(userGift?.upgradeMsgId);
  const canUpdate = Boolean(userGift?.messageId) && !isSender && !canFocusUpgrade;

  const handleClose = useLastCallback(() => {
    closeGiftInfoModal();
  });

  const handleFocusUpgraded = useLastCallback(() => {
    if (!userGift?.upgradeMsgId) return;
    const { upgradeMsgId, fromId } = userGift;
    focusMessage({ chatId: fromId!, messageId: upgradeMsgId! });
    handleClose();
  });

  const handleTriggerVisibility = useLastCallback(() => {
    const { messageId, isUnsaved } = userGift!;
    changeGiftVisibility({ messageId: messageId!, shouldUnsave: !isUnsaved });
    handleClose();
  });

  const handleConvertToStars = useLastCallback(() => {
    const { messageId } = userGift!;
    convertGiftToStars({ messageId: messageId! });
    closeConvertConfirm();
    handleClose();
  });

  const handleOpenProfile = useLastCallback(() => {
    openChatWithInfo({ id: currentUserId!, profileTab: 'gifts' });
    handleClose();
  });

  const giftAttributes = useMemo(() => {
    return gift && getGiftAttributes(gift);
  }, [gift]);

  const radialPatternBackdrop = useMemo(() => {
    const { backdrop, pattern } = giftAttributes || {};

    if (!backdrop || !pattern || !isOpen) {
      return undefined;
    }

    const backdropColors = [backdrop.centerColor, backdrop.edgeColor];
    const patternColor = backdrop.patternColor;

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternColor={patternColor}
        patternIcon={pattern.sticker}
      />
    );
  }, [giftAttributes, isOpen]);

  const modalData = useMemo(() => {
    if (!typeGift || !gift) {
      return undefined;
    }

    const {
      fromId, isNameHidden, starsToConvert, isUnsaved, isConverted,
    } = userGift || {};

    const isVisibleForMe = isNameHidden && targetUser;

    const description = (() => {
      if (gift.type === 'starGiftUnique') {
        return lang('GiftInfoCollectible', {
          number: gift.number,
        });
      }
      if (!userGift) return lang('GiftInfoSoldOutDescription');
      if (!canUpdate && !isSender) return undefined;
      if (!starsToConvert || canConvertDifference < 0) return undefined;
      if (isConverted) {
        return canUpdate
          ? lang('GiftInfoDescriptionConverted', {
            amount: formatInteger(starsToConvert!),
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          })
          : lang('GiftInfoDescriptionOutConverted', {
            amount: formatInteger(starsToConvert!),
            user: getUserFullName(targetUser)!,
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          });
      }

      return canUpdate
        ? lang('GiftInfoDescription', {
          amount: starsToConvert,
        }, {
          withNodes: true,
          withMarkdown: true,
          pluralValue: starsToConvert,
        })
        : lang('GiftInfoDescriptionOut', {
          amount: starsToConvert,
          user: getUserFullName(targetUser)!,
        }, {
          withNodes: true,
          withMarkdown: true,
          pluralValue: starsToConvert,
        });
    })();

    function getTitle() {
      if (gift?.type === 'starGiftUnique') return gift.title;
      if (!userGift) return lang('GiftInfoSoldOutTitle');

      return canUpdate ? lang('GiftInfoReceived') : lang('GiftInfoTitle');
    }

    const descriptionColor = giftAttributes?.backdrop?.textColor;

    const header = (
      <div
        className={buildClassName(styles.header, radialPatternBackdrop && styles.uniqueGift)}
        style={buildStyle(descriptionColor && `--_color-description: ${descriptionColor}`)}
      >
        {radialPatternBackdrop}
        <AnimatedIconFromSticker
          className={styles.giftSticker}
          sticker={giftSticker}
          noLoop={false}
          nonInteractive
          size={STICKER_SIZE}
        />
        <h1 className={styles.title}>
          {getTitle()}
        </h1>
        {gift.type === 'starGift' && (
          <p className={styles.amount}>
            <span className={styles.amount}>
              {formatInteger(gift.stars)}
            </span>
            <StarIcon type="gold" size="middle" />
          </p>
        )}
        {description && (
          <p className={buildClassName(styles.description, !userGift && gift?.type === 'starGift' && styles.soldOut)}>
            {description}
          </p>
        )}
      </div>
    );

    const tableData: TableData = [];
    if (gift.type === 'starGift') {
      if ((fromId || isNameHidden)) {
        tableData.push([
          lang('GiftInfoFrom'),
          fromId ? { chatId: fromId } : (
            <>
              <Avatar size="small" peer={CUSTOM_PEER_HIDDEN} />
              <span className={styles.unknown}>{oldLang(CUSTOM_PEER_HIDDEN.titleKey!)}</span>
            </>
          ),
        ]);
      }

      if (userGift?.date) {
        tableData.push([
          lang('GiftInfoDate'),
          formatDateTimeToString(userGift.date * 1000, lang.code, true),
        ]);
      }

      if (gift.firstSaleDate) {
        tableData.push([
          lang('GiftInfoFirstSale'),
          formatDateTimeToString(gift.firstSaleDate * 1000, lang.code, true),
        ]);
      }

      if (gift.lastSaleDate) {
        tableData.push([
          lang('GiftInfoLastSale'),
          formatDateTimeToString(gift.lastSaleDate * 1000, lang.code, true),
        ]);
      }

      tableData.push([
        lang('GiftInfoValue'),
        <div className={styles.giftValue}>
          {formatStarsAsIcon(lang, gift.stars)}
          {canUpdate && canConvertDifference > 0 && Boolean(starsToConvert) && (
            <BadgeButton onClick={openConvertConfirm}>
              {lang('GiftInfoConvert', { amount: starsToConvert }, { pluralValue: starsToConvert })}
            </BadgeButton>
          )}
        </div>,
      ]);

      if (gift.availabilityTotal) {
        tableData.push([
          lang('GiftInfoAvailability'),
          lang('GiftInfoAvailabilityValue', {
            count: gift.availabilityRemains || 0,
            total: gift.availabilityTotal,
          }, {
            pluralValue: gift.availabilityRemains || 0,
          }),
        ]);
      }

      if (gift.upgradeStars) {
        tableData.push([
          lang('GiftInfoStatus'),
          lang('GiftInfoStatusNonUnique'),
        ]);
      }

      if (userGift?.message) {
        tableData.push([
          undefined,
          renderTextWithEntities(userGift.message),
        ]);
      }
    }

    if (gift.type === 'starGiftUnique') {
      const {
        model, backdrop, pattern, originalDetails,
      } = giftAttributes || {};
      const ownerId = gift.ownerId;
      const ownerName = gift.ownerName;
      tableData.push([
        lang('GiftInfoOwner'),
        ownerId ? { chatId: ownerId } : ownerName || '',
      ]);

      if (model) {
        tableData.push([
          lang('GiftAttributeModel'),
          <span className={styles.uniqueAttribute}>
            {model.name}<BadgeButton>{formatPercent(model.rarityPercent)}</BadgeButton>
          </span>,
        ]);
      }

      if (backdrop) {
        tableData.push([
          lang('GiftAttributeBackdrop'),
          <span className={styles.uniqueAttribute}>
            {backdrop.name}<BadgeButton>{formatPercent(backdrop.rarityPercent)}</BadgeButton>
          </span>,
        ]);
      }

      if (pattern) {
        tableData.push([
          lang('GiftAttributeSymbol'),
          <span className={styles.uniqueAttribute}>
            {pattern.name}<BadgeButton>{formatPercent(pattern.rarityPercent)}</BadgeButton>
          </span>,
        ]);
      }

      tableData.push([
        lang('GiftInfoAvailability'),
        lang('GiftInfoIssued', {
          issued: gift.issuedCount,
          total: gift.totalCount,
        }),
      ]);

      if (originalDetails) {
        const {
          date, recipientId, message, senderId,
        } = originalDetails;
        const global = getGlobal(); // User names does not need to be reactive

        const openChat = (id: string) => {
          openChatWithInfo({ id });
          closeGiftInfoModal();
        };

        const recipient = selectUser(global, recipientId)!;
        const sender = senderId ? selectUser(global, senderId) : undefined;

        const formattedDate = formatDateTimeToString(date * 1000, lang.code, true);
        const recipientLink = (
          // eslint-disable-next-line react/jsx-no-bind
          <Link onClick={() => openChat(recipientId)} isPrimary>
            {getUserFullName(recipient)}
          </Link>
        );

        let text: TeactNode | undefined;
        if (!sender || senderId === recipientId) {
          text = message ? lang('GiftInfoOriginalInfoText', {
            user: recipientLink,
            text: renderTextWithEntities(message),
            date: formattedDate,
          }, {
            withNodes: true,
          }) : lang('GiftInfoOriginalInfo', {
            user: recipientLink,
            date: formattedDate,
          }, {
            withNodes: true,
          });
        } else {
          const senderLink = (
            // eslint-disable-next-line react/jsx-no-bind
            <Link onClick={() => openChat(sender.id)} isPrimary>
              {getUserFullName(sender)}
            </Link>
          );
          text = message ? lang('GiftInfoOriginalInfoTextSender', {
            user: recipientLink,
            sender: senderLink,
            text: renderTextWithEntities(message),
            date: formattedDate,
          }, {
            withNodes: true,
          }) : lang('GiftInfoOriginalInfoSender', {
            user: recipientLink,
            date: formattedDate,
            sender: senderLink,
          }, {
            withNodes: true,
          });
        }

        tableData.push([
          undefined,
          <span>{text}</span>,
        ]);
      }
    }

    const footer = (
      <div className={styles.footer}>
        {canUpdate && (
          <div className={styles.footerDescription}>
            <div>
              {isUnsaved ? lang('GiftInfoHidden')
                : lang('GiftInfoSaved', {
                  link: <Link isPrimary onClick={handleOpenProfile}>{lang('GiftInfoSavedView')}</Link>,
                }, {
                  withNodes: true,
                })}
            </div>
            {isVisibleForMe && (
              <div>
                {lang('GiftInfoSenderHidden')}
              </div>
            )}
          </div>
        )}
        {canFocusUpgrade && (
          <Button size="smaller" onClick={handleFocusUpgraded}>
            {lang('GiftInfoViewUpgraded')}
          </Button>
        )}
        {!canUpdate && !canFocusUpgrade && (
          <Button size="smaller" onClick={handleClose}>
            {lang('OK')}
          </Button>
        )}
        {canUpdate && (
          <Button size="smaller" onClick={handleTriggerVisibility}>
            {lang(isUnsaved ? 'GiftInfoMakeVisible' : 'GiftInfoMakeInvisible')}
          </Button>
        )}
      </div>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [
    typeGift, userGift, targetUser, giftSticker, lang, canUpdate, canConvertDifference, isSender, oldLang, gift,
    radialPatternBackdrop, giftAttributes, canFocusUpgrade,
  ]);

  return (
    <>
      <TableInfoModal
        isOpen={isOpen}
        header={modalData?.header}
        hasBackdrop={Boolean(radialPatternBackdrop)}
        tableData={modalData?.tableData}
        footer={modalData?.footer}
        className={styles.modal}
        onClose={handleClose}
      />
      {userGift && (
        <ConfirmDialog
          isOpen={isConvertConfirmOpen}
          onClose={closeConvertConfirm}
          confirmHandler={handleConvertToStars}
          title={lang('GiftInfoConvertTitle')}
        >
          <div>
            {lang('GiftInfoConvertDescription1', {
              amount: formatStarsAsText(lang, userGift.starsToConvert!),
              user: getUserFullName(userFrom)!,
            }, {
              withNodes: true,
              withMarkdown: true,
            })}
          </div>
          {canConvertDifference > 0 && (
            <div>
              {lang('GiftInfoConvertDescriptionPeriod', {
                count: conversionLeft,
              }, {
                withNodes: true,
                withMarkdown: true,
                pluralValue: conversionLeft,
              })}
            </div>
          )}
          <div>{lang('GiftInfoConvertDescription2')}</div>
        </ConfirmDialog>
      )}
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const typeGift = modal?.gift;
    const isUserGift = typeGift && 'gift' in typeGift;

    const fromId = isUserGift && typeGift.fromId;
    const userFrom = fromId ? selectUser(global, fromId) : undefined;
    const targetUser = modal?.userId ? selectUser(global, modal.userId) : undefined;

    return {
      userFrom,
      targetUser,
      currentUserId: global.currentUserId,
      starGiftMaxConvertPeriod: global.appConfig?.starGiftMaxConvertPeriod,
    };
  },
)(GiftInfoModal));
