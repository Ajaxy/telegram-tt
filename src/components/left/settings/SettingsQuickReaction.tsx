import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAvailableReaction, ApiReaction } from '../../../api/types';

import useHistoryBack from '../../../hooks/useHistoryBack';

import ReactionStaticEmoji from '../../common/reactions/ReactionStaticEmoji';
import Island from '../../gili/layout/Island';
import Surface from '../../gili/layout/Surface';
import RadioGroup from '../../ui/RadioGroup';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  availableReactions?: ApiAvailableReaction[];
  selectedReaction?: ApiReaction;
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
      reaction: { type: 'emoji', emoticon: reaction },
    });
  }, [setDefaultReaction]);

  return (
    <Surface scrollable className="settings-content settings-quick-reaction">
      <Island>
        <RadioGroup
          name="quick-reaction-settings"
          options={options}
          selected={selectedReaction?.type === 'emoji' ? selectedReaction.emoticon : undefined}
          onChange={handleChange}
          withIcon
        />
      </Island>
    </Surface>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { config, reactions } = global;

    return {
      availableReactions: reactions.availableReactions,
      selectedReaction: config?.defaultReaction,
    };
  },
)(SettingsQuickReaction));
