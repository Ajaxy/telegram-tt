import React, { FC, memo } from '../../../../lib/teact/teact';

import { ApiWebDocument } from '../../../../api/types';

import { getFirstLetters } from '../../../../util/textFormat';
import renderText from '../../../common/helpers/renderText';
import useMedia from '../../../../hooks/useMedia';

import ListItem from '../../../ui/ListItem';

import './BaseResult.scss';
import { preventMessageInputBlurWithBubbling } from '../../helpers/preventMessageInputBlur';

export type OwnProps = {
  focus?: boolean;
  thumbnail?: ApiWebDocument;
  thumbUrl?: string;
  title?: string;
  description?: string;
  transitionClassNames?: string;
  onClick: NoneToVoidFunction;
};

const BaseResult: FC<OwnProps> = ({
  title,
  description,
  thumbnail,
  thumbUrl,
  focus,
  transitionClassNames = '',
  onClick,
}) => {
  let content: string | undefined = '';

  const thumbnailDataUrl = useMedia(thumbnail ? `webDocument:${thumbnail.url}` : undefined);
  thumbUrl = thumbUrl || thumbnailDataUrl;

  if (thumbUrl) {
    content = (
      <img src={thumbUrl} className={transitionClassNames} alt="" decoding="async" draggable="false" />
    );
  } else if (title) {
    content = getFirstLetters(title, 1);
  }

  return (
    <ListItem
      focus={focus}
      className="BaseResult chat-item-clickable"
      onMouseDown={preventMessageInputBlurWithBubbling}
      onClick={onClick}
    >
      <span className="thumb">
        {typeof content === 'string' ? renderText(content) : content}
      </span>
      <div className="content-inner">
        {title && (<div className="title">{title}</div>)}
        {description && (<div className="description">{description}</div>)}
      </div>
    </ListItem>
  );
};

export default memo(BaseResult);
