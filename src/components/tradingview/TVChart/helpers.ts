import { Bar } from './datafeed-api'
import BigNumber from 'bignumber.js'
import { HMOhlcv, OhlcvInterval } from '../../../hooks/hellomoon/hmApi'

export const RES_TO_INTERVAL: { [key: string]: OhlcvInterval } = {
  '1S': '1s',
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '480': '8h',
  '1D': '1D',
  '1W': '1W',
}

export const RES_TO_SECONDS: { [key: string]: number } = {
  '1S': 1,
  '1': 60,
  '3': 180,
  '5': 300,
  '15': 900,
  '30': 1800,
  '60': 3600,
  '120': 7200,
  '240': 14400,
  '480': 28800,
  '1D': 86400,
  '1W': 604800,
}

export function getNextBarTime(lastBar: Bar, resolution: number | string = '1D') {
  if (!lastBar) return

  const lastCharacter = resolution.toString().slice(-1)
  let nextBarTime

  switch (true) {
    case lastCharacter === 'W':
      nextBarTime = 7 * 24 * 60 * 60 * 1000 + lastBar.time
      break

    case lastCharacter === 'D':
      nextBarTime = 1 * 24 * 60 * 60 * 1000 + lastBar.time
      break

    default:
      nextBarTime = Number(resolution) * 60 * 1000 + lastBar.time
      break
  }

  return nextBarTime
}

export const SUBSCRIPT_NUMBER_MAP = {
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  10: '₁₀',
  11: '₁₁',
  12: '₁₂',
  13: '₁₃',
  14: '₁₄',
  15: '₁₅',
}

export const calcPricePrecision = (num: number) => {
  if (!num) return 8

  switch (true) {
    case Math.abs(+num) < 0.00000000001:
      return 16

    case Math.abs(+num) < 0.000000001:
      return 14

    case Math.abs(+num) < 0.0000001:
      return 12

    case Math.abs(+num) < 0.00001:
      return 10

    case Math.abs(+num) < 0.05:
      return 6

    case Math.abs(+num) < 1:
      return 4

    case Math.abs(+num) < 20:
      return 3

    default:
      return 2
  }
}

export const formatPrice = (num: number, precision?: number, gr0: boolean = true) => {
  if (!num) {
    return ''
  }
  if (num === 0) {
    return '0'
  }
  if (num === -0) {
    return '0'
  }

  if (!precision) {
    precision = calcPricePrecision(+num)
  }

  let formated = new BigNumber(num).toFormat(precision)

  if (formated.match(/^0\.[0]+$/g)) {
    formated = formated.replace(/\.[0]+$/g, '')
  }

  if (gr0 && formated.match(/\.0{4,15}[1-9]+/g)) {
    const match = formated.match(/\.0{4,15}/g)
    if (match) {
      const matchString = match[0].slice(1)
      formated = formated.replace(
        /\.0{4,15}/g,
        `.0${SUBSCRIPT_NUMBER_MAP[matchString.length as keyof typeof SUBSCRIPT_NUMBER_MAP]}`
      )
    }
  }

  return formated
}

export const convertCandlePriceToMcap = (candle: HMOhlcv, supply: number): Bar => {
  return {
    volume: candle.v,
    time: candle.t * 1000,
    open: candle.o * supply,
    high: candle.h * supply,
    low: candle.l * supply,
    close: candle.c * supply,
  }
}

export const convertCandleUSDToSOL = (candle: Bar, solPrice: number): Bar => {
  return {
    volume: candle.volume ? candle.volume / solPrice : undefined,
    time: candle.time,
    open: candle.open / solPrice,
    high: candle.high / solPrice,
    low: candle.low / solPrice,
    close: candle.close / solPrice,
  }
}
