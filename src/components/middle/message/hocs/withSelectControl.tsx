import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC,
  useCallback,
  useMemo,
  memo,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { OwnProps as PhotoProps } from '../Photo';
import { OwnProps as VideoProps } from '../Video';

import buildClassName from '../../../../util/buildClassName';
import { GlobalActions } from '../../../../global/types';
import {
  selectIsInSelectMode,
  selectIsMessageSelected,
} from '../../../../modules/selectors';

import { pick } from '../../../../util/iteratees';

type OwnProps = PhotoProps & VideoProps;

type StateProps = {
  isInSelectMode?: boolean;
  isSelected?: boolean;
};

type DispatchProps = Pick<GlobalActions, ('toggleMessageSelection')>;

export default function withSelectControl(WrappedComponent: FC) {
  const ComponentWithSelectControl: FC<OwnProps & StateProps & DispatchProps> = (props) => {
    const {
      isInSelectMode,
      isSelected,
      message,
      toggleMessageSelection,
      dimensions,
    } = props;

    const handleMessageSelect = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation();
      toggleMessageSelection({ messageId: message.id, withShift: e?.shiftKey });
    }, [toggleMessageSelection, message]);

    const newProps = useMemo(() => {
      return {
        ...props,
        isInSelectMode,
        isSelected,
        dimensions: {
          ...props.dimensions,
          x: 0,
          y: 0,
        },
        onClick: isInSelectMode ? undefined : props.onClick,
      };
    }, [props, isInSelectMode, isSelected]);

    return (
      <div
        className={
          buildClassName(
            'album-item-select-wrapper',
            isSelected && 'is-selected',
          )
        }
        // @ts-ignore
        style={dimensions ? `left: ${dimensions.x}px; top: ${dimensions.y}px;` : ''}
        onClick={isInSelectMode ? handleMessageSelect : undefined}
      >
        {isInSelectMode && (
          <div className="message-select-control">
            {isSelected && (
              <i className="icon-select" />
            )}
          </div>
        )}
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <WrappedComponent {...newProps} />
      </div>
    );
  };

  return memo(withGlobal<OwnProps>(
    (global, ownProps) => {
      const { message } = ownProps;
      return {
        isInSelectMode: selectIsInSelectMode(global),
        isSelected: selectIsMessageSelected(global, message.id),
      };
    },
    (setGlobal, actions) => pick(actions, [
      'toggleMessageSelection',
    ]),
  )(ComponentWithSelectControl));
}
