import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { SettingsScreens } from '../../../types';
import { ApiAvailableReaction } from '../../../api/types';

import useHistoryBack from '../../../hooks/useHistoryBack';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import RadioGroup from '../../ui/RadioGroup';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  availableReactions?: ApiAvailableReaction[];
  selectedReaction?: string;
};

const SettingsQuickReaction: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  onScreenSelect,
  availableReactions,
  selectedReaction,
}) => {
  const { setDefaultReaction } = getActions();
  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.General);

  const options = availableReactions?.filter((l) => !l.isInactive).map((l) => {
    return {
      label: <><ReactionStaticEmoji reaction={l.reaction} />{l.title}</>,
      value: l.reaction,
    };
  }) || [];

  const handleChange = useCallback((reaction: string) => {
    setDefaultReaction({ reaction });
  }, [setDefaultReaction]);

  return (
    <div className="settings-content settings-item custom-scroll settings-quick-reaction">
      <RadioGroup
        name="quick-reaction-settings"
        options={options}
        selected={selectedReaction}
        onChange={handleChange}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global) => {
    const { availableReactions, appConfig } = global;

    return {
      availableReactions,
      selectedReaction: appConfig?.defaultReaction,
    };
  },
)(SettingsQuickReaction));
