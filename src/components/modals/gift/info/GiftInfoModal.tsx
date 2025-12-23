import { memo, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  ApiEmojiStatusType,
  ApiPeer,
  ApiUser,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../../config';
import { getHasAdminRight } from '../../../../global/helpers';
import { getPeerTitle, isApiPeerChat, isApiPeerUser } from '../../../../global/helpers/peers';
import { getMainUsername } from '../../../../global/helpers/users';
import { selectPeer, selectUser } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { formatCurrencyAsString } from '../../../../util/formatCurrency';
import {
  formatStarsAsIcon, formatStarsAsText, formatTonAsIcon, formatTonAsText,
} from '../../../../util/localization/format';
import { CUSTOM_PEER_HIDDEN } from '../../../../util/objects/customPeer';
import { getServerTime } from '../../../../util/serverTime';
import { formatPercent } from '../../../../util/textFormat';
import { renderGiftOriginalInfo } from '../../../common/helpers/giftOriginalInfo';
import { getGiftAttributes, getStickerFromGift } from '../../../common/helpers/gifts';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import BadgeButton from '../../../common/BadgeButton';
import GiftMenuItems from '../../../common/gift/GiftMenuItems';
import GiftTransferPreview from '../../../common/gift/GiftTransferPreview';
import Icon from '../../../common/icons/Icon';
import SafeLink from '../../../common/SafeLink';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import Link from '../../../ui/Link';
import Menu from '../../../ui/Menu';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftInfoModal'];
};

type StateProps = {
  fromPeer?: ApiPeer;
  targetPeer?: ApiPeer;
  releasedByPeer?: ApiPeer;
  currentUserId?: string;
  starGiftMaxConvertPeriod?: number;
  hasAdminRights?: boolean;
  currentUserEmojiStatus?: ApiEmojiStatusType;
  collectibleEmojiStatuses?: ApiEmojiStatusType[];
  tonExplorerUrl?: string;
  currentUser?: ApiUser;
  recipientPeer?: ApiPeer;
};

const STICKER_SIZE = 120;

