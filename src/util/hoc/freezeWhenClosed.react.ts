import { useRef } from 'react';
import { type FC, type Props } from '../../lib/teact/teact';

export default function freezeWhenClosed<T extends FC>(Component: T) {
  function ComponentWrapper(props: Props) {
    const newProps = useRef(props);

    if (props.isOpen) {
      newProps.current = props;
    } else {
      newProps.current = {
        ...newProps.current,
        isOpen: false,
      };
    }

    return Component(newProps.current);
  }

  return ComponentWrapper as T;
}
