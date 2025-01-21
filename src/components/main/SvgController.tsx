import React, { memo, useEffect } from '../../lib/teact/teact';

import { createCallbackManager } from '../../util/callbacks';
import generateUniqueId from '../../util/generateUniqueId';

import useForceUpdate from '../../hooks/useForceUpdate';

import Portal from '../ui/Portal';

const DEFINITION_MAP = new Map<string, React.ReactElement>();
const CALLBACK_MANAGER = createCallbackManager();

const SvgController = () => {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    return CALLBACK_MANAGER.addCallback(forceUpdate);
  }, []);

  return (
    <Portal>
      <svg width="0" height="0" viewBox="0 0 1 1" className="svg-definitions">
        <defs>
          {Array.from(DEFINITION_MAP.values())}
        </defs>
      </svg>
    </Portal>
  );
};

export default memo(SvgController);

export function addSvgDefinition(element: React.ReactElement, id?: string) {
  id ??= generateUniqueId();
  element.props.id = id;

  DEFINITION_MAP.set(element.props.id, element);
  CALLBACK_MANAGER.runCallbacks();
  return id;
}

export function removeSvgDefinition(id: string) {
  DEFINITION_MAP.delete(id);
  CALLBACK_MANAGER.runCallbacks();
}
