import { memo } from '../../../lib/teact/teact';

import type { ApiWalletCollectible } from '../../../api/types';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import WalletCollectibleImage from './WalletCollectibleImage';
import Control, { ControlBefore, ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';

import styles from './WalletCollectibleItem.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  onClick: (collectible: ApiWalletCollectible) => void;
};

const WalletCollectibleItem = ({ collectible, onClick }: OwnProps) => {
  const { name, description } = collectible;

  const lang = useLang();

  const subtitle = collectible.type === 'gift' && collectible.model && collectible.backdrop
    ? lang('WalletCollectibleTraits', { model: collectible.model, backdrop: collectible.backdrop })
    : description;

  const handleClick = useLastCallback(() => {
    onClick(collectible);
  });

  return (
    <Interactive clickable ripple onClick={handleClick}>
      <Control className={styles.root}>
        <ControlBefore>
          <WalletCollectibleImage collectible={collectible} className={styles.preview} />
        </ControlBefore>
        <ControlLabel>{name ?? lang('WalletCollectibleTitle')}</ControlLabel>
        {subtitle && <ControlDescription className={styles.subtitle}>{subtitle}</ControlDescription>}
      </Control>
    </Interactive>
  );
};

export default memo(WalletCollectibleItem);
