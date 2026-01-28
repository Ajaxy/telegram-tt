import type { FC, TeactNode } from '@teact';
import { memo, useCallback, useMemo } from '@teact';

import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';
import Button from '../../../../components/ui/Button';
import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';

import styles from './TelebizAgent.module.scss';

type Option = {
  id: string;
  label: string;
  description: string;
  badge?: TeactNode;
};

interface OwnProps {
  options: Option[];
  selected: string;
  onChange: (option: Option) => void;
  disabled?: boolean;
}

const AgentSettingSelector = ({ options, selected, onChange, disabled }: OwnProps) => {
  const handleOptionClick = useCallback((newOption: Option) => {
    if (!disabled && newOption.id !== selected) {
      onChange(newOption);
    }
  }, [disabled, selected, onChange]);

  const selectedOption = useMemo(() => {
    return options.find((o) => o.id === selected);
  }, [options, selected]);

  const SettingMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        fluid
        pill
        size="tiny"
        color="translucent"
        className={buildClassName(styles.settingButton, isOpen ? 'active' : '')}
        onClick={onTrigger}
        ariaLabel={selectedOption?.description}
        iconName="down"
        iconAlignment="end"
      >
        {selectedOption?.label}
      </Button>
    );
  }, [selectedOption]);

  return (
    <DropdownMenu
      className="setting-selector-menu"
      trigger={SettingMenuButton}
      positionX="left"
      positionY="bottom"
    >
      {
        options.map((o) => (
          <MenuItem
            key={o.id}
            onClick={() => handleOptionClick(o)}
            className={buildClassName(styles.settingItem, o.id === selected && styles.settingItemActive)}
          >
            {o.label}
            {o.id === selected && <Icon name="check" className={styles.check} />}
            <span className={styles.badge}>{o.badge}</span>
          </MenuItem>
        ))
      }
    </DropdownMenu>
  );
};

export default memo(AgentSettingSelector);
