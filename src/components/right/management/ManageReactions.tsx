import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../modules';

import { ApiAvailableReaction, ApiChat } from '../../../api/types';

import { selectChat } from '../../../modules/selectors';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  availableReactions?: ApiAvailableReaction[];
  enabledReactions?: string[];
};

const ManageReactions: FC<OwnProps & StateProps> = ({
  availableReactions,
  enabledReactions,
  chat,
  isActive,
  onClose,
}) => {
  const { setChatEnabledReactions } = getActions();

  const lang = useLang();
  const [isTouched, setIsTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localEnabledReactions, setLocalEnabledReactions] = useState(enabledReactions || []);

  useHistoryBack(isActive, onClose);

  const handleSaveReactions = useCallback(() => {
    if (!chat) return;
    setIsLoading(true);

    setChatEnabledReactions({
      chatId: chat.id,
      enabledReactions: localEnabledReactions,
    });
  }, [chat, localEnabledReactions, setChatEnabledReactions]);

  useEffect(() => {
    if (enabledReactions) {
      setIsLoading(false);
      setIsTouched(false);
      setLocalEnabledReactions(enabledReactions);
    }
  }, [enabledReactions]);

  const handleReactionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!chat || !availableReactions) return;

    const { name, checked } = e.currentTarget;
    const newEnabledReactions = name === 'all' ? (checked ? availableReactions.map((l) => l.reaction) : [])
      : (!checked
        ? localEnabledReactions.filter((l) => l !== name)
        : [...localEnabledReactions, name]);

    setLocalEnabledReactions(newEnabledReactions);
    setIsTouched(true);
  }, [availableReactions, chat, localEnabledReactions]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <div className="ListItem no-selection">
            <Checkbox
              name="all"
              checked={!localEnabledReactions || localEnabledReactions.length > 0}
              label={lang('EnableReactions')}
              onChange={handleReactionChange}
            />
          </div>
          {availableReactions?.filter((l) => !l.isInactive).map(({ reaction, title }) => (
            <div className="ListItem no-selection">
              <Checkbox
                name={reaction}
                checked={!localEnabledReactions || localEnabledReactions?.includes(reaction)}
                disabled={localEnabledReactions?.length === 0}
                label={(
                  <div className="Reaction">
                    <ReactionStaticEmoji reaction={reaction} />
                    {title}
                  </div>
                )}
                onChange={handleReactionChange}
              />
            </div>
          ))}
        </div>
      </div>

      <FloatingActionButton
        isShown={isTouched}
        onClick={handleSaveReactions}
        ariaLabel={lang('Save')}
        disabled={isLoading}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;

    return {
      enabledReactions: chat.fullInfo?.enabledReactions,
      availableReactions: global.availableReactions,
      chat,
    };
  },
)(ManageReactions));
