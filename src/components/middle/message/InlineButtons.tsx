import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiKeyboardButton } from '../../../api/types';

import { RE_TME_LINK, TME_LINK_PREFIX } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import renderKeyboardButtonText from '../composer/helpers/renderKeyboardButtonText';

import useLang from '../../../hooks/useLang';

import CustomEmoji from '../../common/CustomEmoji';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './InlineButtons.module.scss';

type OwnProps = {
  className?: string;
  inlineButtons: ApiKeyboardButton[][];
  onClick: (payload: ApiKeyboardButton) => void;
};

const ICON_SIZE = 16;

const InlineButtons = ({ className, inlineButtons, onClick }: OwnProps) => {
  const lang = useLang();

  const renderIcon = (button: ApiKeyboardButton) => {
    const { type } = button;
    switch (type) {
      case 'url': {
        const { url } = button;

        if (url.startsWith(TME_LINK_PREFIX) && url.includes('?startapp')) {
          return <Icon className={styles.cornerIcon} name="webapp" />;
        } else if (!RE_TME_LINK.test(url)) {
          return <Icon className={styles.cornerIcon} name="arrow-right" />;
        }

        return;
      }
      case 'urlAuth':
        return <Icon className={styles.cornerIcon} name="arrow-right" />;
      case 'buy':
      case 'receipt':
        return <Icon className={styles.cornerIcon} name="card" />;
      case 'switchBotInline':
        return <Icon className={styles.cornerIcon} name="share-filled" />;
      case 'webView':
      case 'simpleWebView':
        return <Icon className={styles.cornerIcon} name="webapp" />;
      case 'copy':
        return <Icon className={styles.cornerIcon} name="copy" />;
      case 'suggestedMessage':
        if (button.buttonType === 'suggestChanges') {
          return <Icon className={styles.leftIcon} name="edit" />;
        }
        if (button.buttonType === 'approve') {
          return <Icon className={styles.leftIcon} name="check" />;
        }
        if (button.buttonType === 'decline') {
          return <Icon className={styles.leftIcon} name="close" />;
        }
        break;
      case 'giftOffer':
        if (button.buttonType === 'accept') {
          return <Icon className={styles.leftIcon} name="check" />;
        }
        if (button.buttonType === 'reject') {
          return <Icon className={styles.leftIcon} name="close" />;
        }
        break;
    }

    return;
  };

  const buttonTexts = useMemo(() => {
    const texts: TeactNode[][] = [];
    inlineButtons.forEach((row) => {
      texts.push(row.map((button) => renderKeyboardButtonText(lang, button)));
    });
    return texts;
  }, [lang, inlineButtons]);

  return (
    <div className={buildClassName(styles.root, className)}>
      {inlineButtons.map((row, i) => (
        <div className={styles.row}>
          {row.map((button, j) => (
            <Button
              className={buildClassName(
                styles.button, button.style?.type && styles[`${button.style.type}Tint`],
              )}
              size="tiny"
              ripple
              noForcedUpperCase
              disabled={button.type === 'unsupported' || (button.type === 'suggestedMessage' && button.disabled)}
              onClick={() => onClick(button)}
            >
              {renderIcon(button)}
              <span className={styles.inlineButtonText}>
                {button.style?.iconId && (
                  <CustomEmoji
                    className={styles.customEmojiIcon}
                    documentId={button.style.iconId}
                    size={ICON_SIZE}
                  />
                )}
                {buttonTexts[i][j]}
              </span>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default memo(InlineButtons);
