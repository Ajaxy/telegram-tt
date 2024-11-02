import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiSticker, ApiUser } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { STARS_ICON_PLACEHOLDER } from '../../../../config';
import { getUserFullName } from '../../../../global/helpers';
import { selectStarGiftSticker, selectUser } from '../../../../global/selectors';
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
};

const STICKER_SIZE = 120;

const GiftInfoModal = ({
  modal, sticker, userFrom, targetUser, currentUserId,
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
  const { gift: userGift } = renderingModal || {};
  const canUpdate = Boolean(userGift?.fromId && userGift.messageId);
  const isSender = userGift?.fromId === currentUserId;

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
    if (!userGift) {
      return undefined;
    }

    const {
      gift, date, fromId, isNameHidden, message, starsToConvert, isUnsaved, isConverted,
    } = userGift;

    const description = (() => {
      if (!canUpdate && !isSender) return undefined;
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
          {lang(canUpdate ? 'GiftInfoReceived' : 'GiftInfoTitle')}
        </h1>
        <p className={styles.amount}>
          <span className={styles.amount}>
            {formatInteger(gift.stars)}
          </span>
          <StarIcon type="gold" size="middle" />
        </p>
        {description && (
          <p className={styles.description}>
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

    tableData.push([
      lang('GiftInfoDate'),
      formatDateTimeToString(date * 1000, lang.code, true),
    ]);

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
        {canUpdate && Boolean(starsToConvert) && (
          <BadgeButton onClick={openConvertConfirm}>
            {lang('GiftInfoConvert', { amount: starsToConvert }, { pluralValue: starsToConvert })}
          </BadgeButton>
        )}
      </div>,
    ]);

    if (message) {
      tableData.push([
        undefined,
        renderTextWithEntities(message),
      ]);
    }

    const footer = (
      <div className={styles.footer}>
        {canUpdate && (
          <p className={styles.footerDescription}>
            {isUnsaved ? lang('GiftInfoHidden')
              : lang('GiftInfoSaved', {
                link: <Link isPrimary onClick={handleOpenProfile}>{lang('GiftInfoSavedView')}</Link>,
              }, {
                withNodes: true,
              })}
          </p>
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
  }, [userGift, sticker, lang, canUpdate, isSender, oldLang, targetUser]);

  return (
    <>
      <TableInfoModal
        isOpen={isOpen}
        header={modalData?.header}
        tableData={modalData?.tableData}
        footer={modalData?.footer}
        onClose={handleClose}
      />
      <ConfirmDialog
        isOpen={isConvertConfirmOpen}
        onClose={closeConvertConfirm}
        confirmHandler={handleConvertToStars}
        title={lang('GiftInfoConvertTitle')}
      >
        {userGift && lang('GiftInfoConvertDescription', {
          amount: lang('StarsAmountText', { amount: formatInteger(userGift.starsToConvert!) }),
          user: getUserFullName(userFrom)!,
        }, {
          withNodes: true,
          withMarkdown: true,
          renderTextFilters: ['br'],
        })}
      </ConfirmDialog>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const stickerId = modal?.gift?.gift.stickerId;
    const sticker = stickerId ? selectStarGiftSticker(global, stickerId) : undefined;

    const fromId = modal?.gift?.fromId;
    const userFrom = fromId ? selectUser(global, fromId) : undefined;
    const targetUser = modal?.userId ? selectUser(global, modal.userId) : undefined;

    return {
      sticker,
      userFrom,
      targetUser,
      currentUserId: global.currentUserId,
    };
  },
)(GiftInfoModal));
