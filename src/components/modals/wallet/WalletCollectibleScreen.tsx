import { memo, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, getPromiseActions } from '../../../global';

import type { ApiStarGiftAttributeRarity, ApiWalletCollectible } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { selectWalletAddress } from '../../../global/selectors';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import { getGiftAttributes } from '../../common/helpers/gifts';

import useSelector from '../../../hooks/data/useSelector';
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

import styles from './WalletCollectibleScreen.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  onTransfer: (collectible: ApiWalletCollectible) => void;
  onDone: NoneToVoidFunction;
};

const WalletCollectibleScreen = ({ collectible, onTransfer, onDone }: OwnProps) => {
  const { openUrl, openGiftPreviewModal, openGiftInfoValueModal } = getActions();

  const lang = useLang();

  const currentUserId = useSelector(selectCurrentUserId);
  const walletAddress = useSelector(selectWalletAddress);

  // The value asked of the server, shown until it answers
  const [shouldDisplayInGifts, setShouldDisplayInGifts] = useState<boolean | undefined>();

  const {
    address, name, description, fragmentUrl, attributes,
  } = collectible;
  const gift = collectible.type === 'gift' ? collectible.gift : undefined;
  const isShownInGifts = Boolean(currentUserId && gift?.hostPeerId === currentUserId);
  const isDisplayPending = shouldDisplayInGifts !== undefined;

  const giftAttributes = useMemo(() => gift && getGiftAttributes(gift), [gift]);
  const { model, backdrop, pattern } = giftAttributes || {};

  const handleSell = useLastCallback(() => {
    openUrl({ url: fragmentUrl, shouldSkipModal: true });
  });

  const handleTransfer = useLastCallback(() => {
    onTransfer(collectible);
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
            className={styles.giftAction}
            color="transparentBlured"
            iconName="sell"
            iconAlignment="top"
            iconClassName={styles.giftActionIcon}
            noForcedUpperCase
            fluid
            onClick={handleSell}
          >
            <span className={styles.giftActionText}>{lang('Sell')}</span>
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

  return (
    <div className={styles.root}>
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

export default memo(WalletCollectibleScreen);
