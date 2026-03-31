import type { FC, TeactNode } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ThemeKey } from '../../types';

import { selectTheme, selectThemeValues } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useCustomBackground from '../../hooks/useCustomBackground';

import backgroundStyles from '../../styles/_patternBackground.module.scss';
import styles from './PreviewBlock.module.scss';

type OwnProps = {
  children: TeactNode;
  className?: string;
  style?: string;
  contentClassName?: string;
  backgroundClassName?: string;
  backgroundStyle?: string;
  backgroundColor?: string;
  patternColor?: string;
  customBackground?: string;
  isBackgroundBlurred?: boolean;
};

type StateProps = {
  theme: ThemeKey;
  themeBackgroundColor?: string;
  themePatternColor?: string;
  themeCustomBackground?: string;
  themeIsBackgroundBlurred?: boolean;
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
  backgroundStyle,
  backgroundColor,
  patternColor,
  customBackground,
  isBackgroundBlurred,
  theme,
  themeBackgroundColor,
  themePatternColor,
  themeCustomBackground,
  themeIsBackgroundBlurred,
}: OwnProps & StateProps) => {
  const resolvedBackgroundColor = backgroundColor ?? themeBackgroundColor;
  const resolvedPatternColor = patternColor ?? themePatternColor;
  const resolvedCustomBackground = customBackground ?? themeCustomBackground;
  const resolvedIsBackgroundBlurred = isBackgroundBlurred ?? themeIsBackgroundBlurred;
  const customBackgroundValue = useCustomBackground(theme, resolvedCustomBackground);

  const backgroundClassNames = buildClassName(
    styles.background,
    backgroundStyles.background,
    resolvedCustomBackground && backgroundStyles.customBgImage,
    resolvedBackgroundColor && backgroundStyles.customBgColor,
    resolvedCustomBackground && resolvedIsBackgroundBlurred && backgroundStyles.blurred,
    backgroundClassName,
  );

  return (
    <div
      className={buildClassName(styles.root, className)}
      style={buildStyle(
        resolvedPatternColor && `--pattern-color: ${resolvedPatternColor}`,
        resolvedBackgroundColor && `--theme-background-color: ${resolvedBackgroundColor}`,
        style,
      )}
    >
      <div
        className={backgroundClassNames}
        style={buildStyle(
          customBackgroundValue && `--custom-background: ${customBackgroundValue}`,
          backgroundStyle,
        )}
      />
      <div className={buildClassName(styles.content, contentClassName)}>
        {children}
      </div>
    </div>
  );
};

const PreviewBlockMessage: FC<MessageProps> = ({
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
}) => {
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

const PreviewBlockMessageTime: FC<MessageTimeProps> = ({
  children,
  className,
  style,
}) => (
  <span className={buildClassName(styles.time, className)} style={style}>
    {children}
  </span>
);

const PreviewBlockMessageMemo = memo(PreviewBlockMessage) as PreviewBlockMessageComponent;
PreviewBlockMessageMemo.Time = memo(PreviewBlockMessageTime);

const PreviewBlock = memo(withGlobal<OwnProps>((global) => {
  const theme = selectTheme(global);
  const {
    isBlurred: themeIsBackgroundBlurred,
    background: themeCustomBackground,
    backgroundColor: themeBackgroundColor,
    patternColor: themePatternColor,
  } = selectThemeValues(global, theme) || {};

  return {
    theme,
    themeBackgroundColor,
    themePatternColor,
    themeCustomBackground,
    themeIsBackgroundBlurred,
  };
})(PreviewBlockBase)) as PreviewBlockComponent;

PreviewBlock.Message = PreviewBlockMessageMemo;

export default PreviewBlock;
