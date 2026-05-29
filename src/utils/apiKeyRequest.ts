export type ApiKeyRequestMessage = {
  wallet: string;
  chainId: number;
  origin: string;
  issuedAt: string;
  nonce: string;
};

const MESSAGE_TITLE = 'Monarch API key request';
const MESSAGE_LINES = {
  wallet: 'Wallet',
  chainId: 'Chain ID',
  origin: 'Origin',
  issuedAt: 'Issued At',
  nonce: 'Nonce',
} as const;
const LINE_ENDING_PATTERN = /\r\n?/g;

export function buildApiKeyRequestMessage({ wallet, chainId, origin, issuedAt, nonce }: ApiKeyRequestMessage) {
  return [
    MESSAGE_TITLE,
    '',
    `${MESSAGE_LINES.wallet}: ${wallet}`,
    `${MESSAGE_LINES.chainId}: ${chainId}`,
    `${MESSAGE_LINES.origin}: ${origin}`,
    `${MESSAGE_LINES.issuedAt}: ${issuedAt}`,
    `${MESSAGE_LINES.nonce}: ${nonce}`,
  ].join('\n');
}

export function parseApiKeyRequestMessage(message: string): ApiKeyRequestMessage | null {
  const lines = message.replace(LINE_ENDING_PATTERN, '\n').split('\n');
  if (lines[0] !== MESSAGE_TITLE) return null;

  const fields = new Map<string, string>();
  for (const line of lines.slice(2)) {
    const separatorIndex = line.indexOf(': ');
    if (separatorIndex === -1) continue;
    fields.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 2).trim());
  }

  const wallet = fields.get(MESSAGE_LINES.wallet);
  const chainId = fields.get(MESSAGE_LINES.chainId);
  const origin = fields.get(MESSAGE_LINES.origin);
  const issuedAt = fields.get(MESSAGE_LINES.issuedAt);
  const nonce = fields.get(MESSAGE_LINES.nonce);

  if (!wallet || !chainId || !origin || !issuedAt || !nonce) return null;

  const parsedChainId = Number(chainId);
  if (!Number.isSafeInteger(parsedChainId) || parsedChainId <= 0) return null;

  return {
    wallet,
    chainId: parsedChainId,
    origin,
    issuedAt,
    nonce,
  };
}
