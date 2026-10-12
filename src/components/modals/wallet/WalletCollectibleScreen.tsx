import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiWalletCollectible } from '../../../api/types';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import TableInfo, { type TableData } from '../common/TableInfo';
import WalletCollectibleImage from './WalletCollectibleImage';

import styles from './WalletCollectibleScreen.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  onTransfer: (collectible: ApiWalletCollectible) => void;
  onDone: NoneToVoidFunction;
};

const WalletCollectibleScreen = ({ collectible, onTransfer, onDone }: OwnProps) => {
  const { openUrl } = getActions();

  const lang = useLang();

  const {
    name, description, fragmentUrl, attributes,
  } = collectible;

  const tableData = useMemo<TableData | undefined>(() => (
    attributes?.map(({ traitType, value }) => [traitType, value])
  ), [attributes]);

  const handleSell = useLastCallback(() => {
    openUrl({ url: fragmentUrl, shouldSkipModal: true });
  });

  const handleTransfer = useLastCallback(() => {
    onTransfer(collectible);
  });

  return (
    <div className={styles.root}>
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
      <TableInfo tableData={tableData} className={styles.table} />
      <Button isText pill className={styles.done} onClick={onDone}>
        {lang('OK')}
      </Button>
    </div>
  );
};

export default memo(WalletCollectibleScreen);
