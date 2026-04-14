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
import { formatDateTimeToString } from '../../../../util/dates/oldDateFormat';
import { formatCurrency, formatCurrencyAsString } from '../../../../util/formatCurrency';
import {
  formatStarsAsIcon, formatStarsAsText, formatTonAsIcon, formatTonAsText,
  NEXT_ARROW_REPLACEMENT,
} from '../../../../util/localization/format';
import { CUSTOM_PEER_HIDDEN } from '../../../../util/objects/customPeer';
import { getServerTime } from '../../../../util/serverTime';
import { renderGiftOriginalInfo } from '../../../common/helpers/giftOriginalInfo';
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
import GiftMenuItems from '../../../common/gift/GiftMenuItems';
import GiftTransferPreview from '../../../common/gift/GiftTransferPreview';
import GiftRarityBadge from '../../../common/GiftRarityBadge';
import Icon from '../../../common/icons/Icon';
import SafeLink from '../../../common/SafeLink';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import Link from '../../../ui/Link';
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
    openGiftCraftModal,
    showNotification,
    buyStarGift,
    closeGiftModal,
    openGiftInfoValueModal,
    openGiftDescriptionRemoveModal,
    openGiftPreviewModal,
  } = getActions();

  const [isConvertConfirmOpen, openConvertConfirm, closeConvertConfirm] = useFlag();

  const lang = useLang();
  const oldLang = useOldLang();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [shouldPayInTon, setShouldPayInTon] = useState<boolean>(false);

  const uniqueGiftHeaderRef = useRef<HTMLDivElement>();

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

  const handleOpenCraftModal = useLastCallback(() => {
    if (!savedGift || savedGift.gift.type !== 'starGiftUnique') return;
    handleClose();
    openGiftCraftModal({ gift: savedGift });
  });

  const giftAttributes = useMemo(() => {
    return gift && getGiftAttributes(gift);
  }, [gift]);

  const handleOpenPreviewModal = useLastCallback(() => {
    if (!gift) return;
    openGiftPreviewModal({
      originGift: gift,
    });
  });

  const uniqueGiftTitle = useMemo(() => {
    if (!gift || gift.type !== 'starGiftUnique' || !giftAttributes?.backdrop) return undefined;

    const numberColor = giftAttributes.backdrop.textColor;

    const digitCount = String(gift.number).length;
    const numberSizeClass = digitCount >= 6 ? styles.small : styles.regular;
    const styledNumber = (
      <span className={buildClassName(styles.uniqueTitleNumber, numberSizeClass)} style={`color: ${numberColor}`}>
        {lang('GiftSavedNumber', { number: gift.number })}
      </span>
    );

    return lang('GiftInfoUniqueTitle', {
      name: gift.title,
      number: styledNumber,
    }, { withNodes: true });
  }, [gift, giftAttributes, lang]);

  const uniqueGiftSubtitle = useMemo(() => {
    if (!gift || gift.type !== 'starGiftUnique') return undefined;

    if (releasedByPeer) {
      const releasedByUsername = `@${getMainUsername(releasedByPeer)}`;
      const ownerTitle = releasedByUsername || getPeerTitle(lang, releasedByPeer);
      const fallbackText = isApiPeerUser(releasedByPeer)
        ? lang('ActionFallbackUser')
        : lang('ActionFallbackChannel');

      return ownerTitle || fallbackText;
    }

    const modelName = giftAttributes?.model?.name;

    return modelName;
  }, [gift, giftAttributes, releasedByPeer, lang]);

  const renderFooterButton = useLastCallback(() => {
    if (canBuyGift) {
      return (
        <Button className={styles.buyButton} onClick={handleBuyGift}>
          <span>
            {lang('ButtonBuyGift', {
              stars: formatCurrency(lang, resellPrice.amount, resellPrice.currency, { asFontIcon: true }),
            }, { withNodes: true })}
          </span>
          {resellPrice?.currency === TON_CURRENCY_CODE && Boolean(resellPriceInStars) && (
            <span className={styles.footerHint}>
              {lang('GiftBuyEqualsTo', {
                stars: formatStarsAsIcon(lang, resellPriceInStars.amount, { asFont: true }),
              }, { withNodes: true })}
            </span>
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

  // ToDo
  // const canCraft = Boolean(
  //   canManage && savedGift?.canCraftAt && getServerTime() >= savedGift.canCraftAt,
  // );

  // Mock for Tests
  const canCraft = Boolean(canManage && savedGift?.canCraftAt);

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
      <div className={styles.modalHeader}>
        <Button
          className={styles.closeButton}
          round
          color="translucent-white"
          size="tiny"
          iconName="close"
          ariaLabel={lang('Close')}
          onClick={handleClose}
        />
      </div>
    );

    const headerRightToolBar = (Boolean(resellPrice?.amount) || canCraft) ? (
      <div className={styles.headerRightButtons}>
        {Boolean(resellPrice?.amount) && (
          <div className={styles.giftResalePriceContainer}>
            {formatCurrency(lang, resellPrice.amount, resellPrice.currency, {
              asFontIcon: true,
              iconClassName: styles.giftResalePriceStar,
            })}
          </div>
        )}
        {canCraft && (
          <Button
            className={styles.craftButton}
            round
            color="translucent-white"
            size="tiny"
            ariaLabel={lang('GiftInfoCraft')}
            onClick={handleOpenCraftModal}
          >
            <Icon name="craft" />
          </Button>
        )}
      </div>
    ) : undefined;

    const uniqueGiftHeader = isGiftUnique && (
      <div ref={uniqueGiftHeaderRef} className={buildClassName(styles.header, styles.uniqueGift)}>
        <UniqueGiftHeader
          backdropAttribute={giftAttributes!.backdrop!}
          patternAttribute={giftAttributes!.pattern!}
          modelAttribute={giftAttributes!.model!}
          title={uniqueGiftTitle}
          subtitle={uniqueGiftSubtitle}
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
          {formatStarsAsIcon(lang, starsValue, { className: styles.starAmountIcon, withWrapper: true })}
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
          <span className={styles.uniqueAttribute} onClick={handleOpenPreviewModal}>
            <span className={styles.attributeName}>{model.name}</span>
            <GiftRarityBadge rarity={model.rarity} />
          </span>,
        ]);
      }

      if (backdrop) {
        tableData.push([
          lang('GiftAttributeBackdrop'),
          <span className={styles.uniqueAttribute} onClick={handleOpenPreviewModal}>
            <span className={styles.attributeName}>{backdrop.name}</span>
            <GiftRarityBadge rarity={backdrop.rarity} />
          </span>,
        ]);
      }

      if (pattern) {
        tableData.push([
          lang('GiftAttributeSymbol'),
          <span className={styles.uniqueAttribute} onClick={handleOpenPreviewModal}>
            <span className={styles.attributeName}>{pattern.name}</span>
            <GiftRarityBadge rarity={pattern.rarity} />
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
        const formattedValue = formatCurrencyAsString(gift.valueAmount, gift.valueCurrency, lang.code);
        tableData.push([
          lang('GiftInfoValue'),
          <span className={styles.uniqueValue}>
            {lang('GiftInfoValueAmount', { amount: formattedValue })}
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
                  link: (
                    <SafeLink url={tonLink} shouldSkipModal text={lang('GiftInfoTonLinkText')}>
                      {lang('GiftInfoTonLinkText', undefined,
                        { withNodes: true, specialReplacement: NEXT_ARROW_REPLACEMENT })}
                    </SafeLink>
                  ),
                }, { withNodes: true })}
              </div>
            )}
            {canManage && (
              <div>
                {lang(`GiftInfo${isTargetChat ? 'Channel' : ''}${isUnsaved ? 'Hidden' : 'Saved'}`, {
                  link: (
                    <Link isPrimary onClick={handleTriggerVisibility}>
                      {lang(`GiftInfoSaved${isUnsaved ? 'Show' : 'Hide'}`, undefined,
                        { withNodes: true, specialReplacement: NEXT_ARROW_REPLACEMENT })}
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
      headerRightToolBar: isGiftUnique ? headerRightToolBar : undefined,
      header: isGiftUnique ? uniqueGiftHeader : regularHeader,
      tableData,
      footer,
    };
  }, [
    typeGift, savedGift, renderingTargetPeer, giftSticker, lang,
    canManage, hasConvertOption, isSender, oldLang, tonExplorerUrl,
    gift, giftAttributes, renderFooterButton, isTargetChat,
    isGiftUnique, saleDateInfo, canCraft, handleOpenCraftModal,
    canBuyGift, giftOwnerTitle, resellPrice, uniqueGiftTitle, uniqueGiftSubtitle, releasedByPeer,
  ]);

  const moreMenuItems = typeGift && (
    <GiftMenuItems
      peerId={renderingModal!.peerId!}
      gift={typeGift}
      canManage={canManage}
      collectibleEmojiStatuses={collectibleEmojiStatuses}
      currentUserEmojiStatus={currentUserEmojiStatus}
    />
  );

  return (
    <>
      <TableInfoModal
        isOpen={isOpen}
        modalHeader={modalData?.modalHeader}
        headerRightToolBar={modalData?.headerRightToolBar}
        header={modalData?.header}
        hasBackdrop={isGiftUnique}
        tableData={modalData?.tableData}
        tableClassName={isGiftUnique ? buildClassName(styles.scrollableTable, 'custom-scroll') : undefined}
        footer={modalData?.footer}
        className={buildClassName(styles.modal, 'tall')}
        closeButtonColor={isGiftUnique ? 'translucent-white' : undefined}
        moreMenuItems={moreMenuItems}
        onClose={handleClose}
        withBalanceBar={Boolean(canBuyGift)}
        currencyInBalanceBar={confirmPrice?.currency}
        isLowStackPriority={renderingModal?.craftSlotIndex !== undefined ? true : undefined}
      />
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
