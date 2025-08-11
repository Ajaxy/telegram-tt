import type { FC } from "../../lib/teact/teact";
import { memo, useMemo } from "../../lib/teact/teact";
import { getActions, withGlobal } from "../../global";

import type { ApiUser } from "../../api/types";

import { selectUser } from "../../global/selectors";
import buildClassName from "../../util/buildClassName";

import useLang from "../../hooks/useLang";

import Button from "../ui/Button";

import "./RightColumnProfile.scss";

const coins = [
  {
    id: "cwypto",
    name: "CWYPTO",
    subtitle: "Itsa mee cwypto",
    comments: 105,
    score: 1238,
    cap: "$250K",
    ath: "$1.8M",
    mult: "7.9x",
  },
  {
    id: "zelenskiii",
    name: "Zelenskiii",
    subtitle: "Memecoin leader",
    comments: 23,
    score: 850,
    cap: "$250K",
    ath: "$1.8M",
    mult: "7.9x",
  },
  {
    id: "alien",
    name: "Alien",
    subtitle: "The alien emoji",
    comments: 14,
    score: 620,
    cap: "$250K",
    ath: "$1.8M",
    mult: "7.9x",
  },
  {
    id: "hippy",
    name: "Hippy",
    subtitle: "Peace-loving Solana",
    comments: 8,
    score: 180,
    cap: "$250K",
    ath: "$1.8M",
    mult: "7.9x",
  },
  {
    id: "mark-cuban",
    name: "Mark Cuban",
    subtitle: "Entrepreneurial vision",
    comments: 2,
    score: 34,
    cap: "$250K",
    ath: "$1.8M",
    mult: "7.9x",
  },
  {
    id: "frud",
    name: "frud",
    subtitle: "aw, frud.",
    comments: 1,
    score: 8,
    cap: "$250K",
    ath: "$1.8M",
    mult: "7.9x",
  },
];

const shortAddress = "0x2a5dd...5C49";

type OwnProps = {
  isActive: boolean;
  onClose: () => void;
};

type StateProps = {
  currentUser?: ApiUser;
};

const RightColumnProfile: FC<OwnProps & StateProps> = ({
  isActive,
  onClose,
  currentUser,
}) => {
  const lang = useLang();

  const className = buildClassName("RightColumnProfile", isActive && "active");

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
      </div>

      {/* Content Section */}
      <div className="sidebar-content">
        <div className="coins-group">
          <div className="group-label">Scanned coins (6)</div>
          <div className="coins-content">
            <div className="coins-list">
              {coins.map((coin) => (
                <div key={coin.id} className="coin-item">
                  <div className="coin-main">
                    <div className="coin-info">
                      <div className="coin-avatar" />
                      <div className="coin-details">
                        <div className="coin-header">
                          <span className="coin-name">{coin.name}</span>
                          <span className="coin-time">5m</span>
                        </div>
                        <p className="coin-subtitle">{coin.subtitle}</p>
                      </div>
                    </div>
                    <div className="coin-stats">
                      <div className="stats-line">
                        {coin.cap} • ATH {coin.ath}
                      </div>
                      <div className="multiplier">↗ {coin.mult}</div>
                    </div>
                  </div>
                  <div className="coin-metrics">
                    <div className="metric-badge">
                      <svg
                        className="message-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>
                      </svg>
                      <span className="metric-value">{coin.comments}</span>
                    </div>
                    <div className="metric-badge">
                      <svg
                        className="sparkles-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                      </svg>
                      <span className="metric-value">{coin.score}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="sidebar-footer">
        <div className="footer-buttons">
          <Button size="tiny" color="translucent" className="clear-button">
            Clear coins
          </Button>
          <Button size="tiny" color="primary" className="buy-button">
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
          </Button>
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

    return {
      currentUser,
    };
  })(RightColumnProfile)
);
