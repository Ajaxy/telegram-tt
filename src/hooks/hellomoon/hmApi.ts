export type PoolsSortBy = 'tvl' | 'apr' | 'vol'
export type OhlcvInterval = '1s' | '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '1D' | '1W'

export interface HMPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const API_URL = 'https://hyperswap-public-production.up.railway.app/data'
const API_KEY = 'O2c5gIAB/ePI+uP22JnbOvZu2K401M910OQL9YKSQSI=' // hardcoded for ease of testing for now

const bearerToken = `Bearer ${API_KEY}`

export const fetchPools = async (
  sortBy: PoolsSortBy,
  page: number,
  limit: number,
  q?: string
): Promise<{
  pools: HMPool[]
  pagination: HMPagination
}> => {
  const params = new URLSearchParams({
    sortBy,
    page: page.toString(),
    limit: limit.toString(),
    ...(q && { q }),
  })
  const response = await fetch(`${API_URL}/pools?${params}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export const fetchPool = async (poolAddress: string): Promise<HMPool> => {
  const response = await fetch(`${API_URL}/pools/${poolAddress}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export const fetchPoolTransactions = async (
  poolAddress: string,
  page: number = 1,
  limit: number = 10,
  token?: string
): Promise<{
  transactions: HMPoolTransaction[]
  selectedToken: string
  inverted: boolean
  pagination: HMPagination
}> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(token && { token }),
  })
  const response = await fetch(`${API_URL}/pools/${poolAddress}/txs?${params}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export const fetchPoolTransaction = async (txHash: string): Promise<HMPoolTransaction> => {
  const response = await fetch(`${API_URL}/txs/${txHash}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export const fetchPoolOhlcv = async (
  poolAddress: string,
  interval: OhlcvInterval = '1m',
  from?: number,
  to?: number,
  take?: number,
  usd?: boolean,
  token?: string
): Promise<{
  poolAddress: string
  interval: OhlcvInterval
  selectedToken: string
  inverted: boolean
  data: HMOhlcv[]
}> => {
  const params = new URLSearchParams({
    interval,
    ...(from && { from: from.toString() }),
    ...(to && { to: to.toString() }),
    ...(take && { take: take.toString() }),
    ...(usd && { usd: usd.toString() }),
    ...(token && { token }),
  })

  const response = await fetch(`${API_URL}/pools/${poolAddress}/ohlcv?${params}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export const fetchPairPools = async (
  token0: string,
  token1: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  pools: HMPool[]
  pagination: HMPagination
}> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  const response = await fetch(`${API_URL}/pools/pair/${token0}/${token1}?${params}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export const fetchPoolsByToken = async (
  token: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  pools: HMPool[]
  pagination: HMPagination
}> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  const response = await fetch(`${API_URL}/pools/token/${token}?${params}`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  return response.json()
}

export interface HMTokenMetadata {
  address: string
  symbol: string
  name: string
  decimals: number
  createdAt: string
  updatedAt: string
}

export interface HMPoolTokenMetadata {
  address: string
  token0: HMTokenMetadata | null
  token1: HMTokenMetadata | null
}

export const fetchPoolTokenMetadata = async (poolAddress: string): Promise<HMPoolTokenMetadata> => {
  const response = await fetch(`${API_URL}/pools/${poolAddress}/token-metadata`, {
    headers: {
      Authorization: bearerToken,
    },
  })
  if (!response.ok) {
    throw new Error('Failed to fetch pool token metadata')
  }
  return response.json()
}

export interface HMPool {
  address: string
  token0: string
  token1: string
  fee: number
  tickSpacing: number
  createdAt: string
  updatedAt: string
  poolFactory: string
  txHash: string
  blockNumber: string
  blockTimestamp: string
  feeProtocol0: number
  feeProtocol1: number
  currentTvlUSD: number
  currentTvlToken0: number
  currentTvlToken1: number
  currentPrice: number
  currentPriceUSD: number
  currentSqrtPriceX96: string
  currentTick: number
  currentLiquidity: string
  volume24hUSD: number
  fees24hUSD: number
  swaps24h: number
  volume7dUSD: number
  fees7dUSD: number
  apr24h: number
  apr7d: number
  totalVolumeUSD: number
  totalFeesUSD: number
  totalSwaps: number
  lastTxBlock: string | null
  lastTxTimestamp: string | null
  count?: {
    transactions: number
    positions: number
  }
}

export interface HMOhlcv {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}
type HMTransactionType = 'SWAP' | 'MINT' | 'BURN' | 'COLLECT' | 'INITIALIZE' | 'COLLECT_PROTOCOL'

export interface HMPoolTransaction {
  id: string
  txHash: string
  blockNumber: string
  blockTimestamp: string
  logIndex: number
  poolAddress: string
  transactionType: HMTransactionType
  sender: string
  recipient: string
  amount0: number
  amount1: number
  sqrtPriceX96: string | null
  liquidity: string | null
  tick: number | null
  tickLower: number | null
  tickUpper: number | null
  liquidityAmount: string | null
  hypePriceUSD: number | null
  zeroForOne: boolean | null
  amountInNet: number | null
  amountOutNet: number | null
  amountInGross: number | null
  feesToken0: number | null
  feesToken1: number | null
  volumeToken0: number | null
  volumeToken1: number | null
  volumeUSD: number | null
  feesUSD: number | null
  price: number | null
  priceUSD: number | null
  tvlToken0: number | null
  tvlToken1: number | null
  tvlUSD: number | null
}
