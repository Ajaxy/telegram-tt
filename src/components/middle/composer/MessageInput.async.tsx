import type { OwnProps } from './MessageInput';

import { EDITABLE_INPUT_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MessageInputAsync = (props: OwnProps) => {
  const {
    ref,
    id,
    editableInputId,
    placeholder,
    isNeedPremium,
  } = props;
  const MessageInput = useModuleLoader(Bundles.Editor, 'MessageInput');

  if (MessageInput) {
    return <MessageInput {...props} />;
  }

  const placeholderId = `${editableInputId || EDITABLE_INPUT_ID}-placeholder`;

  return (
    <div id={id} aria-busy>
      <div className="shared-canvas-container">
        <div className={buildClassName('custom-scroll', 'input-scroller', isNeedPremium && 'is-need-premium')}>
          <div className={buildClassName('input-scroller-content', isNeedPremium && 'is-need-premium')}>
            <div
              ref={ref}
              id={editableInputId || EDITABLE_INPUT_ID}
              className="form-control allow-selection focus-disabled"
              role="textbox"
              aria-disabled
              aria-labelledby={placeholderId}
              tabIndex={-1}
            />
            <span
              id={placeholderId}
              className={buildClassName('placeholder-text', isNeedPremium && 'is-need-premium')}
              dir="auto"
            >
              {placeholder}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInputAsync;
