import type { FC, TeactNode } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  ApiEmojiStatusCollectible,
  ApiEmojiStatusType,
  ApiPeer,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { DEFAULT_STATUS_ICON_ID, TME_LINK_PREFIX } from '../../../../config';
import { getHasAdminRight, getPeerTitle } from '../../../../global/helpers';
import { isApiPeerChat } from '../../../../global/helpers/peers';
import { selectPeer, selectUser } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
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
import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import DropdownMenu from '../../../ui/DropdownMenu';
import Link from '../../../ui/Link';
import MenuItem from '../../../ui/MenuItem';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftInfoModal'];
};

type StateProps = {
  fromPeer?: ApiPeer;
  targetPeer?: ApiPeer;
  currentUserId?: string;
  starGiftMaxConvertPeriod?: number;
  hasAdminRights?: boolean;
  currentUserEmojiStatus?: ApiEmojiStatusType;
  collectibleEmojiStatuses?: ApiEmojiStatusType[];
};

const STICKER_SIZE = 120;

const GiftInfoModal = ({
  modal,
  fromPeer,
  targetPeer,
  currentUserId,
  starGiftMaxConvertPeriod,
  hasAdminRights,
  currentUserEmojiStatus,
  collectibleEmojiStatuses,
}: OwnProps & StateProps) => {
  const {
    closeGiftInfoModal,
    changeGiftVisibility,
    convertGiftToStars,
    openChatWithInfo,
    focusMessage,
    openGiftUpgradeModal,
    showNotification,
    openChatWithDraft,
    openGiftStatusInfoModal,
    setEmojiStatus,
    openGiftTransferModal,
  } = getActions();

  const [isConvertConfirmOpen, openConvertConfirm, closeConvertConfirm] = useFlag();

  const lang = useLang();
  const oldLang = useOldLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const renderingFromPeer = useCurrentOrPrev(fromPeer);
  const renderingTargetPeer = useCurrentOrPrev(targetPeer);

  const isTargetChat = renderingTargetPeer && isApiPeerChat(renderingTargetPeer);

  const { gift: typeGift } = renderingModal || {};
  const isSavedGift = typeGift && 'gift' in typeGift;
  const savedGift = isSavedGift ? typeGift : undefined;
  const isSender = savedGift?.fromId === currentUserId;
  const canConvertDifference = (savedGift && starGiftMaxConvertPeriod && (
    savedGift.date + starGiftMaxConvertPeriod - getServerTime()
  )) || 0;
  const conversionLeft = Math.ceil(canConvertDifference / 60 / 60 / 24);

  const gift = isSavedGift ? typeGift.gift : typeGift;
  const giftSticker = gift && getStickerFromGift(gift);

  const currenUniqueEmojiStatusSlug = currentUserEmojiStatus?.type === 'collectible'
    ? currentUserEmojiStatus.slug : undefined;

  const starGiftUniqueSlug = gift?.type === 'starGiftUnique' ? gift.slug : undefined;
  const starGiftUniqueLink = useMemo(() => {
    if (!starGiftUniqueSlug) return undefined;
    return `${TME_LINK_PREFIX}nft/${starGiftUniqueSlug}`;
  }, [starGiftUniqueSlug]);
  const userCollectibleStatus = useMemo(() => {
    if (!starGiftUniqueSlug) return undefined;
    return collectibleEmojiStatuses?.find((
      status,
    ) => status.type === 'collectible' && status.slug === starGiftUniqueSlug) as ApiEmojiStatusCollectible | undefined;
  }, [starGiftUniqueSlug, collectibleEmojiStatuses]);

  const isGiftUnique = gift && gift.type === 'starGiftUnique';
  const canTakeOff = isGiftUnique && currenUniqueEmojiStatusSlug === gift.slug;
  const canWear = userCollectibleStatus && !canTakeOff;

  const canFocusUpgrade = Boolean(savedGift?.upgradeMsgId);
  const canUpdate = !canFocusUpgrade && savedGift?.inputGift && (
    isTargetChat ? hasAdminRights : renderingTargetPeer?.id === currentUserId
  );

  const handleClose = useLastCallback(() => {
    closeGiftInfoModal();
  });

  const handleCopyLink = useLastCallback(() => {
    if (!starGiftUniqueLink) return;
    copyTextToClipboard(starGiftUniqueLink);
    showNotification({
      message: lang('LinkCopied'),
    });
  });

  const handleLinkShare = useLastCallback(() => {
    if (!starGiftUniqueLink) return;
    openChatWithDraft({ text: { text: starGiftUniqueLink } });
    handleClose();
  });

  const handleTransfer = useLastCallback(() => {
    if (savedGift?.gift.type !== 'starGiftUnique') return;
    openGiftTransferModal({ gift: savedGift });
  });

  const handleWear = useLastCallback(() => {
    if (gift?.type !== 'starGiftUnique' || !userCollectibleStatus) return;
    openGiftStatusInfoModal({ emojiStatus: userCollectibleStatus });
  });

  const handleTakeOff = useLastCallback(() => {
    if (canTakeOff) {
      setEmojiStatus({
        emojiStatus: { type: 'regular', documentId: DEFAULT_STATUS_ICON_ID },
      });
    }
  });

  const handleFocusUpgraded = useLastCallback(() => {
    if (!savedGift?.upgradeMsgId || !renderingTargetPeer) return;
    const { upgradeMsgId } = savedGift;
    focusMessage({ chatId: renderingTargetPeer.id, messageId: upgradeMsgId! });
    handleClose();
  });

  const handleTriggerVisibility = useLastCallback(() => {
    const { inputGift, isUnsaved } = savedGift!;
    changeGiftVisibility({ gift: inputGift!, shouldUnsave: !isUnsaved });
    handleClose();
  });

  const handleConvertToStars = useLastCallback(() => {
    const { inputGift } = savedGift!;
    convertGiftToStars({ gift: inputGift! });
    closeConvertConfirm();
    handleClose();
  });

  const handleOpenUpgradeModal = useLastCallback(() => {
    if (!savedGift) return;
    openGiftUpgradeModal({ giftId: savedGift.gift.id, gift: savedGift });
  });

  const giftAttributes = useMemo(() => {
    return gift && getGiftAttributes(gift);
  }, [gift]);

  const SettingsMenuButton: FC<{ onTrigger: () => void; isMenuOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isMenuOpen }) => (
      <Button
        round
        size="smaller"
        color="translucent-white"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel={lang('AriaMoreButton')}
      >
        <Icon name="more" />
      </Button>
    );
  }, [lang]);

  const renderFooterButton = useLastCallback(() => {
    if (canFocusUpgrade) {
      return (
        <Button size="smaller" onClick={handleFocusUpgraded}>
          {lang('GiftInfoViewUpgraded')}
        </Button>
      );
    }

    if (canUpdate && savedGift?.alreadyPaidUpgradeStars && !savedGift.upgradeMsgId) {
      return (
        <Button size="smaller" isShiny onClick={handleOpenUpgradeModal}>
          {lang('GiftInfoUpgradeForFree')}
        </Button>
      );
    }

    return (
      <Button size="smaller" onClick={handleClose}>
        {lang('OK')}
      </Button>
    );
  });

  const modalData = useMemo(() => {
    if (!typeGift || !gift) {
      return undefined;
    }

    const {
      fromId, isNameHidden, starsToConvert, isUnsaved, isConverted,
    } = savedGift || {};

    const isVisibleForMe = isNameHidden && renderingTargetPeer;

    const description = (() => {
      if (!savedGift) return lang('GiftInfoSoldOutDescription');
      if (isTargetChat) return undefined;

      if (savedGift.upgradeMsgId) return lang('GiftInfoDescriptionUpgraded');
      if (savedGift.canUpgrade && savedGift.alreadyPaidUpgradeStars) {
        return canUpdate
          ? lang('GiftInfoDescriptionFreeUpgrade')
          : lang('GiftInfoPeerDescriptionFreeUpgradeOut', { peer: getPeerTitle(lang, renderingTargetPeer!)! });
      }
      if (!canUpdate && !isSender) return undefined;
      if (isConverted && starsToConvert) {
        return canUpdate
          ? lang('GiftInfoDescriptionConverted', {
            amount: formatInteger(starsToConvert!),
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          })
          : lang('GiftInfoPeerDescriptionOutConverted', {
            amount: formatInteger(starsToConvert!),
            peer: getPeerTitle(lang, renderingTargetPeer!)!,
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          });
      }

      if (savedGift.canUpgrade && canUpdate) {
        return lang('GiftInfoDescriptionUpgrade', {
          amount: formatInteger(starsToConvert!),
        }, {
          pluralValue: starsToConvert!,
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
          pluralValue: starsToConvert || 0,
        })
        : lang('GiftInfoPeerDescriptionOut', {
          amount: starsToConvert,
          peer: getPeerTitle(lang, renderingTargetPeer!)!,
        }, {
          withNodes: true,
          withMarkdown: true,
          pluralValue: starsToConvert || 0,
        });
    })();

    function getTitle() {
      if (isGiftUnique) return gift.title;
      if (!savedGift) return lang('GiftInfoSoldOutTitle');

      return canUpdate ? lang('GiftInfoReceived') : lang('GiftInfoTitle');
    }

    const uniqueGiftContextMenu = (
      <DropdownMenu
        className="with-menu-transitions"
        trigger={SettingsMenuButton}
        positionX="right"
      >
        <MenuItem icon="link-badge" onClick={handleCopyLink}>
          {lang('CopyLink')}
        </MenuItem>
        <MenuItem icon="forward" onClick={handleLinkShare}>
          {lang('Share')}
        </MenuItem>
        {canUpdate && isGiftUnique && (
          <MenuItem icon="diamond" onClick={handleTransfer}>
            {lang('GiftInfoTransfer')}
          </MenuItem>
        )}
        {canWear && (
          <MenuItem icon="crown-wear" onClick={handleWear}>
            {lang('GiftInfoWear')}
          </MenuItem>
        )}
        {canTakeOff && (
          <MenuItem icon="crown-take-off" onClick={handleTakeOff}>
            {lang('GiftInfoTakeOff')}
          </MenuItem>
        )}
      </DropdownMenu>
    );

    const uniqueGiftModalHeader = (
      <div
        className={styles.modalHeader}
      >
        <Button
          className={styles.modalCloseButton}
          round
          color="translucent-white"
          size="smaller"
          ariaLabel={lang('Close')}
          onClick={handleClose}
        >
          <Icon name="close" />
        </Button>
        {isOpen && uniqueGiftContextMenu}
      </div>
    );

    const uniqueGiftHeader = isGiftUnique && (
      <div className={buildClassName(styles.header, styles.uniqueGift)}>
        <UniqueGiftHeader
          backdropAttribute={giftAttributes!.backdrop!}
          patternAttribute={giftAttributes!.pattern!}
          modelAttribute={giftAttributes!.model!}
          title={gift.title}
          subtitle={lang('GiftInfoCollectible', { number: gift.number })}
        />
      </div>
    );

    const regularHeader = (
      <div className={styles.header}>
        <AnimatedIconFromSticker
          className={styles.giftSticker}
          sticker={giftSticker}
          size={STICKER_SIZE}
        />
        <h1 className={styles.title}>
          {getTitle()}
        </h1>
        {description && (
          <p className={buildClassName(styles.description, !savedGift && gift?.type === 'starGift' && styles.soldOut)}>
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

      if (savedGift?.date) {
        tableData.push([
          lang('GiftInfoDate'),
          formatDateTimeToString(savedGift.date * 1000, lang.code, true),
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

      const starsValue = gift.stars + (savedGift?.alreadyPaidUpgradeStars || 0);

      tableData.push([
        lang('GiftInfoValue'),
        <div className={styles.giftValue}>
          {formatStarsAsIcon(lang, starsValue, { className: styles.starAmountIcon })}
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

      if (gift.upgradeStars && !savedGift?.upgradeMsgId) {
        tableData.push([
          lang('GiftInfoStatus'),
          <div className={styles.giftValue}>
            {lang('GiftInfoStatusNonUnique')}
            {canUpdate && <BadgeButton onClick={handleOpenUpgradeModal}>{lang('GiftInfoUpgradeBadge')}</BadgeButton>}
          </div>,
        ]);
      }

      if (savedGift?.message) {
        tableData.push([
          undefined,
          renderTextWithEntities(savedGift.message),
        ]);
      }
    }

    if (isGiftUnique) {
      const { ownerName, ownerAddress, ownerId } = gift;
      const {
        model, backdrop, pattern, originalDetails,
      } = giftAttributes || {};

      if (ownerAddress) {
        tableData.push([
          lang('GiftInfoOwner'),
          <span
            className={styles.ownerAddress}
            onClick={() => {
              copyTextToClipboard(ownerAddress);
              showNotification({
                message: { key: 'WalletAddressCopied' },
                icon: 'copy',
              });
            }}
          >
            {ownerAddress}
            <Icon className={styles.copyIcon} name="copy" />
          </span>,
        ]);
      } else {
        tableData.push([
          lang('GiftInfoOwner'),
          ownerId ? { chatId: ownerId, withEmojiStatus: true } : ownerName || '',
        ]);
      }

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
        const global = getGlobal(); // Peer titles do not need to be reactive

        const openChat = (id: string) => {
          openChatWithInfo({ id });
          closeGiftInfoModal();
        };

        const recipient = selectPeer(global, recipientId)!;
        const sender = senderId ? selectPeer(global, senderId) : undefined;

        const formattedDate = formatDateTimeToString(date * 1000, lang.code, true);
        const recipientLink = (
          // eslint-disable-next-line react/jsx-no-bind
          <Link onClick={() => openChat(recipientId)} isPrimary>
            {getPeerTitle(lang, recipient)}
          </Link>
        );

        let text: TeactNode | undefined;
        if (!sender || senderId === recipientId) {
          text = message ? lang('GiftInfoPeerOriginalInfoText', {
            peer: recipientLink,
            text: renderTextWithEntities(message),
            date: formattedDate,
          }, {
            withNodes: true,
          }) : lang('GiftInfoPeerOriginalInfo', {
            peer: recipientLink,
            date: formattedDate,
          }, {
            withNodes: true,
          });
        } else {
          const senderLink = (
            // eslint-disable-next-line react/jsx-no-bind
            <Link onClick={() => openChat(sender.id)} isPrimary>
              {getPeerTitle(lang, sender)}
            </Link>
          );
          text = message ? lang('GiftInfoPeerOriginalInfoTextSender', {
            peer: recipientLink,
            sender: senderLink,
            text: renderTextWithEntities(message),
            date: formattedDate,
          }, {
            withNodes: true,
          }) : lang('GiftInfoPeerOriginalInfoSender', {
            peer: recipientLink,
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
              {lang(`GiftInfo${isTargetChat ? 'Channel' : ''}${isUnsaved ? 'Hidden' : 'Saved'}`, {
                link: (
                  <Link isPrimary onClick={handleTriggerVisibility}>
                    {lang(`GiftInfoSaved${isUnsaved ? 'Show' : 'Hide'}`)}
                  </Link>
                ),
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
        {renderFooterButton()}
      </div>
    );

    return {
      modalHeader: isGiftUnique ? uniqueGiftModalHeader : undefined,
      header: isGiftUnique ? uniqueGiftHeader : regularHeader,
      tableData,
      footer,
    };
  }, [
    typeGift, savedGift, renderingTargetPeer, giftSticker, lang,
    canUpdate, canConvertDifference, isSender, oldLang,
    gift, giftAttributes, renderFooterButton, isTargetChat,
    SettingsMenuButton, isOpen, isGiftUnique, canWear, canTakeOff,
  ]);

  return (
    <>
      <TableInfoModal
        isOpen={isOpen}
        modalHeader={modalData?.modalHeader}
        header={modalData?.header}
        hasBackdrop={isGiftUnique}
        tableData={modalData?.tableData}
        footer={modalData?.footer}
        className={styles.modal}
        onClose={handleClose}
      />
      {savedGift && (
        <ConfirmDialog
          isOpen={isConvertConfirmOpen}
          onClose={closeConvertConfirm}
          confirmHandler={handleConvertToStars}
          title={lang('GiftInfoConvertTitle')}
        >
          <div>
            {lang('GiftInfoPeerConvertDescription', {
              amount: formatStarsAsText(lang, savedGift.starsToConvert!),
              peer: getPeerTitle(lang, renderingFromPeer!)!,
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
    const isSavedGift = typeGift && 'gift' in typeGift;

    const fromId = isSavedGift && typeGift.fromId;
    const fromPeer = fromId ? selectPeer(global, fromId) : undefined;
    const targetPeer = modal?.peerId ? selectPeer(global, modal.peerId) : undefined;
    const chat = targetPeer && isApiPeerChat(targetPeer) ? targetPeer : undefined;
    const hasAdminRights = chat && getHasAdminRight(chat, 'postMessages');
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
    const currentUserEmojiStatus = currentUser?.emojiStatus;
    const collectibleEmojiStatuses = global.collectibleEmojiStatuses?.statuses;

    return {
      fromPeer,
      targetPeer,
      currentUserId: global.currentUserId,
      starGiftMaxConvertPeriod: global.appConfig?.starGiftMaxConvertPeriod,
      hasAdminRights,
      currentUserEmojiStatus,
      collectibleEmojiStatuses,
    };
  },
)(GiftInfoModal));
