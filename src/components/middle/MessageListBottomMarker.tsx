import { memo, useRef } from '@teact';

import buildClassName from '../../util/buildClassName';

import useFocusMessageListElement from './message/hooks/useFocusMessageListElement';

type OwnProps = {
  isFocused?: boolean;
  className?: string;
};

const MessageListBottomMarker = ({ isFocused, className }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  useFocusMessageListElement({
    elementRef: ref,
    isJustAdded: true,
    isFocused,
    noFocusHighlight: true,
  });

  return (
    <div ref={ref} className={buildClassName('list-bottom-marker', className)} />
  );
};

export default memo(MessageListBottomMarker);
