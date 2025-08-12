import type { FC } from "../../lib/teact/teact";
import { memo, useMemo, useState, useEffect } from "../../lib/teact/teact";
import { getActions, withGlobal } from "../../global";

import type { ApiUser } from "../../api/types";

import { selectUser } from "../../global/selectors";
import { selectTabState } from "../../global/selectors/tabs";
import buildClassName from "../../util/buildClassName";

import useLang from "../../hooks/useLang";

import Button from "../ui/Button";

import "./RightColumnProfile.scss";

const coins = [
  {
    id: "cwypto",
    name: "CWYPTO",
    subtitle: "Itsa mee cwypto",
    time: "5m",
    hasNotification: true,
    comments: 105,
    score: 1238,
    cap: "$250K",
    holders: 2430,
    holdersIcon: "👥",
    volume: 89,
    volumeIcon: "📊",
    marketCap: "$155K",
    change: "$1.2M",
    changeIcon: "↗",
  },
  {
    id: "zelenskiii",
    name: "Zelenskiii",
    subtitle: "Memecoin leader",
    time: "6m",
    hasNotification: false,
    comments: 23,
    score: 850,
    cap: "$250K",
    holders: 2430,
    holdersIcon: "👥",
    volume: 89,
    volumeIcon: "📊",
    marketCap: "$155K",
    change: "$1.2M",
    changeIcon: "↗",
  },
  {
    id: "alien",
    name: "Alien",
    subtitle: "The alien emoji",
    time: "5m",
    hasNotification: false,
    comments: 14,
    score: 620,
    cap: "$250K",
    holders: 2430,
    holdersIcon: "👥",
    volume: 89,
    volumeIcon: "📊",
    marketCap: "$155K",
    change: "$1.2M",
    changeIcon: "↗",
  },
  {
    id: "hippy",
    name: "Hippy",
    subtitle: "Peace-loving Solana",
    time: "5m",
    hasNotification: false,
    comments: 8,
    score: 180,
    cap: "$250K",
    holders: 2430,
    holdersIcon: "👥",
    volume: 89,
    volumeIcon: "📊",
    marketCap: "$155K",
    change: "$1.2M",
    changeIcon: "↗",
  },
];

const shortAddress = "0x2a5dd...5C49";

type OwnProps = {
  isActive: boolean;
  onClose: () => void;
};

type StateProps = {
  currentUser?: ApiUser;
  isTradingColumnShown?: boolean;
};

const RightColumnProfile: FC<OwnProps & StateProps> = ({
  isActive,
  onClose,
  currentUser,
  isTradingColumnShown,
}) => {
  const { openTradingColumn } = getActions();
  const lang = useLang();
  const [isCoinsExpanded, setIsCoinsExpanded] = useState(true);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);

  const className = buildClassName("RightColumnProfile", isActive && "active");

  const toggleCoinsVisibility = () => {
    setIsCoinsExpanded(!isCoinsExpanded);
  };

  const handleCoinClick = (coin: (typeof coins)[0]) => {
    setSelectedCoinId(coin.id);
    openTradingColumn({
      coin: {
        id: coin.id,
        name: coin.name,
        subtitle: coin.subtitle,
        time: coin.time,
        comments: coin.comments.toString(),
        score: coin.score.toString(),
        cap: coin.cap,
        holders: coin.holders,
        volume: coin.volume.toString(),
        change: coin.change,
      },
    });
  };

  // Deselect coin when trading column closes
  useEffect(() => {
    if (!isTradingColumnShown && selectedCoinId) {
      setSelectedCoinId(null);
    }
  }, [isTradingColumnShown, selectedCoinId]);

  return (
    <div className={className}>
      {/* Header Section - Following AppSidebar design */}
      <div className="sidebar-header">
        <div className="brand-section">
          <span className="moonraker-brand-text">Moonraker</span>
        </div>

        <div className="wallet-section">
          <div className="wallet-column">
            <span className="wallet-label">Wallet address</span>
            <div className="wallet-value-group">
              <span className="wallet-address" title={shortAddress}>
                {shortAddress}
              </span>
              <button className="copy-button" aria-label="Copy wallet address">
                <svg
                  className="copy-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div className="balance-column">
            <span className="balance-label">Balance</span>
            <div className="balance-value-group">
              <span className="balance-amount">12.5433</span>
              <img
                className="balance-icon"
                src="/solana/Solana (SOL).svg"
                alt="Solana"
                width="12"
                height="10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="sidebar-content">
        <div className="search-section">
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search coins"
              className="search-input"
            />
          </div>
        </div>

        <div className="coins-group">
          <div className="group-label" onClick={toggleCoinsVisibility}>
            <span>Scanned coins (6)</span>
            <svg
              className={buildClassName(
                "chevron-icon",
                !isCoinsExpanded && "collapsed"
              )}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </div>
          {isCoinsExpanded && (
            <div className="coins-content">
              <div className="coins-list">
                {coins.map((coin) => (
                  <div
                    key={coin.id}
                    className={buildClassName(
                      "coin-item",
                      "clickable",
                      selectedCoinId === coin.id && "selected"
                    )}
                    onClick={() => handleCoinClick(coin)}
                  >
                    {/* Top row: Avatar, Name with copy icon, Time, and Metrics */}
                    <div className="coin-top-row">
                      <div className="coin-left">
                        <div className="coin-avatar" />
                        <div className="coin-content">
                          <div className="coin-info">
                            <span className="coin-name">{coin.name}</span>
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
                            <span className="coin-time">{coin.time}</span>
                          </div>
                          <div className="coin-subtitle-row">
                            <p className="coin-subtitle">{coin.subtitle}</p>
                          </div>
                        </div>
                      </div>

                      <div className="coin-metrics">
                        <div className="metric-badge">
                          <img
                            src="/svg/chat.svg"
                            alt="chat"
                            className="message-icon"
                            width="14"
                            height="14"
                          />
                          <span className="metric-value">{coin.comments}</span>
                        </div>
                        <div className="metric-badge">
                          <img
                            src="/svg/radar.svg"
                            alt="radar"
                            className="sparkles-icon"
                            width="14"
                            height="14"
                          />
                          <span className="metric-value">{coin.score}</span>
                        </div>
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
                        <span className="stat-value">{coin.cap}</span>
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
                            {coin.holders.toLocaleString()}
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
                          <span className="stat-value">{coin.score}</span>
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
                          <span className="stat-value">{coin.volume}</span>
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
                            {coin.change}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Section */}
      <div className="sidebar-footer">
        <div className="footer-left">
          <button className="footer-action-button clear-button">
            <svg
              className="clear-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            Clear coins
          </button>
        </div>
        <div className="footer-right">
          <button className="footer-action-button buy-button">
            <svg
              className="zap-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon>
            </svg>
            Buy
          </button>
          <div className="input-menu-container">
            <input
              type="text"
              className="buy-amount-input"
              placeholder="0.1"
              defaultValue="0.1"
            />
            <button className="menu-button" aria-label="Menu">
              <img
                className="solana-icon"
                src="/solana/Solana (SOL)-grey.svg"
                alt="Solana"
                width="12"
                height="10"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const currentUser = global.currentUserId
      ? selectUser(global, global.currentUserId)
      : undefined;

    const tabState = selectTabState(global);

    return {
      currentUser,
      isTradingColumnShown: tabState.isTradingColumnShown,
    };
  })(RightColumnProfile)
);
