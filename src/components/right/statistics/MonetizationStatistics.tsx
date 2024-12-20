import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChannelMonetizationStatistics, StatisticsGraph } from '../../../api/types';

import { selectChat, selectChatFullInfo, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AboutMonetizationModal from '../../common/AboutMonetizationModal.async';
import Icon from '../../common/icons/Icon';
import SafeLink from '../../common/SafeLink';
import VerificationMonetizationModal from '../../common/VerificationMonetizationModal.async';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Link from '../../ui/Link';
import Loading from '../../ui/Loading';
import StatisticsOverview from './StatisticsOverview';

import styles from './MonetizationStatistics.module.scss';

type ILovelyChart = { create: Function };
let lovelyChartPromise: Promise<ILovelyChart>;
let LovelyChart: ILovelyChart;

async function ensureLovelyChart() {
  if (!lovelyChartPromise) {
    lovelyChartPromise = import('../../../lib/lovely-chart/LovelyChart') as Promise<ILovelyChart>;
    LovelyChart = await lovelyChartPromise;
  }

  return lovelyChartPromise;
}

const MONETIZATION_GRAPHS_TITLES = {
  topHoursGraph: 'ChannelStats.Graph.ViewsByHours',
  revenueGraph: 'lng_channel_earn_chart_revenue',
};
const MONETIZATION_GRAPHS = Object.keys(MONETIZATION_GRAPHS_TITLES) as (keyof ApiChannelMonetizationStatistics)[];

type StateProps = {
  chatId: string;
  dcId?: number;
  statistics?: ApiChannelMonetizationStatistics;
  isCreator?: boolean;
  isChannelRevenueWithdrawalEnabled?: boolean;
  hasPassword?: boolean;
  passwordHint?: string;
  error?: string;
  isLoading?: boolean;
};

const MonetizationStatistics = ({
  chatId,
  dcId,
  statistics,
  isCreator,
  isChannelRevenueWithdrawalEnabled,
  hasPassword,
  passwordHint,
  error,
  isLoading,
}: StateProps) => {
  const { loadChannelMonetizationStatistics, loadPasswordInfo } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<string[]>([]);
  const forceUpdate = useForceUpdate();
  const [isAboutMonetizationModalOpen, openAboutMonetizationModal, closeAboutMonetizationModal] = useFlag(false);
  const [
    isVerificationMonetizationModalOpen, openVerificationMonetizationModal, closeVerificationMonetizationModal,
  ] = useFlag(false);
  const [isConfirmPasswordDialogOpen, openConfirmPasswordDialogOpen, closeConfirmPasswordDialogOpen] = useFlag();
  const availableBalance = statistics?.balances?.availableBalance;
  const isWithdrawalEnabled = statistics?.balances?.isWithdrawalEnabled;
  const canWithdraw = isCreator && isChannelRevenueWithdrawalEnabled && Boolean(availableBalance)
    && isWithdrawalEnabled;

  useEffect(() => {
    if (chatId) {
      loadChannelMonetizationStatistics({ peerId: chatId });
      loadPasswordInfo();
    }
  }, [chatId, loadChannelMonetizationStatistics]);

  useEffect(() => {
    (async () => {
      await ensureLovelyChart();

      if (!isReady) {
        setIsReady(true);
        return;
      }

      if (containerRef.current) {
        Array.from(containerRef.current.children).forEach((child) => {
          child.innerHTML = '';
          child.classList.add(styles.hidden);
        });
      }

      loadedCharts.current = [];

      if (!statistics || !containerRef.current) {
        return;
      }

      MONETIZATION_GRAPHS.forEach((name, index: number) => {
        const graph = statistics[name as keyof typeof statistics];
        const isAsync = typeof graph === 'string';

        if (isAsync || loadedCharts.current.includes(name)) {
          return;
        }

        if (!graph) {
          loadedCharts.current.push(name);

          return;
        }

        LovelyChart.create(containerRef.current!.children[index], {
          title: oldLang((MONETIZATION_GRAPHS_TITLES as Record<string, string>)[name]),
          ...graph as StatisticsGraph,
        });

        loadedCharts.current.push(name);

        containerRef.current!.children[index].classList.remove(styles.hidden);
      });

      forceUpdate();
    })();
  }, [isReady, statistics, oldLang, chatId, dcId, forceUpdate]);

  function renderAvailableReward() {
    const [integerTonPart, decimalTonPart] = availableBalance ? availableBalance.toFixed(4).split('.') : [0];
    const [integerUsdPart, decimalUsdPart] = availableBalance
    && statistics?.usdRate ? (availableBalance * statistics.usdRate).toFixed(2).split('.') : [0];

    return (
      <div className={styles.availableReward}>
        <div className={styles.toncoin}>
          <Icon className={styles.toncoinIcon} name="toncoin" />
          <b className={styles.rewardValue}>
            {integerTonPart}
            {decimalTonPart ? <span className={styles.decimalPart}>.{decimalTonPart}</span> : undefined}
          </b>
        </div>
        {' '}
        <span className={styles.integer}>
          ≈ ${integerUsdPart}
          {decimalUsdPart ? <span className={styles.decimalUsdPart}>.{decimalUsdPart}</span> : undefined}
        </span>
      </div>
    );
  }

  const topText = useMemo(() => {
    const linkText = oldLang('LearnMore');
    return lang(
      'ChannelEarnAbout',
      {
        link: (
          <Link isPrimary onClick={openAboutMonetizationModal}>
            {linkText}
            <Icon name="next" />
          </Link>
        ),
      },
      {
        withNodes: true,
      },
    );
  }, [lang, oldLang]);

  const rewardsText = useMemo(() => {
    const linkText = oldLang('LearnMore');
    return lang(
      'MonetizationBalanceZeroInfo',
      {
        link: (
          <SafeLink url={oldLang('MonetizationProceedsInfoLink')} text={linkText}>
            {linkText}
            <Icon name="next" />
          </SafeLink>
        ),
      },
      {
        withNodes: true,
      },
    );
  }, [lang, oldLang]);

  const verificationMonetizationHandler = useLastCallback(() => {
    if (hasPassword) {
      openVerificationMonetizationModal();
    } else {
      openConfirmPasswordDialogOpen();
    }
  });

  if (!isReady || !statistics) {
    return <Loading />;
  }

  return (
    <div className={buildClassName(styles.root, 'custom-scroll', isReady && styles.ready)}>
      <div className={buildClassName(styles.section, styles.topText)}>{topText}</div>

      <StatisticsOverview
        statistics={statistics}
        isToncoin
        type="monetization"
        title={oldLang('MonetizationOverview')}
        subtitle={
          <div className={styles.textBottom}>{oldLang('MonetizationProceedsTONInfo')}</div>
        }
      />

      {!loadedCharts.current.length && <Loading />}

      <div ref={containerRef} className={styles.section}>
        {MONETIZATION_GRAPHS.filter(Boolean).map((graph) => (
          <div key={graph} className={buildClassName(styles.graph, styles.hidden)} />
        ))}
      </div>

      <div className={styles.section}>
        {oldLang('lng_channel_earn_balance_title')}

        {renderAvailableReward()}

        <Button
          size="smaller"
          type="button"
          onClick={verificationMonetizationHandler}
          disabled={!canWithdraw}
        >
          {oldLang('MonetizationWithdraw')}
        </Button>

        <div className={styles.textBottom}>{rewardsText}</div>
      </div>

      <AboutMonetizationModal
        isOpen={isAboutMonetizationModalOpen}
        onClose={closeAboutMonetizationModal}
      />
      <VerificationMonetizationModal
        chatId={chatId}
        isOpen={isVerificationMonetizationModalOpen}
        onClose={closeVerificationMonetizationModal}
        passwordHint={passwordHint}
        error={error}
        isLoading={isLoading}
      />
      <ConfirmDialog
        isOnlyConfirm
        isOpen={isConfirmPasswordDialogOpen}
        onClose={closeConfirmPasswordDialogOpen}
        confirmHandler={closeConfirmPasswordDialogOpen}
        confirmLabel={lang('OK')}
      >
        <p>{renderText(oldLang('Monetization.Withdraw.Error.Text'), ['br'])}</p>
      </ConfirmDialog>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const {
      settings: {
        byKey: {
          hasPassword,
        },
      },
      twoFaSettings: {
        hint: passwordHint,
      },
    } = global;
    const isLoading = global.monetizationInfo?.isLoading;
    const error = global.monetizationInfo?.error;
    const monetizationStatistics = tabState.monetizationStatistics;
    const chatId = monetizationStatistics && monetizationStatistics.chatId;
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const dcId = selectChatFullInfo(global, chatId!)?.statisticsDcId;
    const isCreator = Boolean(chat?.isCreator);

    const statistics = tabState.statistics.monetization;

    const isChannelRevenueWithdrawalEnabled = global.appConfig?.isChannelRevenueWithdrawalEnabled;

    return {
      chatId: chatId!,
      dcId,
      statistics,
      isCreator,
      isChannelRevenueWithdrawalEnabled,
      hasPassword,
      passwordHint,
      error,
      isLoading,
    };
  },
)(MonetizationStatistics));
