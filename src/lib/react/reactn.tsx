import React, { useEffect } from 'react';

import type { FC, FC_withDebug } from '../teact/teact';
import type { ActivationFn, MapStateToProps } from '../teact/teactn';

import arePropsShallowEqual from '../../util/arePropsShallowEqual';
// import { handleError } from '../../util/handleError';
import { DEBUG_resolveComponentName } from '../teact/teact';
// eslint-disable-next-line import/no-cycle
import { activateContainer, containers, currentGlobal } from '../teact/teactn';

import useForceUpdate from '../../hooks/useForceUpdate.react';
import useUniqueId from '../../hooks/useUniqueId.react';

export function withGlobal<OwnProps extends AnyLiteral>(
  mapStateToProps: MapStateToProps<OwnProps> = () => ({}),
  activationFn?: ActivationFn<OwnProps>,
) {
  return (Component: FC) => {
    const ReactNContainer: FC<OwnProps> = (props) => {
      const id = useUniqueId();
      const forceUpdate = useForceUpdate();

      useEffect(() => {
        return () => {
          containers.delete(id);
        };
      }, [id]);

      let container = containers.get(id)!;
      if (!container) {
        container = {
          mapStateToProps,
          activationFn,
          ownProps: props,
          forceUpdate,
          DEBUG_updates: 0,
          DEBUG_componentName: Component.name,
        };

        containers.set(id, container);
      }

      if (!container.mappedProps || (
        !arePropsShallowEqual(container.ownProps, props) && activateContainer(container, currentGlobal, props)
      )) {
        try {
          container.mappedProps = mapStateToProps(currentGlobal, props);
        } catch (err: any) {
          // handleError(err);
        }
      }

      container.ownProps = props;

      // eslint-disable-next-line react/jsx-props-no-spreading
      return <Component {...container.mappedProps} {...props} />;
    };

    (ReactNContainer as FC_withDebug).DEBUG_contentComponentName = DEBUG_resolveComponentName(Component);

    return ReactNContainer;
  };
}
