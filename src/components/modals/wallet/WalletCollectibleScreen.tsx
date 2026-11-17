import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, getPromiseActions } from '../../../global';

import type { ApiStarGiftAttributeRarity, ApiWalletCollectible } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { CardEditorRef } from './helpers/cardEditing';

import {
  selectCanEditOwnWalletCard, selectOwnWalletCardDecoration, selectWalletAddress,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import { getGiftAttributes, getStickerFromGift } from '../../common/helpers/gifts';
import {
  getCanColorCard,
  getIsStickerOnCard,
  removeStickerFromCard,
  saveCardDecoration,
  showStickerLimitError,
} from './helpers/cardEditing';
import { planStickerChange } from './helpers/cardStickerCommands';
import { loadStickerTexture } from './helpers/stickerTexture';

import useSelector from '../../../hooks/data/useSelector';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import BadgeButton from '../../common/BadgeButton';
import GiftRarityBadge from '../../common/GiftRarityBadge';
import Button from '../../ui/Button';
import TableInfo, { type TableData } from '../common/TableInfo';
import UniqueGiftHeader from '../gift/UniqueGiftHeader';
import WalletAddressGroups from './WalletAddressGroups';
import WalletCollectibleImage from './WalletCollectibleImage';
import CheckboxField from '@gili/templates/CheckboxField';

import giftHeaderStyles from '../gift/UniqueGiftHeader.module.scss';
import styles from './WalletCollectibleScreen.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  isActive: boolean;
  // The editor of the card under this screen, which makes a change and animates it
  cardEditorRef?: CardEditorRef;
  onTransfer: (collectible: ApiWalletCollectible) => void;
  onDone: NoneToVoidFunction;
};

// Splits the collection slug into words, as `PlushPepe` names the Plush Pepe collection
const SLUG_WORD_BOUNDARY = /(?<=[a-z])(?=[A-Z])/;

