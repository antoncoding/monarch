import { isAddress, isHex, type Address } from 'viem';
import { SWAP_PARTNER, VELORA_API_BASE_URL, VELORA_PRICES_API_VERSION } from '../constants';

export type VeloraSwapSide = 'SELL' | 'BUY';

export type VeloraPriceRoute = {
  srcToken: string;
  destToken: string;
  srcAmount: string;
  destAmount: string;
  tokenTransferProxy?: string;
  contractAddress?: string;
};

export type VeloraTransactionPayload = {
  to: Address;
  data: `0x${string}`;
  value?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

type VeloraPriceResponse = {
  priceRoute?: VeloraPriceRoute;
  error?: string;
  message?: string;
  description?: string;
};

type VeloraBuildTransactionResponse = {
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  error?: string;
  message?: string;
  description?: string;
};

export type FetchVeloraPriceRouteParams = {
  srcToken: string;
  srcDecimals: number;
  destToken: string;
  destDecimals: number;
  amount: bigint;
  network: number;
  userAddress: Address;
  partner?: string;
  side?: VeloraSwapSide;
};

export type BuildVeloraTransactionPayloadParams = {
  srcToken: string;
  srcDecimals: number;
  destToken: string;
  destDecimals: number;
  srcAmount: bigint;
  network: number;
  userAddress: Address;
  priceRoute: VeloraPriceRoute;
  slippageBps: number;
  side?: VeloraSwapSide;
  partner?: string;
  ignoreChecks?: boolean;
};

export type PrepareVeloraSwapPayloadParams = {
  srcToken: string;
  srcDecimals: number;
  destToken: string;
  destDecimals: number;
  amount: bigint;
  network: number;
  userAddress: Address;
  slippageBps: number;
  side?: VeloraSwapSide;
  partner?: string;
  ignoreChecks?: boolean;
};

export class VeloraApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'VeloraApiError';
    this.status = status;
    this.details = details;
  }
}

const extractVeloraErrorMessage = (payload: unknown): string => {
  if (!payload) return 'Unknown Velora API error';

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;

    if (typeof objectPayload.description === 'string') {
      return objectPayload.description;
    }
    if (typeof objectPayload.error === 'string') {
      return objectPayload.error;
    }
    if (typeof objectPayload.message === 'string') {
      return objectPayload.message;
    }

    const nested = objectPayload.error ?? objectPayload.message;
    if (nested && nested !== payload) {
      return extractVeloraErrorMessage(nested);
    }
  }

  return 'Unknown Velora API error';
};

const fetchVeloraJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const raw = await response.text();

  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const message = extractVeloraErrorMessage(payload);
    throw new VeloraApiError(message, response.status, payload);
  }

  return payload as T;
};

const parseVeloraAddressField = (value: unknown, fieldName: string): Address => {
  if (typeof value !== 'string' || !isAddress(value)) {
    throw new VeloraApiError(`Invalid ${fieldName} address returned by Velora`, 400, { [fieldName]: value });
  }
  return value as Address;
};

const parseVeloraHexDataField = (value: unknown, fieldName: string): `0x${string}` => {
  if (typeof value !== 'string' || !isHex(value) || value.length <= 2) {
    throw new VeloraApiError(`Invalid ${fieldName} payload returned by Velora`, 400, { [fieldName]: value });
  }
  return value as `0x${string}`;
};

export const getVeloraApprovalTarget = (priceRoute: VeloraPriceRoute | null): Address | null => {
  const spender = priceRoute?.tokenTransferProxy ?? priceRoute?.contractAddress;
  if (!spender || !isAddress(spender)) return null;
  return spender as Address;
};

export const isVeloraRateChangedError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('rate has changed') || message.includes('re-query the latest price');
};

export const fetchVeloraPriceRoute = async ({
  srcToken,
  srcDecimals,
  destToken,
  destDecimals,
  amount,
  network,
  userAddress,
  partner = SWAP_PARTNER,
  side = 'SELL',
}: FetchVeloraPriceRouteParams): Promise<VeloraPriceRoute> => {
  const query = new URLSearchParams({
    srcToken,
    destToken,
    srcDecimals: srcDecimals.toString(),
    destDecimals: destDecimals.toString(),
    amount: amount.toString(),
    side,
    network: network.toString(),
    userAddress,
    partner,
    version: VELORA_PRICES_API_VERSION,
  });

  const response = await fetchVeloraJson<VeloraPriceResponse>(`${VELORA_API_BASE_URL}/prices?${query.toString()}`, {
    method: 'GET',
  });

  if (!response.priceRoute) {
    throw new VeloraApiError(
      response.description ?? response.error ?? response.message ?? 'No price route returned by Velora',
      400,
      response,
    );
  }

  return response.priceRoute;
};

export const buildVeloraTransactionPayload = async ({
  srcToken,
  srcDecimals,
  destToken,
  destDecimals,
  srcAmount,
  network,
  userAddress,
  priceRoute,
  slippageBps,
  side = 'SELL',
  partner = SWAP_PARTNER,
  ignoreChecks = false,
}: BuildVeloraTransactionPayloadParams): Promise<VeloraTransactionPayload> => {
  const query = new URLSearchParams();
  if (ignoreChecks) {
    query.set('ignoreChecks', 'true');
  }

  const transactionUrl =
    query.size > 0
      ? `${VELORA_API_BASE_URL}/transactions/${network}?${query.toString()}`
      : `${VELORA_API_BASE_URL}/transactions/${network}`;

  const response = await fetchVeloraJson<VeloraBuildTransactionResponse>(transactionUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      srcToken,
      srcDecimals,
      destToken,
      destDecimals,
      srcAmount: srcAmount.toString(),
      side,
      slippage: slippageBps,
      priceRoute,
      userAddress,
      partner,
    }),
  });

  if (!response.to || !response.data) {
    throw new VeloraApiError(
      response.description ?? response.error ?? response.message ?? 'Invalid transaction payload from Velora',
      400,
      response,
    );
  }

  const to = parseVeloraAddressField(response.to, 'to');
  const data = parseVeloraHexDataField(response.data, 'data');

  return {
    to,
    data,
    value: response.value,
    gas: response.gas,
    gasPrice: response.gasPrice,
    maxFeePerGas: response.maxFeePerGas,
    maxPriorityFeePerGas: response.maxPriorityFeePerGas,
  };
};

export const prepareVeloraSwapPayload = async ({
  srcToken,
  srcDecimals,
  destToken,
  destDecimals,
  amount,
  network,
  userAddress,
  slippageBps,
  side = 'SELL',
  partner = SWAP_PARTNER,
  ignoreChecks = false,
}: PrepareVeloraSwapPayloadParams): Promise<{ priceRoute: VeloraPriceRoute; txPayload: VeloraTransactionPayload }> => {
  const priceRoute = await fetchVeloraPriceRoute({
    srcToken,
    srcDecimals,
    destToken,
    destDecimals,
    amount,
    network,
    userAddress,
    side,
    partner,
  });

  const txPayload = await buildVeloraTransactionPayload({
    srcToken,
    srcDecimals,
    destToken,
    destDecimals,
    srcAmount: amount,
    network,
    userAddress,
    priceRoute,
    slippageBps,
    side,
    partner,
    ignoreChecks,
  });

  return {
    priceRoute,
    txPayload,
  };
};
