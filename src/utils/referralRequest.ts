const MESSAGE_TITLE = 'Monarch referral link request';
const MESSAGE_LINES = {
  wallet: 'Wallet',
} as const;
const LINE_ENDING_PATTERN = /\r\n?/g;

export interface ReferralCodeRequestMessage {
  wallet: string;
}

export function buildReferralCodeRequestMessage({ wallet }: ReferralCodeRequestMessage) {
  return [MESSAGE_TITLE, '', `${MESSAGE_LINES.wallet}: ${wallet}`].join('\n');
}

export function parseReferralCodeRequestMessage(message: string): ReferralCodeRequestMessage | null {
  const lines = message.replace(LINE_ENDING_PATTERN, '\n').split('\n');
  if (lines[0] !== MESSAGE_TITLE) return null;

  const fields = new Map<string, string>();
  for (const line of lines.slice(2)) {
    const separatorIndex = line.indexOf(': ');
    if (separatorIndex === -1) continue;
    fields.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 2).trim());
  }

  const wallet = fields.get(MESSAGE_LINES.wallet);
  if (!wallet) return null;

  return {
    wallet,
  };
}
