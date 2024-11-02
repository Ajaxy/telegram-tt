import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiSticker, ApiUser } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { STARS_ICON_PLACEHOLDER } from '../../../../config';
import { getUserFullName } from '../../../../global/helpers';
import { selectStarGiftSticker, selectUser } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { CUSTOM_PEER_HIDDEN } from '../../../../util/objects/customPeer';
import { formatInteger } from '../../../../util/textFormat';
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
import Button from '../../../ui/Button';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import Link from '../../../ui/Link';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';

import styles from './GiftInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftInfoModal'];
};

type StateProps = {
  sticker?: ApiSticker;
  userFrom?: ApiUser;
  targetUser?: ApiUser;
  currentUserId?: string;
  starGiftMaxConvertPeriod?: number;
};

const STICKER_SIZE = 120;

const GiftInfoModal = ({
  modal, sticker, userFrom, targetUser, currentUserId, starGiftMaxConvertPeriod,
}: OwnProps & StateProps) => {
  const {
    closeGiftInfoModal,
    changeGiftVisilibity,
    convertGiftToStars,
    openChatWithInfo,
  } = getActions();

  const [isConvertConfirmOpen, openConvertConfirm, closeConvertConfirm] = useFlag();

  const lang = useLang();
  const oldLang = useOldLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const { gift: typeGift } = renderingModal || {};
  const isUserGift = typeGift && 'gift' in typeGift;
  const userGift = isUserGift ? typeGift : undefined;
  const canUpdate = Boolean(userGift?.fromId && userGift.messageId);
  const isSender = userGift?.fromId === currentUserId;
  const canConvertDifference = (userGift && starGiftMaxConvertPeriod && (
    userGift.date + starGiftMaxConvertPeriod - Date.now() / 1000
  )) || 0;

  const handleClose = useLastCallback(() => {
    closeGiftInfoModal();
  });

  const handleTriggerVisibility = useLastCallback(() => {
    const { fromId, messageId, isUnsaved } = userGift!;
    changeGiftVisilibity({ userId: fromId!, messageId: messageId!, shouldUnsave: !isUnsaved });
    handleClose();
  });

  const handleConvertToStars = useLastCallback(() => {
    const { fromId, messageId } = userGift!;
    convertGiftToStars({ userId: fromId!, messageId: messageId! });
    closeConvertConfirm();
    handleClose();
  });

  const handleOpenProfile = useLastCallback(() => {
    openChatWithInfo({ id: currentUserId!, profileTab: 'gifts' });
    handleClose();
  });

  const modalData = useMemo(() => {
    if (!typeGift) {
      return undefined;
    }

    const {
      fromId, isNameHidden, message, starsToConvert, isUnsaved, isConverted,
    } = userGift || {};
    const gift = isUserGift ? typeGift.gift : typeGift;

    const isVisibleForMe = isNameHidden && targetUser;

    const description = (() => {
      if (!userGift) {
        return lang('GiftInfoSoldOutDescription');
      }
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
          amount: formatInteger(starsToConvert!),
        }, {
          withNodes: true,
          withMarkdown: true,
        })
        : lang('GiftInfoDescriptionOut', {
          amount: formatInteger(starsToConvert!),
          user: getUserFullName(targetUser)!,
        }, {
          withNodes: true,
          withMarkdown: true,
        });
    })();

    const header = (
      <div className={styles.header}>
        <AnimatedIconFromSticker sticker={sticker} noLoop nonInteractive size={STICKER_SIZE} />
        <h1 className={styles.title}>
          {!userGift && lang('GiftInfoSoldOutTitle')}
          {userGift && lang(canUpdate ? 'GiftInfoReceived' : 'GiftInfoTitle')}
        </h1>
        {userGift && (
          <p className={styles.amount}>
            <span className={styles.amount}>
              {formatInteger(gift.stars)}
            </span>
            <StarIcon type="gold" size="middle" />
          </p>
        )}
        {description && (
          <p className={buildClassName(styles.description, !userGift && styles.soldOut)}>
            {description}
          </p>
        )}
      </div>
    );

    const tableData: TableData = [];
    if (fromId || isNameHidden) {
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
        {lang('StarsAmount', {
          amount: formatInteger(gift.stars),
        }, {
          withNodes: true,
          specialReplacement: {
            [STARS_ICON_PLACEHOLDER]: <StarIcon type="gold" size="small" />,
          },
        })}
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
          count: formatInteger(gift.availabilityRemains!),
          total: formatInteger(gift.availabilityTotal),
        }),
      ]);
    }

    if (message) {
      tableData.push([
        undefined,
        renderTextWithEntities(message),
      ]);
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
        {!canUpdate && (
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
  }, [typeGift, userGift, isUserGift, targetUser, sticker, lang, canUpdate, canConvertDifference, isSender, oldLang]);

  return (
    <>
      <TableInfoModal
        isOpen={isOpen}
        header={modalData?.header}
        tableData={modalData?.tableData}
        footer={modalData?.footer}
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
              amount: lang('StarsAmountText', { amount: formatInteger(userGift.starsToConvert!) }),
              user: getUserFullName(userFrom)!,
            }, {
              withNodes: true,
              withMarkdown: true,
            })}
          </div>
          {canConvertDifference > 0 && (
            <div>
              {lang('GiftInfoConvertDescriptionPeriod', {
                count: formatInteger(Math.ceil(canConvertDifference / 60 / 60 / 24)),
              }, {
                withNodes: true,
                withMarkdown: true,
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
    const gift = isUserGift ? typeGift.gift : typeGift;
    const stickerId = gift?.stickerId;
    const sticker = stickerId ? selectStarGiftSticker(global, stickerId) : undefined;

    const fromId = isUserGift && typeGift.fromId;
    const userFrom = fromId ? selectUser(global, fromId) : undefined;
    const targetUser = modal?.userId ? selectUser(global, modal.userId) : undefined;

    return {
      sticker,
      userFrom,
      targetUser,
      currentUserId: global.currentUserId,
      starGiftMaxConvertPeriod: global.appConfig?.starGiftMaxConvertPeriod,
    };
  },
)(GiftInfoModal));
