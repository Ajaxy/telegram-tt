import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { OwnProps as PhotoProps } from '../Photo';
import type { OwnProps as VideoProps } from '../Video';

import {
  selectIsInSelectMode,
  selectIsMessageSelected,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';

type OwnProps<T> =
  (PhotoProps<T> | VideoProps<T>) & {
    clickArg: number;
    noSelectControls?: boolean;
  };

type StateProps = {
  isInSelectMode?: boolean;
  isSelected?: boolean;
};

export default function withSelectControl(WrappedComponent: FC) {
  // eslint-disable-next-line @typescript-eslint/comma-dangle
  const ComponentWithSelectControl = <T,>(props: OwnProps<T> & StateProps) => {
    const {
      isInSelectMode,
      isSelected,
      dimensions,
      clickArg,
    } = props;
    const { toggleMessageSelection } = getActions();

    const handleMessageSelect = useLastCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation();
      toggleMessageSelection({ messageId: clickArg, withShift: e?.shiftKey });
    });

    const newProps = useMemo(() => {
      const { dimensions: dims, onClick } = props;
      return {
        ...props,
        isInSelectMode,
        isSelected,
        dimensions: {
          ...dims,
          x: 0,
          y: 0,
        },
        onClick: isInSelectMode ? undefined : onClick,
      };
    }, [props, isInSelectMode, isSelected]);

    return (
      <div
        className={buildClassName('album-item-select-wrapper', isSelected && 'is-selected')}
        style={dimensions ? `left: ${dimensions.x}px; top: ${dimensions.y}px;` : ''}
        onClick={isInSelectMode ? handleMessageSelect : undefined}
      >
        {isInSelectMode && (
          <div className="message-select-control">
            {isSelected && (
              <Icon name="select" />
            )}
          </div>
        )}
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <WrappedComponent {...newProps} />
      </div>
    );
  };

  return memo(withGlobal<OwnProps<unknown>>(
    (global, ownProps) => {
      const { clickArg, noSelectControls } = ownProps;
      return {
        isInSelectMode: !noSelectControls && selectIsInSelectMode(global),
        isSelected: !noSelectControls && selectIsMessageSelected(global, clickArg),
      };
    },
  )(ComponentWithSelectControl)) as typeof ComponentWithSelectControl;
}
