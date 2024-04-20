import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAvailableReaction } from '../../../api/types';

import useHistoryBack from '../../../hooks/useHistoryBack';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import RadioGroup from '../../ui/RadioGroup';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  availableReactions?: ApiAvailableReaction[];
  selectedReaction?: string;
};

const SettingsQuickReaction: FC<OwnProps & StateProps> = ({
  isActive,
  availableReactions,
  selectedReaction,
  onReset,
}) => {
  const { setDefaultReaction } = getActions();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const options = useMemo(() => (
    (availableReactions || []).filter((availableReaction) => !availableReaction.isInactive)
      .map((availableReaction) => ({
        label: (
          <>
            <ReactionStaticEmoji reaction={availableReaction.reaction} availableReactions={availableReactions} />
            {availableReaction.title}
          </>
        ),
        value: availableReaction.reaction.emoticon,
      }))
  ), [availableReactions]);

  const handleChange = useCallback((reaction: string) => {
    setDefaultReaction({
      reaction: { emoticon: reaction },
    });
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
    const { config, reactions } = global;

    return {
      availableReactions: reactions.availableReactions,
      selectedReaction: config?.defaultReaction,
    };
  },
)(SettingsQuickReaction));
