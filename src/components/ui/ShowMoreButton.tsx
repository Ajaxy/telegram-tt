import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

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
  const lang = useLang();

  return (
    <Button
      className="ShowMoreButton"
      color="translucent"
      size="smaller"
      isText
      isLoading={isLoading}
      isRtl={lang.isRtl}
      onClick={onClick}
    >
      <i className="icon icon-down" />
      Show {count} more {count > 1 ? itemPluralName || `${itemName}s` : itemName}
    </Button>
  );
};

export default ShowMoreButton;
