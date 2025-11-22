import type { FC } from '../../lib/teact/teact';

import useOldLang from '../../hooks/useOldLang';

import Button from './Button';

import './ShowMoreButton.scss';

type OwnProps = {
  count: number;
  itemName: string;
  itemPluralName?: string;
  isLoading?: boolean;
  onClick: () => void;
};

const ShowMoreButton: FC<OwnProps> = ({
  count,
  itemName,
  itemPluralName,
  isLoading,
  onClick,
}) => {
  const lang = useOldLang();

  return (
    <Button
      className="ShowMoreButton"
      color="translucent"
      isText
      isLoading={isLoading}
      isRtl={lang.isRtl}
      onClick={onClick}
      iconName="down"
    >
      Show
      {' '}
      {count}
      {' '}
      more
      {' '}
      {count > 1 ? itemPluralName || `${itemName}s` : itemName}
    </Button>
  );
};

export default ShowMoreButton;
