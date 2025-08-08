import {
  LibrarySymbolInfo,
  ResolutionString,
  HistoryCallback,
  SubscribeBarsCallback,
  DatafeedConfiguration,
  IBasicDataFeed,
  PeriodParams,
  Timezone,
} from "./charting_library";
import {
  fetchPoolOhlcv,
  HMPoolTokenMetadata,
} from "../../../hooks/hellomoon/hmApi";
import { RES_TO_INTERVAL } from "./helpers";

const configurationData: DatafeedConfiguration = {
  supported_resolutions: [
    "1S",
    "1",
    "5",
    "15",
    "30",
    "60",
    "120",
    "240",
    "480",
    "1D",
    "1W",
  ] as ResolutionString[],
  symbols_types: [
    {
      name: "crypto",
      value: "crypto",
    },
  ],
};

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const activeSubscriptions = new Map<string, () => void>();

export default {
  onReady: (callback: (configuration: object) => void) => {
    setTimeout(() => callback(configurationData));
  },
  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: LibrarySymbolInfo) => void,
    onResolveErrorCallback: (reason: string) => void
  ) => {
    const { poolMetadata, currency, chartType } = JSON.parse(symbolName) as {
      poolMetadata: HMPoolTokenMetadata;
      currency: "usd" | "whype";
      chartType: "price" | "mcap";
    };

    const flip =
      poolMetadata.token0?.address ===
      "0x5555555555555555555555555555555555555555";

    const desiredToken = flip ? poolMetadata.token1 : poolMetadata.token0;
    const baseToken = flip ? poolMetadata.token0 : poolMetadata.token1 || null;

    const symbolInfo: any = {
      name: `${desiredToken?.symbol}/${baseToken?.symbol}`,
      ticker: `${desiredToken?.symbol}/${baseToken?.symbol}`,
      description: `${desiredToken?.symbol}/${baseToken?.symbol}`,
      type: "crypto",
      session: "24x7",
      timezone: userTimezone as Timezone,
      exchange: "HyperSwap",
      minmov: 1,
      pricescale: 10 ** 16,
      has_intraday: true,
      has_seconds: true,
      has_weekly_and_monthly: true,
      has_daily: true,
      listed_exchange: "HyperSwap",
      format: "price",
      supported_resolutions: configurationData.supported_resolutions || [],
      volume_precision: 2,
      data_status: "streaming",
      address: poolMetadata.address,
      desiredAddress: desiredToken?.address,
      currency,
    };

    setTimeout(() => onSymbolResolvedCallback(symbolInfo));
  },
  getBars: (
    symbolInfo: any,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onHistoryCallback: HistoryCallback,
    onErrorCallback: (error: string) => void
  ) => {
    const { from, to, countBack } = periodParams;

    fetchPoolOhlcv(
      symbolInfo.address,
      RES_TO_INTERVAL[resolution],
      from,
      to,
      countBack,
      symbolInfo.currency === "usd",
      symbolInfo.desiredAddress
    ).then((data) => {
      onHistoryCallback(
        data.data.map((bar) => ({
          time: bar.t * 1000,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
        }))
      );
    });
  },
  subscribeBars: (
    symbolInfo: any,
    resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ) => {},
  unsubscribeBars: (subscriberUID: string) => {},
} as IBasicDataFeed;
