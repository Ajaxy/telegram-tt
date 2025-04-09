import { type FC, type Props, useRef } from '../../lib/teact/teact';

type InjectProps<T extends FC, P extends Props> = FC<Parameters<T>[0] & P>;

type OwnProps = {
  ignoreFreeze?: boolean;
};

export default function freezeWhenClosed<T extends FC>(Component: T): InjectProps<T, OwnProps> {
  function ComponentWrapper(props: Props) {
    const newProps = useRef(props);

    if (props.ignoreFreeze) return Component(props);

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
