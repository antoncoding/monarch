const MESSAGE_TITLE = 'Monarch referral link request';
const WALLET_LINE = 'Wallet: ';
const MESSAGE_PREFIX = `${MESSAGE_TITLE}\n\n${WALLET_LINE}`;
const LINE_ENDING_PATTERN = /\r\n?/g;

export interface ReferralCodeRequestMessage {
  wallet: string;
}

export function buildReferralCodeRequestMessage({ wallet }: ReferralCodeRequestMessage) {
  return `${MESSAGE_PREFIX}${wallet}`;
}

export function parseReferralCodeRequestMessage(message: string): ReferralCodeRequestMessage | null {
  const normalizedMessage = message.replace(LINE_ENDING_PATTERN, '\n');
  if (!normalizedMessage.startsWith(MESSAGE_PREFIX)) return null;

  const wallet = normalizedMessage.slice(MESSAGE_PREFIX.length).trim();
  if (!wallet || wallet.includes('\n')) return null;

  return {
    wallet,
  };
}
