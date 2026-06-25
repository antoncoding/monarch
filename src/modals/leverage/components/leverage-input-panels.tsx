import { TokenIcon } from '@/components/shared/token-icon';
import Input from '@/components/Input/Input';
import { IconSwitch } from '@/components/ui/icon-switch';
import { clampTargetLtvBps, multiplierBpsFromTargetLtv } from '@/hooks/leverage/math';
import { formatBalance } from '@/utils/balance';
import type { Market } from '@/utils/types';

const TARGET_INPUT_DEBOUNCE_MS = 300;

type InputErrorSetter = (error: string | null) => void;

type PositionDebtLoopInputProps = {
  market: Market;
  marketLiquidity: bigint;
  value: bigint;
  setValue: (value: bigint) => void;
  error: string | null;
  setError: InputErrorSetter;
};

type WalletCapitalInputProps = {
  market: Market;
  canUseLoanAssetInput: boolean;
  useLoanAssetInput: boolean;
  setUseLoanAssetInput: (selected: boolean) => void;
  inputAssetSymbol: string;
  inputAssetDecimals: number;
  inputAssetBalance: bigint | undefined;
  inputTokenIconAddress: string;
  value: bigint;
  setValue: (value: bigint) => void;
  error: string | null;
  setError: InputErrorSetter;
};

type TargetLeverageInputProps = {
  useTargetLtvInput: boolean;
  onTargetInputModeChange: (useTargetLtvInput: boolean) => void;
  targetLtvIntentBps: bigint;
  setTargetLtvIntentBps: (value: bigint) => void;
  setTargetMultiplierBps: (value: bigint) => void;
  maxTargetLtvBps: bigint;
  maxMultiplierBps: bigint;
  multiplierBps: bigint;
  syncInputFieldsFromMultiplier: (value: bigint) => void;
};

export function PositionDebtLoopInput({
  market,
  marketLiquidity,
  value,
  setValue,
  error,
  setError,
}: PositionDebtLoopInputProps): JSX.Element {
  return (
    <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
      <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">Additional Debt To Loop</p>
      <Input
        decimals={market.loanAsset.decimals}
        max={marketLiquidity}
        setValue={setValue}
        setError={setError}
        exceedMaxErrMessage="Exceeds available liquidity"
        value={value}
        inputClassName="h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums"
        endAdornment={
          <TokenIcon
            address={market.loanAsset.address}
            chainId={market.morphoBlue.chain.id}
            symbol={market.loanAsset.symbol}
            width={16}
            height={16}
          />
        }
      />
      <div className="mt-1 flex items-start gap-3 text-xs">
        {error && <p className="text-red-500">{error}</p>}
        <span className="ml-auto text-right text-secondary">
          Available: {formatBalance(marketLiquidity, market.loanAsset.decimals)} {market.loanAsset.symbol}
        </span>
      </div>
    </div>
  );
}

export function WalletCapitalInput({
  market,
  canUseLoanAssetInput,
  useLoanAssetInput,
  setUseLoanAssetInput,
  inputAssetSymbol,
  inputAssetDecimals,
  inputAssetBalance,
  inputTokenIconAddress,
  value,
  setValue,
  error,
  setError,
}: WalletCapitalInputProps): JSX.Element {
  return (
    <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-secondary">Initial Capital</p>
        {canUseLoanAssetInput && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-secondary">Use {market.loanAsset.symbol}</div>
            <IconSwitch
              size="sm"
              selected={useLoanAssetInput}
              onChange={setUseLoanAssetInput}
              thumbIcon={null}
              classNames={{
                wrapper: 'mr-0 h-4 w-9',
                thumb: 'h-3 w-3',
              }}
            />
          </div>
        )}
      </div>
      <Input
        decimals={inputAssetDecimals}
        max={inputAssetBalance}
        setValue={setValue}
        setError={setError}
        exceedMaxErrMessage="Insufficient Balance"
        value={value}
        inputClassName="h-10 rounded bg-surface px-3 py-2 text-base font-medium tabular-nums"
        endAdornment={
          <TokenIcon
            address={inputTokenIconAddress}
            chainId={market.morphoBlue.chain.id}
            symbol={inputAssetSymbol}
            width={16}
            height={16}
          />
        }
      />
      <div className="mt-1 flex items-start gap-3 text-xs">
        {error && <p className="text-red-500">{error}</p>}
        <span className="ml-auto text-right text-secondary">
          Balance: {formatBalance(inputAssetBalance ?? 0n, inputAssetDecimals)} {inputAssetSymbol}
        </span>
      </div>
    </div>
  );
}

export function TargetLeverageInput({
  useTargetLtvInput,
  onTargetInputModeChange,
  targetLtvIntentBps,
  setTargetLtvIntentBps,
  setTargetMultiplierBps,
  maxTargetLtvBps,
  maxMultiplierBps,
  multiplierBps,
  syncInputFieldsFromMultiplier,
}: TargetLeverageInputProps): JSX.Element {
  return (
    <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-secondary">{useTargetLtvInput ? 'Target LTV' : 'Target Multiplier'}</p>
        <div className="flex items-center gap-2">
          <div className="text-xs text-secondary">Use LTV</div>
          <IconSwitch
            size="sm"
            selected={useTargetLtvInput}
            onChange={onTargetInputModeChange}
            thumbIcon={null}
            classNames={{
              wrapper: 'mr-0 h-4 w-9',
              thumb: 'h-3 w-3',
            }}
          />
        </div>
      </div>
      <div className="relative min-w-0">
        {useTargetLtvInput ? (
          <Input
            decimals={2}
            setValue={(nextTargetLtvBps) => {
              const clampedTargetLtvBps = clampTargetLtvBps(nextTargetLtvBps, maxTargetLtvBps);
              setTargetLtvIntentBps(clampedTargetLtvBps);
              setTargetMultiplierBps(multiplierBpsFromTargetLtv(clampedTargetLtvBps, maxMultiplierBps));
            }}
            value={targetLtvIntentBps}
            inputClassName="h-10 rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums"
            endAdornment={<span className="text-xs text-secondary">%</span>}
            debounceSetValueMs={TARGET_INPUT_DEBOUNCE_MS}
          />
        ) : (
          <Input
            decimals={4}
            setValue={syncInputFieldsFromMultiplier}
            value={multiplierBps}
            inputClassName="h-10 rounded bg-hovered px-3 py-2 pr-10 text-base font-medium tabular-nums"
            endAdornment={<span className="text-xs text-secondary">x</span>}
            debounceSetValueMs={TARGET_INPUT_DEBOUNCE_MS}
          />
        )}
      </div>
    </div>
  );
}