const GiftInfoModal = ({
  modal,
  fromPeer,
  targetPeer,
  releasedByPeer,
  currentUserId,
  starGiftMaxConvertPeriod,
  hasAdminRights,
  currentUserEmojiStatus,
  collectibleEmojiStatuses,
  tonExplorerUrl,
  currentUser,
  recipientPeer,
}: OwnProps & StateProps) => {
  const {
    closeGiftInfoModal,
    changeGiftVisibility,
    convertGiftToStars,
    openChatWithInfo,
    focusMessage,
    openGiftUpgradeModal,
    showNotification,
    buyStarGift,
    closeGiftModal,
    openGiftInfoValueModal,
    updateResaleGiftsFilter,
    openGiftInMarket,
    openGiftDescriptionRemoveModal,
  } = getActions();

  const [isConvertConfirmOpen, openConvertConfirm, closeConvertConfirm] = useFlag();

  const lang = useLang();
  const oldLang = useOldLang();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [shouldPayInTon, setShouldPayInTon] = useState<boolean>(false);

  const moreButtonRef = useRef<HTMLButtonElement>();
  const menuRef = useRef<HTMLDivElement>();
  const uniqueGiftHeaderRef = useRef<HTMLDivElement>();
  const {
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(moreButtonRef);

  const handleSymbolClick = useLastCallback(() => {
    if (!gift || !giftAttributes?.pattern) return;

    openGiftInMarket({ gift });
    updateResaleGiftsFilter({
      filter: {
        sortType: 'byDate',
        modelAttributes: [],
        backdropAttributes: [],
        patternAttributes: [{
          type: 'pattern',
          documentId: giftAttributes.pattern.sticker.id,
        }],
      },
    });
  });

  const handleBackdropClick = useLastCallback(() => {
    if (!gift || !giftAttributes?.backdrop) return;

    openGiftInMarket({ gift });
    updateResaleGiftsFilter({
      filter: {
        sortType: 'byDate',
        modelAttributes: [],
        backdropAttributes: [{
          type: 'backdrop',
          backdropId: giftAttributes.backdrop.backdropId,
        }],
        patternAttributes: [],
      },
    });
  });

  const handleModelClick = useLastCallback(() => {
    if (!gift || !giftAttributes?.model) return;

    openGiftInMarket({ gift });
    updateResaleGiftsFilter({
      filter: {
        sortType: 'byDate',
        modelAttributes: [{
          type: 'model',
          documentId: giftAttributes.model.sticker.id,
        }],
        backdropAttributes: [],
        patternAttributes: [],
      },
    });
  });

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
  const hasConvertOption = canConvertDifference > 0 && Boolean(savedGift?.starsToConvert);

  const isGiftUnique = gift && gift.type === 'starGiftUnique';
  const uniqueGift = isGiftUnique ? gift : undefined;

  const giftSubtitle = useMemo(() => {
    if (!gift || gift.type !== 'starGiftUnique') return undefined;

    if (releasedByPeer) {
      const releasedByUsername = `@${getMainUsername(releasedByPeer)}`;
      const ownerTitle = releasedByUsername || getPeerTitle(lang, releasedByPeer);
      const fallbackText = isApiPeerUser(releasedByPeer)
        ? lang('ActionFallbackUser')
        : lang('ActionFallbackChannel');

      return lang('GiftInfoCollectibleBy', {
        number: gift.number, owner: ownerTitle || fallbackText }, {
        withNodes: true,
        withMarkdown: true,
      });
    }

    return lang('GiftInfoCollectible', { number: gift.number });
  }, [gift, releasedByPeer, lang]);

  const starGiftUniqueSlug = gift?.type === 'starGiftUnique' ? gift.slug : undefined;

  const selfCollectibleStatus = useMemo(() => {
    if (!starGiftUniqueSlug) return undefined;
    return collectibleEmojiStatuses?.find((status) =>
      status.type === 'collectible' && status.slug === starGiftUniqueSlug);
  }, [starGiftUniqueSlug, collectibleEmojiStatuses]);

  const isSelfUnique = Boolean(selfCollectibleStatus);
  const canFocusUpgrade = Boolean(savedGift?.upgradeMsgId);

  const canManage = !canFocusUpgrade && savedGift?.inputGift && (
    isTargetChat ? hasAdminRights
      : gift?.type === 'starGift'
        ? renderingTargetPeer?.id === currentUserId
        : gift?.ownerId === currentUserId || isSelfUnique
  );

  function getResalePrice(isInTon?: boolean) {
    if (!isGiftUnique) return undefined;
    const amounts = gift.resellPrice;
    if (!amounts) return undefined;

    if (gift?.resaleTonOnly || isInTon) {
      return amounts.find((amount) => amount.currency === TON_CURRENCY_CODE);
    }

    return amounts.find((amount) => amount.currency === STARS_CURRENCY_CODE);
  }

  const resellPrice = getResalePrice();
  const confirmPrice = getResalePrice(shouldPayInTon);
  const resellPriceInStars = resellPrice?.currency === TON_CURRENCY_CODE && isGiftUnique
    ? gift.resellPrice?.find((amount) => amount.currency === STARS_CURRENCY_CODE)
    : undefined;
  const canBuyGift = !isSelfUnique && gift?.type === 'starGiftUnique'
    && gift.ownerId !== currentUserId && Boolean(resellPrice);

  const giftOwnerTitle = (() => {
    if (!isGiftUnique) return undefined;
    const { ownerName, ownerId } = gift;
    const global = getGlobal(); // Peer titles do not need to be reactive
    const owner = ownerId ? selectPeer(global, ownerId) : undefined;
    return owner ? getPeerTitle(lang, owner) : ownerName;
  })();

  const handleClose = useLastCallback(() => {
    closeGiftInfoModal();
  });

  const handleFocusUpgraded = useLastCallback(() => {
    const giftChat = isSender ? renderingTargetPeer : renderingFromPeer;
    if (!savedGift?.upgradeMsgId || !giftChat) return;
    const { upgradeMsgId } = savedGift;
    focusMessage({ chatId: giftChat.id, messageId: upgradeMsgId });
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

  const handleRemoveMessage = useLastCallback(() => {
    if (!savedGift?.inputGift || !savedGift.dropOriginalDetailsStars || !gift || !giftAttributes) return;

    const { originalDetails } = giftAttributes;
    if (!originalDetails) return;

    openGiftDescriptionRemoveModal({
      gift: savedGift,
      price: savedGift.dropOriginalDetailsStars,
      details: originalDetails,
    });
  });

  const handleOpenUpgradeModal = useLastCallback(() => {
    if (!savedGift) return;
    const giftOwnerId = renderingTargetPeer?.id;
    openGiftUpgradeModal({ giftId: savedGift.gift.id, gift: savedGift, peerId: giftOwnerId });
  });

  const handleBuyGift = useLastCallback(() => {
    if (gift?.type !== 'starGiftUnique' || !getResalePrice()) return;
    setIsConfirmModalOpen(true);
  });

  const closeConfirmModal = useLastCallback(() => {
    setIsConfirmModalOpen(false);
  });

  const handleConfirmBuyGift = useLastCallback(() => {
    const peer = recipientPeer || currentUser;
    const price = getResalePrice(shouldPayInTon);
    if (!peer || !price || gift?.type !== 'starGiftUnique') return;
    closeConfirmModal();
    closeGiftModal();
    buyStarGift({ peerId: peer.id, slug: gift.slug, price });
  });

  const handleOpenValueModal = useLastCallback(() => {
    if (!gift || gift.type !== 'starGiftUnique') return;

    openGiftInfoValueModal({
      gift,
    });
  });

  const giftAttributes = useMemo(() => {
    return gift && getGiftAttributes(gift);
  }, [gift]);

  const renderFooterButton = useLastCallback(() => {
    if (canBuyGift) {
      return (
        <Button className={styles.buyButton} onClick={handleBuyGift}>
          <div>
            {lang('ButtonBuyGift', {
              stars: resellPrice?.currency === TON_CURRENCY_CODE
                ? formatTonAsIcon(lang, resellPrice.amount, { shouldConvertFromNanos: true })
                : formatStarsAsIcon(lang, resellPrice?.amount, { asFont: true }),
            }, { withNodes: true })}
          </div>
          {resellPrice?.currency === TON_CURRENCY_CODE && Boolean(resellPriceInStars) && (
            <div className={styles.footerHint}>
              {lang('GiftBuyEqualsTo', {
                stars: formatStarsAsIcon(lang, resellPriceInStars.amount, { asFont: true }),
              }, { withNodes: true })}
            </div>
          )}
        </Button>
      );
    }

    if (canFocusUpgrade) {
      return (
        <Button onClick={handleFocusUpgraded}>
          {lang('GiftInfoViewUpgraded')}
        </Button>
      );
    }

    if (canManage && savedGift?.alreadyPaidUpgradeStars && !savedGift.upgradeMsgId) {
      return (
        <Button
          isShiny
          onClick={handleOpenUpgradeModal}
          iconName="arrow-down-circle"
          iconClassName={styles.upgradeIcon}
          iconAlignment="end"
        >
          {lang('GiftInfoUpgradeForFree')}
        </Button>
      );
    }

    if (canManage && savedGift?.canUpgrade && !savedGift.upgradeMsgId) {
      return (
        <Button
          isShiny
          onClick={handleOpenUpgradeModal}
          iconName="arrow-down-circle"
          iconClassName={styles.upgradeIcon}
          iconAlignment="end"
        >
          {lang('GiftInfoUpgrade')}
        </Button>
      );
    }

    if (savedGift?.prepaidUpgradeHash) {
      return (
        <Button
          isShiny
          onClick={handleOpenUpgradeModal}
          iconName="arrow-down-circle"
          iconClassName={styles.upgradeIcon}
          iconAlignment="end"
        >
          {lang('GiftAnUpgradeButton')}
        </Button>
      );
    }

    return (
      <Button onClick={handleClose}>
        {lang('OK')}
      </Button>
    );
  });

  const saleDateInfo = useMemo(() => {
    if (!gift) return undefined;
    let text = '';
    if (gift.type === 'starGift') {
      if (gift.firstSaleDate) {
        text += `${lang('GiftInfoFirstSale')} ${formatDateTimeToString(gift.firstSaleDate * 1000, lang.code, true)}`;
      }
      if (gift.lastSaleDate) {
        text += '\n';
        text += `${lang('GiftInfoLastSale')} ${formatDateTimeToString(gift.lastSaleDate * 1000, lang.code, true)}`;
      }
    }

    return text;
  }, [gift, lang]);

  const modalData = useMemo(() => {
    if (!typeGift || !gift) {
      return undefined;
    }

    const {
      fromId, isNameHidden, starsToConvert, isUnsaved, isConverted, upgradeMsgId,
    } = savedGift || {};
    const canConvert = hasConvertOption && Boolean(starsToConvert);

    const isVisibleForMe = isNameHidden && renderingTargetPeer;

    const isWarningDescription = savedGift?.isRefunded || (!savedGift && gift?.type === 'starGift');

    const description = (() => {
      if (!savedGift) return lang('GiftInfoSoldOutDescription');
      if (isTargetChat) return undefined;
      if (savedGift.isRefunded) return lang('GiftInfoDescriptionRefunded');

      if (savedGift.upgradeMsgId) return lang('GiftInfoDescriptionUpgraded');
      if (canManage && savedGift.canUpgrade && savedGift.alreadyPaidUpgradeStars && !savedGift.upgradeMsgId) {
        return lang('GiftInfoDescriptionUpgrade2');
      }
      if (savedGift.canUpgrade && canManage) {
        return canManage
          ? lang('GiftInfoDescriptionFreeUpgrade')
          : lang('GiftInfoPeerDescriptionFreeUpgradeOut', { peer: getPeerTitle(lang, renderingTargetPeer!)! });
      }
      if (!canManage && !isSender) return undefined;
      if (isConverted && canConvert) {
        return canManage
          ? lang('GiftInfoDescriptionConverted', {
            amount: starsToConvert,
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          })
          : lang('GiftInfoPeerDescriptionOutConverted', {
            amount: starsToConvert,
            peer: getPeerTitle(lang, renderingTargetPeer!)!,
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          });
      }

      if (savedGift.canUpgrade && canManage) {
        if (canConvert) {
          return lang('GiftInfoDescriptionUpgrade', {
            amount: starsToConvert,
          }, {
            pluralValue: starsToConvert,
            withNodes: true,
            withMarkdown: true,
          });
        }

        return lang('GiftInfoDescriptionUpgradeRegular');
      }

      if (canManage) {
        if (canConvert) {
          return lang('GiftInfoDescription', {
            amount: starsToConvert,
          }, {
            withNodes: true,
            withMarkdown: true,
            pluralValue: starsToConvert,
          });
        }

        return lang('GiftInfoDescriptionRegular');
      }

      if (canConvert) {
        return lang('GiftInfoPeerDescriptionOut', {
          amount: starsToConvert,
          peer: getPeerTitle(lang, renderingTargetPeer!)!,
        }, {
          withNodes: true,
          withMarkdown: true,
          pluralValue: starsToConvert,
        });
      }

      return lang('GiftInfoPeerDescriptionOutRegular', { peer: getPeerTitle(lang, renderingTargetPeer!)! });
    })();

    function getTitle() {
      if (isGiftUnique) return gift.title;
      if (!savedGift) return lang('GiftInfoSoldOutTitle');

      return canManage ? lang('GiftInfoReceived') : lang('GiftInfoTitle');
    }

    const uniqueGiftModalHeader = (
      <div
        className={styles.modalHeader}
      >

        <Button
          className={styles.closeButton}
          round
          color="translucent-white"
          size="tiny"
          iconName="close"
          ariaLabel={lang('Close')}
          onClick={handleClose}
        />

        <Button
          ref={moreButtonRef}
          className={styles.moreMenuButton}
          round
          color="translucent-white"
          size="tiny"
          iconName="more"
          aria-haspopup="menu"
          aria-label={lang('AriaMoreButton')}
          onContextMenu={handleContextMenu}
          onClick={handleContextMenu}
        />

        {Boolean(resellPrice?.amount) && (
          <div className={styles.giftResalePriceContainer}>
            {resellPrice.currency === TON_CURRENCY_CODE
              ? formatTonAsIcon(lang, resellPrice.amount, {
                className: styles.giftResalePriceStar,
                shouldConvertFromNanos: true,
              })
              : formatStarsAsIcon(lang, resellPrice.amount, {
                asFont: true,
                className: styles.giftResalePriceStar,
              })}
          </div>
        )}
      </div>
    );

    const uniqueGiftHeader = isGiftUnique && (
      <div ref={uniqueGiftHeaderRef} className={buildClassName(styles.header, styles.uniqueGift)}>
        <UniqueGiftHeader
          backdropAttribute={giftAttributes!.backdrop!}
          patternAttribute={giftAttributes!.pattern!}
          modelAttribute={giftAttributes!.model!}
          title={gift.title}
          subtitle={giftSubtitle}
          subtitlePeer={releasedByPeer}
          showManageButtons={canManage}
          savedGift={savedGift}
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
        {Boolean(description) && (
          <p className={buildClassName(styles.description, isWarningDescription && styles.warningDescription)}>
            {description}
          </p>
        )}
      </div>
    );

    const tableData: TableData = [];
    if (gift.type === 'starGift') {
      const hasFrom = fromId || isNameHidden;

      if (hasFrom) {
        tableData.push([
          lang('GiftInfoFrom'),
          !fromId ? (
            <>
              <Avatar size="small" peer={CUSTOM_PEER_HIDDEN} />
              <span className={styles.unknown}>{oldLang(CUSTOM_PEER_HIDDEN.titleKey!)}</span>
            </>
          ) : { chatId: fromId },
        ]);
      }

      if (savedGift?.date) {
        tableData.push([
          lang('GiftInfoDate'),
          <span title={saleDateInfo}>{formatDateTimeToString(savedGift.date * 1000, lang.code, true)}</span>,
        ]);
      }

      if (gift.firstSaleDate && !savedGift) {
        tableData.push([
          lang('GiftInfoFirstSale'),
          formatDateTimeToString(gift.firstSaleDate * 1000, lang.code, true),
        ]);
      }

      if (gift.lastSaleDate && !savedGift) {
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
          {canManage && hasConvertOption && Boolean(starsToConvert) && (
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

      if (gift.upgradeStars && !upgradeMsgId) {
        tableData.push([
          lang('GiftInfoStatus'),
          <div className={styles.giftValue}>
            {lang('GiftInfoStatusNonUnique')}
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
      const ownerPeer = ownerId ? selectPeer(getGlobal(), ownerId) : undefined;
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
      } else if (ownerPeer || ownerName) {
        tableData.push([
          lang('GiftInfoOwner'),
          ownerId ? { chatId: ownerId, withEmojiStatus: true } : ownerName || '',
        ]);
      }

      if (model) {
        tableData.push([
          lang('GiftAttributeModel'),
          <span className={styles.uniqueAttribute}>
            <span
              className={styles.attributeName}
              onClick={handleModelClick}
            >
              {model.name}
            </span>
            <BadgeButton>{formatPercent(model.rarityPercent)}</BadgeButton>
          </span>,
        ]);
      }

      if (backdrop) {
        tableData.push([
          lang('GiftAttributeBackdrop'),
          <span className={styles.uniqueAttribute}>
            <span
              className={styles.attributeName}
              onClick={handleBackdropClick}
            >
              {backdrop.name}
            </span>
            <BadgeButton>{formatPercent(backdrop.rarityPercent)}</BadgeButton>
          </span>,
        ]);
      }

      if (pattern) {
        tableData.push([
          lang('GiftAttributeSymbol'),
          <span className={styles.uniqueAttribute}>
            <span
              className={styles.attributeName}
              onClick={handleSymbolClick}
            >
              {pattern.name}
            </span>
            <BadgeButton>{formatPercent(pattern.rarityPercent)}</BadgeButton>
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

      if (gift.valueAmount && gift.valueCurrency) {
        tableData.push([
          lang('GiftInfoValue'),
          <span className={styles.uniqueValue}>
            ~
            {' '}
            {formatCurrencyAsString(
              gift.valueAmount,
              gift.valueCurrency,
              lang.code,
            )}
            <BadgeButton onClick={handleOpenValueModal}>
              {lang('GiftInfoValueLinkMore')}
            </BadgeButton>
          </span>,
        ]);
      }

      if (originalDetails) {
        const { recipientId, senderId } = originalDetails;
        const global = getGlobal(); // Peer titles do not need to be reactive

        const openChat = (id: string) => {
          openChatWithInfo({ id });
          closeGiftInfoModal();
        };

        const recipient = selectPeer(global, recipientId)!;
        const sender = senderId ? selectPeer(global, senderId) : undefined;

        const text = renderGiftOriginalInfo({
          originalDetails, recipient, sender, onOpenChat: openChat, lang,
        });

        tableData.push([
          undefined,
          <div className={styles.messageContainer}>
            <div>
              {text}
            </div>
            {Boolean(savedGift?.dropOriginalDetailsStars) && (
              <Button
                round
                className={styles.removeMessageButton}
                size="smaller"
                color="translucent"
                ariaLabel="Delete original details"
                onClick={handleRemoveMessage}
                iconName="delete"
              />
            )}
          </div>,
        ]);
      }
    }

    const tonLink = tonExplorerUrl && isGiftUnique && gift.giftAddress && (
      `${tonExplorerUrl}${gift.giftAddress}`
    );

    const footer = (
      <div className={styles.footer}>
        {(canManage || tonLink || canBuyGift) && (
          <div className={styles.footerDescription}>
            {tonLink && (
              <div>
                {lang('GiftInfoTonText', {
                  link: <SafeLink url={tonLink} shouldSkipModal text={lang('GiftInfoTonLinkText')} />,
                }, { withNodes: true })}
              </div>
            )}
            {canManage && (
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
            )}
            {!canBuyGift && isVisibleForMe && (
              <div>
                {lang('GiftInfoSenderHidden')}
              </div>
            )}
            {canBuyGift && giftOwnerTitle && (
              <div>
                {lang('GiftInfoBuyGift', {
                  user: giftOwnerTitle,
                }, { withNodes: true })}
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
    canManage, hasConvertOption, isSender, oldLang, tonExplorerUrl,
    gift, giftAttributes, renderFooterButton, isTargetChat,
    isGiftUnique, saleDateInfo,
    canBuyGift, giftOwnerTitle, resellPrice, giftSubtitle,
    releasedByPeer, handleSymbolClick, handleBackdropClick, handleModelClick,
    handleContextMenu,
  ]);

  const getRootElement = useLastCallback(() => uniqueGiftHeaderRef.current);
  const getTriggerElement = useLastCallback(() => moreButtonRef.current);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const uniqueGiftContextMenu = contextMenuAnchor && typeGift && (
    <Menu
      ref={menuRef}
      isOpen={isContextMenuOpen}
      anchor={contextMenuAnchor}
      className="gift-context-menu with-menu-transitions"
      autoClose
      withPortal
      onClose={handleContextMenuClose}
      onCloseAnimationEnd={handleContextMenuHide}
      positionX="right"
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElement}
      getMenuElement={getMenuElement}
      getLayout={getLayout}
    >
      <GiftMenuItems
        peerId={renderingModal!.peerId!}
        gift={typeGift}
        canManage={canManage}
        collectibleEmojiStatuses={collectibleEmojiStatuses}
        currentUserEmojiStatus={currentUserEmojiStatus}
      />
    </Menu>
  );

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
        contentClassName={styles.modalContent}
        onClose={handleClose}
        withBalanceBar={Boolean(canBuyGift)}
        currencyInBalanceBar={confirmPrice?.currency}
        isLowStackPriority
      />
      {uniqueGiftContextMenu}
      {uniqueGift && currentUser && Boolean(confirmPrice) && (
        <ConfirmDialog
          isOpen={isConfirmModalOpen}
          noDefaultTitle
          onClose={closeConfirmModal}
          confirmLabel={lang('ButtonBuyGift', {
            stars: confirmPrice?.currency === TON_CURRENCY_CODE
              ? formatTonAsIcon(lang, confirmPrice.amount, { shouldConvertFromNanos: true })
              : formatStarsAsIcon(lang, confirmPrice.amount, { asFont: true }),
          }, { withNodes: true })}
          confirmHandler={handleConfirmBuyGift}
        >

          {uniqueGift.resaleTonOnly
            && (
              <div className={styles.descriptionConfirm}>
                {lang('ConfirmBuyGiftForTonDescription')}
              </div>
            )}
          <GiftTransferPreview
            peer={recipientPeer || currentUser}
            gift={uniqueGift}
          />
          <div className={styles.titleConfirm}>
            {lang('TitleConfirmPayment')}
          </div>
          {!recipientPeer
            && (
              <p>
                {lang('GiftBuyConfirmDescription', {
                  gift: lang('GiftUnique', { title: uniqueGift.title, number: uniqueGift.number }),
                  stars: confirmPrice?.currency === TON_CURRENCY_CODE
                    ? formatTonAsText(lang, confirmPrice.amount, true)
                    : formatStarsAsText(lang, confirmPrice.amount),
                }, {
                  withNodes: true,
                  withMarkdown: true,
                })}
              </p>
            )}
          {recipientPeer
            && (
              <p>
                {lang('GiftBuyForPeerConfirmDescription', {
                  gift: lang('GiftUnique', { title: uniqueGift.title, number: uniqueGift.number }),
                  stars: confirmPrice?.currency === TON_CURRENCY_CODE
                    ? formatTonAsText(lang, confirmPrice.amount, true)
                    : formatStarsAsText(lang, confirmPrice.amount),
                  peer: getPeerTitle(lang, recipientPeer),
                }, {
                  withNodes: true,
                  withMarkdown: true,
                })}
              </p>
            )}
          {!uniqueGift.resaleTonOnly && (
            <>
              <Checkbox
                className={styles.checkBox}
                label={lang('LabelPayInTON')}
                checked={shouldPayInTon}
                onCheck={setShouldPayInTon}
              />

              <div className={styles.checkBoxDescription}>
                {lang('DescriptionPayInTON')}
              </div>
            </>
          )}
        </ConfirmDialog>
      )}
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
          {hasConvertOption && (
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
  (global, { modal }): Complete<StateProps> => {
    const typeGift = modal?.gift;
    const isSavedGift = typeGift && 'gift' in typeGift;
    const currentUserId = global.currentUserId;

    const fromId = isSavedGift && typeGift.fromId;
    const fromPeer = fromId ? selectPeer(global, fromId) : undefined;
    const targetPeer = modal?.peerId ? selectPeer(global, modal.peerId) : undefined;
    const chat = targetPeer && isApiPeerChat(targetPeer) ? targetPeer : undefined;
    const hasAdminRights = chat && getHasAdminRight(chat, 'postMessages');
    const currentUser = selectUser(global, currentUserId!);
    const recipientPeer = modal?.recipientId && currentUserId !== modal.recipientId
      ? selectPeer(global, modal.recipientId) : undefined;
    const currentUserEmojiStatus = currentUser?.emojiStatus;
    const collectibleEmojiStatuses = global.collectibleEmojiStatuses?.statuses;

    const gift = isSavedGift ? typeGift.gift : typeGift;
    const releasedByPeerId = gift?.type === 'starGiftUnique' && gift.releasedByPeerId;
    const releasedByPeer = releasedByPeerId ? selectPeer(global, releasedByPeerId) : undefined;

    return {
      fromPeer,
      targetPeer,
      releasedByPeer,
      currentUserId,
      starGiftMaxConvertPeriod: global.appConfig.starGiftMaxConvertPeriod,
      tonExplorerUrl: global.appConfig.tonExplorerUrl,
      hasAdminRights,
      currentUserEmojiStatus,
      collectibleEmojiStatuses,
      currentUser,
      recipientPeer,
    };
  },
)(GiftInfoModal));
