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

  // Trading state
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [selectedPoolTab, setSelectedPoolTab] = useState<"P1" | "P2" | "P3">(
    "P1"
  );

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

          {/* Trade Sidebar */}
          <div className="trade-sidebar">
            {/* Quick trade section */}
            <div className="trade-section">
              <div className="trade-section-content">
                <div className="trade-buttons">
                  <button
                    className={`trade-button trade-button-buy ${
                      tradeType === "buy" ? "active" : ""
                    }`}
                    onClick={() => setTradeType("buy")}
                  >
                    Buy
                  </button>
                  <button
                    className={`trade-button trade-button-sell ${
                      tradeType === "sell" ? "active" : ""
                    }`}
                    onClick={() => setTradeType("sell")}
                  >
                    Sell
                  </button>
                </div>

                <div className="amount-container">
                  <div className="amount-input-group">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="amount-input"
                    />
                    <svg
                      className="solana-icon"
                      width="12"
                      height="12"
                      viewBox="0 0 13 11"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2.61661 7.97555C2.68902 7.90314 2.78858 7.8609 2.89418 7.8609H12.4703C12.6453 7.8609 12.7328 8.07209 12.6091 8.19579L10.7174 10.0875C10.645 10.1599 10.5454 10.2021 10.4398 10.2021H0.863708C0.68872 10.2021 0.601225 9.99093 0.724924 9.86724L2.61661 7.97555Z"
                        fill="#686A6D"
                      />
                      <path
                        d="M2.61661 0.912591C2.69204 0.840182 2.7916 0.797943 2.89418 0.797943H12.4703C12.6453 0.797943 12.7328 1.00914 12.6091 1.13284L10.7174 3.02452C10.645 3.09693 10.5454 3.13917 10.4398 3.13917H0.863708C0.68872 3.13917 0.601225 2.92798 0.724924 2.80428L2.61661 0.912591Z"
                        fill="#686A6D"
                      />
                      <path
                        d="M10.7174 4.42144C10.645 4.34903 10.5454 4.30679 10.4398 4.30679H0.863708C0.68872 4.30679 0.601225 4.51799 0.724924 4.64169L2.61661 6.53337C2.68902 6.60578 2.78858 6.64802 2.89418 6.64802H12.4703C12.6453 6.64802 12.7328 6.43683 12.6091 6.31313L10.7174 4.42144Z"
                        fill="#686A6D"
                      />
                    </svg>
                  </div>
                  <div className="percentage-buttons">
                    <button className="percentage-button">0.01</button>
                    <button className="percentage-button">0.01</button>
                    <button className="percentage-button">0.5</button>
                    <button className="percentage-button">1</button>
                    <button className="percentage-button edit-button">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <button className="buy-now-button">
                  <svg
                    className="buy-now-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  Buy now
                </button>

                <div className="trade-stats">
                  <div className="trade-stat">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14 11V8C14 6.34 12.66 5 11 5H4C2.34 5 1 6.34 1 8V11C1 12.66 2.34 14 4 14H6L8 17H10L8 14H11C12.66 14 14 12.66 14 11Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                      <path
                        d="M21 16V19C21 20.1 20.1 21 19 21H16C14.9 21 14 20.1 14 19V16C14 14.9 14.9 14 16 14H19C20.1 14 21 14.9 21 16Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                    <span className="trade-stat-value">0.01</span>
                  </div>
                  <div className="trade-stat">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M16 8L8 16"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M8 8H16V16"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="trade-stat-value">30%</span>
                  </div>
                  <div className="trade-stat">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7 10V12C7 13.1 7.9 14 9 14H12V17L17 12L12 7V10H7Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                    <span className="trade-stat-value">0.01</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pools section */}
            <div className="trade-section">
              <div className="trade-section-content">
                <div className="pools-tabs">
                  <button
                    className={`pool-tab ${
                      selectedPoolTab === "P1" ? "pool-tab-active" : ""
                    }`}
                    onClick={() => setSelectedPoolTab("P1")}
                  >
                    P1
                  </button>
                  <button
                    className={`pool-tab ${
                      selectedPoolTab === "P2" ? "pool-tab-active" : ""
                    }`}
                    onClick={() => setSelectedPoolTab("P2")}
                  >
                    P2
                  </button>
                  <button
                    className={`pool-tab ${
                      selectedPoolTab === "P3" ? "pool-tab-active" : ""
                    }`}
                    onClick={() => setSelectedPoolTab("P3")}
                  >
                    P3
                  </button>
                </div>

                <div className="pool-metrics">
                  <div className="pool-metric">
                    <span className="pool-metric-label">Liquidity</span>
                    <span className="pool-metric-value">$1.2M</span>
                  </div>
                  <div className="pool-metric">
                    <span className="pool-metric-label">24h Volume</span>
                    <span className="pool-metric-value">$320K</span>
                  </div>
                  <div className="pool-metric">
                    <span className="pool-metric-label">FDV</span>
                    <span className="pool-metric-value">$8.4M</span>
                  </div>
                </div>
              </div>
            </div>
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
