"use client";
import { FC, useEffect, useRef, useState } from "../../../lib/teact/teact";
import {
  widget,
  ResolutionString,
  ChartingLibraryWidgetOptions,
  IChartingLibraryWidget,
} from "./charting_library";
import Datafeed from "./datafeed";
import { formatPrice } from "./helpers";
import { HMPoolTokenMetadata } from "../../../hooks/hellomoon/hmApi";
import { disableStrict, enableStrict } from "../../../lib/fasterdom/fasterdom";

// Helper function to create chart type button HTML
const createChartTypeButtonHTML = (chartType: "price" | "mcap") => {
  return `
    <div style="cursor: pointer;">
      <span style="color: ${
        chartType === "price" ? "#2962ff" : ""
      }; font-weight: ${chartType === "price" ? "bold" : "normal"};">
        Price
      </span>
    </div>
  `;
};

// // Helper function to create chart type button HTML
// const createChartTypeButtonHTML = (chartType: "price" | "mcap") => {
//   return `
//     <div style="cursor: pointer;">
//       <span style="color: ${
//         chartType === "price" ? "#2962ff" : ""
//       }; font-weight: ${chartType === "price" ? "bold" : "normal"};">
//         Price
//       </span>
//       /
//       <span style="color: ${
//         chartType === "mcap" ? "#2962ff" : ""
//       }; font-weight: ${chartType === "mcap" ? "bold" : "normal"};">
//         MCap
//       </span>
//     </div>
//   `;
// };

// // Helper function to create currency button HTML
// const createCurrencyButtonHTML = (selectedCurrency: "usd" | "whype") => {
//   return `
//     <div style="cursor: pointer;">
//       <span style="color: ${
//         selectedCurrency === "usd" ? "#2962ff" : ""
//       }; font-weight: ${
//     selectedCurrency === "usd" ? "bold" : "normal"
//   }; text-transform: uppercase;">
//         USD
//       </span>
//       /
//       <span style="color: ${
//         selectedCurrency !== "usd" ? "#2962ff" : ""
//       }; font-weight: ${
//     selectedCurrency !== "usd" ? "bold" : "normal"
//   }; text-transform: uppercase;">
//         WHYPE
//       </span>
//     </div>
//   `;
// };

// Helper function to create currency button HTML
const createCurrencyButtonHTML = () => {
  return `
    <div>
      <span style="color: #2962ff; font-weight: bold; text-transform: uppercase;">
        USD
      </span>
    </div>
  `;
};

export interface ChartSettings {
  chartType: "price" | "mcap";
  currency: "usd" | "whype";
}

interface TVChartProps {
  poolMetadata: HMPoolTokenMetadata;
  settings: ChartSettings;
}

const TVChart: FC<TVChartProps> = ({ poolMetadata, settings }) => {
  const [chartType, setChartType] = useState<"price" | "mcap">(
    settings.chartType
  );
  const [currency, setCurrency] = useState<"usd" | "whype">(settings.currency);
  const containerRef = useRef<HTMLDivElement>();
  const [customCssUrl, setCustomCssUrl] = useState<string | null>(null);

  const tvWidgetRef = useRef<IChartingLibraryWidget | null>(null);

  // Disable StricterDOM while TradingView widget is mounted to avoid false positives
  useEffect(() => {
    disableStrict();
    return () => {
      enableStrict();
    };
  }, []);

  // Create custom CSS blob URL once and revoke it on unmount to prevent memory leaks
  useEffect(() => {
    const customCSS =
      'div[data-name="open-image-in-new-tab"],div[data-name="tweet-chart-image"],div[data-name="copy-link-to-the-chart-image"] { display: none; } ';
    const cssBlob = new Blob([customCSS], { type: "text/css" });
    const url = URL.createObjectURL(cssBlob);
    setCustomCssUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "hyperswap-chartSettings",
      JSON.stringify({
        chartType,
        currency,
      })
    );
    if (!containerRef.current || !customCssUrl) {
      return () => {};
    }

    let appendedScript: HTMLScriptElement | null = null;

    const initChart = () => {
      const TradingViewWidget = (window as any).TradingView?.widget;

      if (!TradingViewWidget) {
        console.error("TradingView library not loaded");
        return;
      }

      const widgetOptions: ChartingLibraryWidgetOptions = {
        symbol: JSON.stringify({
          poolMetadata,
          currency,
          chartType,
        }),
        datafeed: Datafeed,
        interval: "5" as ResolutionString,
        locale: "en",
        container: containerRef.current!,
        library_path: "/charting_library/",
        autosize: true,
        // theme: "dark",
        disabled_features: ["header_compare", "header_symbol_search"],
        enabled_features: ["seconds_resolution"],
        client_id: "hyperswap",
        // custom_themes: {
        //   "paneProperties.background": "#1D1E20",
        //   "paneProperties.backgroundType": "solid",
        // },
        custom_formatters: {
          priceFormatterFactory: () => {
            return {
              format: (price) => {
                return formatPrice(price);
              },
            };
          },
        },
        // loading_screen: { backgroundColor: "#131722" },
        auto_save_delay: 0,
        debug: false,
        // timeframe: "720",
        theme: "dark",
        time_frames: [
          { text: "1D", resolution: "1D" as ResolutionString, title: "1D" },
          { text: "1W", resolution: "1W" as ResolutionString, title: "1W" },
          { text: "1M", resolution: "1M" as ResolutionString, title: "1M" },
        ],
        overrides: {
          "scalesProperties.showSeriesLastValue": true,
          // "paneProperties.background": "#1ffff0",
          // "paneProperties.backgroundType": "solid",

          // "mainSeriesProperties.highLowAvgPrice": true,
        },
        custom_css_url: customCssUrl,
        favorites: {
          intervals: [
            "1S" as ResolutionString,
            "1" as ResolutionString,
            "5" as ResolutionString,
            "15" as ResolutionString,
            "60" as ResolutionString,
            "240" as ResolutionString,
            "1D" as ResolutionString,
          ],
        },
      };

      const tvWidget = new TradingViewWidget(widgetOptions);
      tvWidgetRef.current = tvWidget;

      tvWidget.headerReady().then(() => {
        const chartTypeButton = tvWidget.createButton();

        // chartTypeButton.innerHTML = createChartTypeButtonHTML(chartType);
        // chartTypeButton.addEventListener("click", () => {
        //   const newChartType = chartType === "price" ? "mcap" : "price";
        //   setChartType(newChartType);
        // });

        // const currencyButton = tvWidget.createButton();
        // currencyButton.innerHTML = createCurrencyButtonHTML(currency);
        // currencyButton.addEventListener("click", () => {
        //   const newCurrency = currency === "usd" ? "whype" : "usd";
        //   setCurrency(newCurrency);
        // });
      });
    };

    // Check if TradingView library is already loaded
    if ((window as any).TradingView) {
      initChart();
    } else {
      // Load the TradingView library script
      const script = document.createElement("script");
      script.src = "/charting_library/charting_library.js";
      script.async = true;
      script.onload = () => {
        initChart();
      };
      script.onerror = () => {
        console.error("Failed to load TradingView charting library");
      };
      document.head.appendChild(script);
      appendedScript = script;
    }

    return () => {
      if (tvWidgetRef.current) {
        tvWidgetRef.current.remove();
        tvWidgetRef.current = null;
      }
      if (appendedScript && appendedScript.parentNode) {
        appendedScript.parentNode.removeChild(appendedScript);
        appendedScript = null;
      }
    };
  }, [customCssUrl, chartType, currency, poolMetadata]);

  return <div ref={containerRef} style="height: 100%; width: 100%;" />;
};

export default TVChart;
