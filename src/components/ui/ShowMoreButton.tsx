import React, { FC } from '../../lib/teact/teact';

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
  return (
    <Button
      className="ShowMoreButton"
      color="translucent"
      size="smaller"
      isText
      isLoading={isLoading}
      onClick={onClick}
    >
      <i className="icon-down" />
      Show {count} more {count > 1 ? itemPluralName || `${itemName}s` : itemName}
    </Button>
  );
};

export default ShowMoreButton;
