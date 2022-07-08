import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAvailableReaction } from '../../../api/types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';

import useHistoryBack from '../../../hooks/useHistoryBack';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import RadioGroup from '../../ui/RadioGroup';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  availableReactions?: ApiAvailableReaction[];
  isPremium?: boolean;
  selectedReaction?: string;
};

const SettingsQuickReaction: FC<OwnProps & StateProps> = ({
  isActive,
  availableReactions,
  isPremium,
  selectedReaction,
  onReset,
}) => {
  const { setDefaultReaction } = getActions();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const options = availableReactions?.filter((l) => (
    !(l.isInactive || (!isPremium && l.isPremium))
  )).map((l) => {
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
    const isPremium = selectIsCurrentUserPremium(global);

    return {
      availableReactions,
      selectedReaction: appConfig?.defaultReaction,
      isPremium,
    };
  },
)(SettingsQuickReaction));
