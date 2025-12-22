import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiPromoData } from '../../../../api/types';
import type { RegularLangKey } from '../../../../types/language';

import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../../../middle/hooks/useHeaderPane';

import Icon from '../../../common/icons/Icon';

import styles from './SuggestionPane.module.scss';

type OwnProps = {
  promoData?: ApiPromoData;
  onPaneStateChange: (state: PaneState) => void;
};

// https://core.telegram.org/api/config#suggestions
const BIRTHDAY_SETUP = 'BIRTHDAY_SETUP';
const SUPPORTED_SUGGESTIONS = [BIRTHDAY_SETUP] as const;
type Suggestion = (typeof SUPPORTED_SUGGESTIONS)[number];

const SUPPORTED_SUGGESTIONS_SET = new Set<string>(SUPPORTED_SUGGESTIONS);

const AUTOCLOSABLE_SUGGESTIONS = new Set<string>([BIRTHDAY_SETUP]);

const SUGGESTION_LANG_KEYS: Record<Suggestion, [RegularLangKey, RegularLangKey]> = {
  BIRTHDAY_SETUP: ['SuggestionBirthdaySetupTitle', 'SuggestionBirthdaySetupMessage'],
};

const SuggestionPane = ({ promoData, onPaneStateChange }: OwnProps) => {
  const { openBirthdaySetupModal, dismissSuggestion, openUrl } = getActions();
  const lang = useLang();

  const currentSuggestion = useMemo(() => {
    if (promoData?.customPendingSuggestion) return promoData.customPendingSuggestion;
    return promoData?.pendingSuggestions.find((suggestion): suggestion is Suggestion => (
      SUPPORTED_SUGGESTIONS_SET.has(suggestion)
    ));
  }, [promoData]);
  const renderingSuggestion = useCurrentOrPrev(currentSuggestion);
  const isCustomSuggestion = typeof renderingSuggestion === 'object';

  const { ref, shouldRender } = useHeaderPane({
    isOpen: Boolean(currentSuggestion),
    onStateChange: onPaneStateChange,
    withResizeObserver: true,
  });

  const handleClick = useLastCallback(() => {
    if (!renderingSuggestion) return;

    const suggestion = isCustomSuggestion ? renderingSuggestion.suggestion : renderingSuggestion;
    if (AUTOCLOSABLE_SUGGESTIONS.has(suggestion)) {
      dismissSuggestion({ suggestion });
    }

    if (isCustomSuggestion) {
      openUrl({ url: renderingSuggestion.url });
      return;
    }

    switch (renderingSuggestion) {
      case BIRTHDAY_SETUP:
        openBirthdaySetupModal({});
        break;
    }
  });

  const handleDismiss = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (!renderingSuggestion) return;
    const suggestion = isCustomSuggestion ? renderingSuggestion.suggestion : renderingSuggestion;
    dismissSuggestion({ suggestion });
  });

  if (!shouldRender || !renderingSuggestion) return undefined;

  const title = isCustomSuggestion ? renderTextWithEntities(renderingSuggestion.title)
    : lang(SUGGESTION_LANG_KEYS[renderingSuggestion][0], undefined, { withNodes: true });
  const message = isCustomSuggestion ? renderTextWithEntities(renderingSuggestion.description)
    : lang(SUGGESTION_LANG_KEYS[renderingSuggestion][1], undefined, { withNodes: true });

  return (
    <div
      ref={ref}
      className={styles.root}
      role="button"
      tabIndex={0}
      onClick={handleClick}
    >
      <div className={styles.title}>{title}</div>
      <div className={styles.subtitle}>{message}</div>
      <Icon name="close" className={styles.closeIcon} onClick={handleDismiss} />
    </div>
  );
};

export default memo(SuggestionPane);
