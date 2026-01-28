import { memo } from '@teact';

import useAppLayout from '../../../hooks/useAppLayout';

import Button from '../../../components/ui/Button';

interface OwnProps {
  onTrigger: () => void;
  isOpen?: boolean;
}

const HeaderMenuButton = ({ onTrigger, isOpen }: OwnProps) => {
  const { isMobile } = useAppLayout();
  return (
    <Button
      round
      ripple={!isMobile}
      size="smaller"
      color="translucent"
      className={isOpen ? 'active' : ''}
      onClick={onTrigger}
      ariaLabel="More actions"
      iconName="more"
    />
  );
};

export default memo(HeaderMenuButton);