const WalletCollectibleScreen = ({
  collectible, isActive, cardEditorRef, onTransfer, onDone,
}: OwnProps) => {
  const {
    openUrl, openGiftPreviewModal, openGiftInfoValueModal, showNotification,
  } = getActions();

  const lang = useLang();

  const rootRef = useRef<HTMLDivElement>();

  const currentUserId = useSelector(selectCurrentUserId);
  const walletAddress = useSelector(selectWalletAddress);
  const currentDecoration = useSelector(selectOwnWalletCardDecoration);
  const canEditCard = useSelector(selectCanEditOwnWalletCard);
  const backgroundCollections = useSelector(selectCardBackgroundCollections);

  // An action takes the screen back to the card, and the screen keeps its buttons while it slides away
  const { decoration } = useFrozenProps({ decoration: currentDecoration }, !isActive);

  // The value asked of the server, shown until it answers
  const [shouldDisplayInGifts, setShouldDisplayInGifts] = useState<boolean | undefined>();

  const {
    address, name, description, fragmentUrl, attributes,
  } = collectible;
  const gift = collectible.type === 'gift' ? collectible.gift : undefined;
  const isShownInGifts = Boolean(currentUserId && gift?.hostPeerId === currentUserId);
  const isDisplayPending = shouldDisplayInGifts !== undefined;
  const isOnCard = getIsStickerOnCard(decoration, address);
  const isColored = decoration?.backgroundAddress === address;
  const canColor = Boolean(gift && getCanColorCard(gift, backgroundCollections));

  const giftAttributes = useMemo(() => gift && getGiftAttributes(gift), [gift]);

  // Loads the texture for the flight of a sticker off the gift model
  useEffect(() => {
    const sticker = gift && getStickerFromGift(gift);
    if (sticker) void loadStickerTexture(sticker);
  }, [gift]);
  const { model, backdrop, pattern } = giftAttributes || {};

  const handleSell = useLastCallback(() => {
    openUrl({ url: fragmentUrl, shouldSkipModal: true });
  });

  const handleTransfer = useLastCallback(() => {
    onTransfer(collectible);
  });

  // As in the iOS app, the screen goes back to the card, which shows the change. The editor of the card makes the
  // change and animates it; without it, as on a gift screen opened alone, the screen saves the change itself.
  const changeSticker = useLastCallback((isColor?: boolean) => {
    const request = {
      address, gift: gift!, isColor, source: findGiftModel(),
    };
    const editor = cardEditorRef?.current;
    if (editor) {
      editor.requestSticker(request);
      onDone();
      return;
    }

    const change = planStickerChange(decoration, request, backgroundCollections);
    if (change.type === 'limit') {
      showStickerLimitError();
      return;
    }

    if (change.type === 'restricted') return;

    saveCardDecoration(change.type === 'remove' ? removeStickerFromCard(decoration, address) : change.decoration);
    onDone();
  });

  const handleToggleSticker = useLastCallback(() => {
    changeSticker();
  });

  const handleToggleColor = useLastCallback(() => {
    if (!isColored && !canColor) {
      const collections = backgroundCollections?.map((slug) => (
        lang('WalletStickerColorCollection', { collection: slug.split(SLUG_WORD_BOUNDARY).join(' ') })
      ));
      if (collections?.length) {
        showNotification({
          message: { key: 'WalletStickerColorRestricted', variables: { collections: lang.conjunction(collections) } },
        });
      }
      return;
    }

    changeSticker(true);
  });

  const handleOpenPreview = useLastCallback(() => {
    openGiftPreviewModal({ originGift: gift! });
  });

  const handleOpenValue = useLastCallback(() => {
    openGiftInfoValueModal({ gift: gift! });
  });

  const handleShowInGiftsChange = useLastCallback(async (isChecked: boolean) => {
    setShouldDisplayInGifts(isChecked);
    await getPromiseActions().displayWalletGift({ collectibleAddress: address, shouldDisplay: isChecked });
    setShouldDisplayInGifts(undefined);
  });

  function renderAttribute(attributeName: string, rarity: ApiStarGiftAttributeRarity) {
    return (
      <button type="button" className={styles.giftAttribute} onClick={handleOpenPreview}>
        <span className={styles.giftAttributeName}>{attributeName}</span>
        <GiftRarityBadge rarity={rarity} />
      </button>
    );
  }

  const tableData = useMemo<TableData | undefined>(() => {
    if (!gift) {
      return attributes?.map(({ traitType, value }) => [traitType, value]);
    }

    const rows: TableData = [];

    if (walletAddress) {
      rows.push([
        lang('GiftInfoOwner'),
        <WalletAddressGroups address={walletAddress} isCheckered className={styles.owner} />,
      ]);
    }

    if (model) rows.push([lang('GiftAttributeModel'), renderAttribute(model.name, model.rarity)]);
    if (backdrop) rows.push([lang('GiftAttributeBackdrop'), renderAttribute(backdrop.name, backdrop.rarity)]);
    if (pattern) rows.push([lang('GiftAttributeSymbol'), renderAttribute(pattern.name, pattern.rarity)]);

    rows.push([
      lang('GiftInfoAvailability'),
      lang('GiftInfoIssued', { issued: gift.issuedCount, total: gift.totalCount }),
    ]);

    if (gift.valueAmount && gift.valueCurrency) {
      rows.push([
        lang('GiftInfoValue'),
        <span className={styles.giftValue}>
          {lang('GiftInfoValueAmount', {
            amount: formatCurrencyAsString(gift.valueAmount, gift.valueCurrency, lang.code),
          })}
          <BadgeButton onClick={handleOpenValue}>{lang('GiftInfoValueLinkMore')}</BadgeButton>
        </span>,
      ]);
    }

    return rows;
  }, [gift, attributes, walletAddress, model, backdrop, pattern, lang]);

  function renderGiftHeader() {
    const title = lang('GiftInfoUniqueTitle', {
      name: gift!.title,
      number: (
        <span className={styles.giftNumber} style={`color: ${backdrop!.textColor}`}>
          {lang('GiftSavedNumber', { number: gift!.number })}
        </span>
      ),
    }, { withNodes: true });

    return (
      <UniqueGiftHeader
        className={styles.giftHeader}
        modelAttribute={model!}
        backdropAttribute={backdrop!}
        patternAttribute={pattern!}
        title={title}
        showManageButtons
      >
        <div className={styles.giftActions}>
          <Button
            className={styles.giftAction}
            color="transparentBlured"
            iconName="gift-transfer-inline"
            iconAlignment="top"
            iconClassName={styles.giftActionIcon}
            noForcedUpperCase
            fluid
            onClick={handleTransfer}
          >
            <span className={styles.giftActionText}>{lang('GiftInfoTransfer')}</span>
          </Button>
          <Button
            className={buildClassName(styles.giftAction, !isColored && !canColor && styles.giftActionRestricted)}
            color="transparentBlured"
            iconName={isColored ? 'palette-crossed' : 'appearance-filled'}
            iconAlignment="top"
            iconClassName={styles.giftActionIcon}
            noForcedUpperCase
            fluid
            disabled={!canEditCard}
            onClick={handleToggleColor}
          >
            <span className={styles.giftActionText}>
              {lang(isColored ? 'WalletStickerRemoveColor' : 'WalletStickerApplyColor')}
            </span>
          </Button>
          <Button
            className={styles.giftAction}
            color="transparentBlured"
            iconName={isOnCard ? 'card-crossed' : 'card-arrow'}
            iconAlignment="top"
            iconClassName={styles.giftActionIcon}
            noForcedUpperCase
            fluid
            disabled={!canEditCard}
            onClick={handleToggleSticker}
          >
            <span className={styles.giftActionText}>
              {lang(isOnCard ? 'WalletStickerRemoveFromCard' : 'WalletStickerAddToCard')}
            </span>
          </Button>
        </div>
      </UniqueGiftHeader>
    );
  }

  function renderHeader() {
    return (
      <>
        <WalletCollectibleImage collectible={collectible} isFull className={styles.image} />
        <div className={styles.name}>{name ?? lang('WalletCollectibleTitle')}</div>
        {description && <div className={styles.description}>{description}</div>}
        <div className={styles.actions}>
          <Button pill onClick={handleTransfer}>
            {lang('WalletCollectibleTransfer')}
          </Button>
          <Button isText pill onClick={handleSell}>
            {lang('WalletCollectibleSell')}
          </Button>
        </div>
      </>
    );
  }

  // The shown model of the gift header, which a new sticker flies from
  function findGiftModel() {
    const models = rootRef.current?.querySelectorAll<HTMLElement>(`.${giftHeaderStyles.sticker}`);

    return models?.[models.length - 1];
  }

  return (
    <div ref={rootRef} className={styles.root}>
      {model && backdrop && pattern ? renderGiftHeader() : renderHeader()}
      <TableInfo tableData={tableData} className={styles.table} />
      {gift && (
        <CheckboxField
          className={styles.showInGifts}
          label={lang('WalletCollectibleShowInGifts')}
          checked={shouldDisplayInGifts ?? isShownInGifts}
          disabled={isDisplayPending}
          loading={isDisplayPending}
          isCentered
          onChange={handleShowInGiftsChange}
        />
      )}
      <Button isText pill className={styles.done} onClick={onDone}>
        {lang('OK')}
      </Button>
    </div>
  );
};

function selectCurrentUserId(global: GlobalState) {
  return global.currentUserId;
}

function selectCardBackgroundCollections(global: GlobalState) {
  return global.appConfig.walletCardBackgroundCollections;
}

export default memo(WalletCollectibleScreen);
