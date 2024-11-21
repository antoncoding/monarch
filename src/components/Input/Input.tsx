import { useCallback, useState } from 'react';

import { parseUnits } from 'viem';
import { formatBalance } from '@/utils/balance';

type InputProps = {
  decimals: number;
  max: bigint;
  setValue: React.Dispatch<React.SetStateAction<bigint>>;
  setError?: React.Dispatch<React.SetStateAction<string | null>>;
  exceedMaxErrMessage?: string;
  allowExceedMax?: boolean; // whether to still "setValue" when the input exceeds max
};

export default function Input({
  decimals,
  max,
  setValue,
  setError,
  exceedMaxErrMessage,
  allowExceedMax = false,
}: InputProps): JSX.Element {
  // State for the input text
  const [inputAmount, setInputAmount] = useState<string>('0');

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // update the shown input text regardless
      const inputText = e.target.value;
      setInputAmount(inputText);

      try {
        const inputBigInt = parseUnits(inputText, decimals);

        if (inputBigInt > max) {
          if (setError) setError(exceedMaxErrMessage ?? 'Input exceeds max');
          if (allowExceedMax) {
            setValue(inputBigInt);
          }
          return;
        }

        setValue(inputBigInt);
        if (setError) setError(null);

        // eslint-disable-next-line @typescript-eslint/no-shadow
      } catch (e) {
        if (setError) setError('Invalid input');
        console.log('e', e);
      }
    },
    [decimals, setError, setInputAmount, setValue, max, exceedMaxErrMessage, allowExceedMax],
  );

  // if max is clicked, set the input to the max value
  const handleMax = useCallback(() => {
    setValue(max);
    // set readable input
    setInputAmount(formatBalance(max, decimals).toString());
  }, [max, decimals, setInputAmount, setValue]);

  return (
    <div className="relative flex-grow">
      <input
        type="number"
        value={inputAmount}
        onChange={onInputChange}
        className="bg-hovered h-10 w-full rounded p-2 focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={handleMax}
        className="bg-surface absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 text-sm text-secondary opacity-80 duration-300 ease-in-out hover:scale-105 hover:opacity-100"
      >
        Max
      </button>
    </div>
  );
}
