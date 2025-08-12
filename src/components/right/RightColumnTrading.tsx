import type { FC } from "../../lib/teact/teact";
import {
  memo,
  useRef,
  useEffect,
  useState,
  useMemo,
} from "../../lib/teact/teact";
import { getActions, withGlobal } from "../../global";

import { selectTabState } from "../../global/selectors";
import captureEscKeyListener from "../../util/captureEscKeyListener";

import useHistoryBack from "../../hooks/useHistoryBack";
import useLastCallback from "../../hooks/useLastCallback";

import TVChart from "../tradingview/TVChart/TVChart";
import type { HMPoolTokenMetadata } from "../../hooks/hellomoon/hmApi";
import { fetchPoolTokenMetadata } from "../../hooks/hellomoon/hmApi";

import "./RightColumnTrading.scss";

interface OwnProps {
  isMobile?: boolean;
}

interface CoinData {
  id: string;
  name: string;
  subtitle: string;
  time: string;
  comments: string;
  score: string;
  cap: string;
  holders: number;
  volume: string;
  change: string;
}

type StateProps = {
  isOpen: boolean;
  selectedCoin?: CoinData;
};

const RightColumnTrading: FC<OwnProps & StateProps> = ({
  isMobile,
  isOpen,
  selectedCoin,
}) => {
  const { closeTradingColumn } = getActions();
  const containerRef = useRef<HTMLDivElement>(null!);

  // TVChart state and logic
  const [poolMetadata, setPoolMetadata] = useState<
    HMPoolTokenMetadata | undefined
  >();
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Use hardcoded pool address
  const poolAddress = "0x337b56d87a6185cd46af3ac2cdf03cbc37070c30";

  console.log("poolMetadata", poolMetadata);

  useEffect(() => {
    if (!poolAddress) return;

    console.log("[TVChart] Fetching pool metadata for:", poolAddress);
    setIsLoadingChart(true);
    setChartError(null);

    fetchPoolTokenMetadata(poolAddress)
      .then((data) => {
        console.log("[TVChart] Pool metadata loaded:", data);
        setPoolMetadata(data);
        setIsLoadingChart(false);
      })
      .catch((err) => {
        console.error("[TVChart] Failed to load pool metadata", err);
        setChartError(err.message || "Failed to load chart data");
        setIsLoadingChart(false);
      });
  }, [poolAddress]);

  const TVChartElem = useMemo(() => {
    if (!poolMetadata) return null;
    return (
      <TVChart
        poolMetadata={poolMetadata}
        settings={{ chartType: "price", currency: "usd" }}
      />
    );
  }, [poolMetadata]);

  console.log("TVChartElem", TVChartElem);

  const handleClose = useLastCallback(() => {
    closeTradingColumn();
  });

  // Handle ESC key
  useHistoryBack({
    isActive: isOpen,
    onBack: handleClose,
  });

  // Capture ESC key
  captureEscKeyListener(() => {
    if (isOpen) {
      handleClose();
    }
  });

  return (
    <div
      ref={containerRef}
      className="RightColumnTrading"
      id="RightColumnTrading"
    >
      {selectedCoin && (
        <div className="trading-content">
          <div className="coin-item trading-header">
            {/* Top row: Avatar, Name with copy icon, Time, and Metrics */}
            <div className="coin-top-row">
              <div className="coin-left">
                <div className="coin-avatar" />
                <div className="coin-content">
                  <div className="coin-info">
                    <span className="coin-name">{selectedCoin.name}</span>
                    <svg
                      className="coin-copy-icon"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                    </svg>
                    <span className="coin-time">{selectedCoin.time}</span>
                  </div>
                  <div className="coin-subtitle-row">
                    <p className="coin-subtitle">{selectedCoin.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="coin-metrics-and-close">
                <button
                  type="button"
                  className="trading-close-button"
                  onClick={handleClose}
                  aria-label="Close"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            {/* Bottom row: Stats */}
            <div className="coin-stats-row">
              <div className="stat-item left-aligned">
                <img
                  src="/svg/liq.svg"
                  alt="liquidity"
                  className="stat-icon"
                  width="11"
                  height="10"
                />
                <span className="stat-value">{selectedCoin.cap}</span>
              </div>

              <div className="stats-right-group">
                <div className="stat-item">
                  <img
                    src="/svg/people.svg"
                    alt="people"
                    className="stat-icon"
                    width="11"
                    height="10"
                  />
                  <span className="stat-value">
                    {selectedCoin.holders.toLocaleString()}
                  </span>
                </div>
                <span className="stat-separator">|</span>
                <div className="stat-item">
                  <img
                    src="/svg/wallet.svg"
                    alt="people"
                    className="stat-icon"
                    width="11"
                    height="10"
                  />
                  <span className="stat-value">{selectedCoin.score}</span>
                </div>
                <span className="stat-separator">|</span>
                <div className="stat-item">
                  <img
                    src="/svg/chart.svg"
                    alt="volume"
                    className="stat-icon"
                    width="11"
                    height="10"
                  />
                  <span className="stat-value">{selectedCoin.volume}</span>
                </div>
                <span className="stat-separator">|</span>
                <div className="stat-item mc-group">
                  <span className="stat-value">MC</span>
                  <img
                    src="/svg/mc.svg"
                    alt="volume"
                    className="stat-icon"
                    width="11"
                    height="10"
                  />
                  <span className="stat-value change-value">
                    {selectedCoin.change}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TVChart Component */}
          <div className="chart-container">
            {isLoadingChart && (
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #3DCEC5;">
                Loading chart...
              </div>
            )}
            {chartError && (
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff6b6b;">
                Error: {chartError}
              </div>
            )}
            {TVChartElem && TVChartElem}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const tabState = selectTabState(global);

    return {
      isOpen: Boolean(tabState.isTradingColumnShown),
      selectedCoin: tabState.selectedTradingCoin,
    };
  })(RightColumnTrading)
);
