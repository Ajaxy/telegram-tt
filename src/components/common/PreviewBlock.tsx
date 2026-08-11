import type { FC, TeactNode } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import Wallpaper from './Wallpaper';

import styles from './PreviewBlock.module.scss';

type OwnProps = {
  children: TeactNode;
  className?: string;
  style?: string;
  contentClassName?: string;
  backgroundClassName?: string;
};

type MessageProps = {
  children?: TeactNode;
  className?: string;
  style?: string;
  bubbleClassName?: string;
  bubbleStyle?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  avatar?: TeactNode;
  sender?: TeactNode;
  badge?: TeactNode;
  footer?: TeactNode;
  time?: TeactNode;
  senderColor?: string;
  backgroundColor?: string;
};

type MessageTimeProps = {
  children?: TeactNode;
  className?: string;
  style?: string;
};

type PreviewBlockMessageComponent = FC<MessageProps> & {
  Time: FC<MessageTimeProps>;
};

type PreviewBlockComponent = FC<OwnProps> & {
  Message: PreviewBlockMessageComponent;
};

const PreviewBlockBase = ({
  children,
  className,
  style,
  contentClassName,
  backgroundClassName,
}: OwnProps) => {
  return (
    <Wallpaper
      className={buildClassName(styles.root, className)}
      style={style}
      bgClassName={buildClassName(styles.background, backgroundClassName)}
      isStatic
    >
      <div className={buildClassName(styles.content, contentClassName)}>
        {children}
      </div>
    </Wallpaper>
  );
};

const PreviewBlockMessage = ({
  children,
  className,
  style,
  bubbleClassName,
  bubbleStyle,
  headerClassName,
  bodyClassName,
  footerClassName,
  avatar,
  sender,
  badge,
  footer,
  time,
  senderColor,
  backgroundColor,
}: MessageProps) => {
  const hasAvatar = avatar !== undefined;
  const hasSender = sender !== undefined;
  const hasBadge = badge !== undefined;
  const hasChildren = children !== undefined;
  const hasFooterContent = footer !== undefined;
  const hasTime = time !== undefined;
  const hasHeader = hasSender || hasBadge;
  const hasFooter = hasFooterContent || hasTime;
  const bubbleStyles = buildStyle(
    senderColor && `--preview-message-sender-color: ${senderColor}`,
    backgroundColor && `--preview-message-background: ${backgroundColor}`,
    bubbleStyle,
  );
  const content = (
    <>
      {hasHeader ? (
        <div className={buildClassName(styles.header, headerClassName)}>
          {hasSender ? <span className={styles.sender}>{sender}</span> : undefined}
          <span className={styles.spacer} />
          {hasBadge ? <span className={styles.badge}>{badge}</span> : undefined}
        </div>
      ) : undefined}
      {hasChildren ? (
        <div className={buildClassName(styles.body, bodyClassName)}>
          {children}
        </div>
      ) : undefined}
      {hasFooter ? (
        <div className={buildClassName(styles.footer, footerClassName)}>
          {hasFooterContent ? footer : <PreviewBlockMessageTime>{time}</PreviewBlockMessageTime>}
        </div>
      ) : undefined}
    </>
  );

  if (hasAvatar) {
    return (
      <div
        className={buildClassName(styles.messageWithAvatar, className)}
        style={style}
      >
        <div className={styles.avatar}>{avatar}</div>
        <div
          className={buildClassName(styles.bubble, bubbleClassName)}
          style={bubbleStyles}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={buildClassName(styles.message, className, bubbleClassName)}
      style={buildStyle(
        senderColor && `--preview-message-sender-color: ${senderColor}`,
        backgroundColor && `--preview-message-background: ${backgroundColor}`,
        bubbleStyle,
        style,
      )}
    >
      {content}
    </div>
  );
};

const PreviewBlockMessageTime = ({
  children,
  className,
  style,
}: MessageTimeProps) => (
  <span className={buildClassName(styles.time, className)} style={style}>
    {children}
  </span>
);

const PreviewBlockMessageMemo = memo(PreviewBlockMessage) as PreviewBlockMessageComponent;
PreviewBlockMessageMemo.Time = memo(PreviewBlockMessageTime);

const PreviewBlock = memo(PreviewBlockBase) as PreviewBlockComponent;

PreviewBlock.Message = PreviewBlockMessageMemo;

export default PreviewBlock;
