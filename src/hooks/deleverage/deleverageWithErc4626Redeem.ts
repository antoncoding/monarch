import { type Address, encodeAbiParameters, encodeFunctionData, maxUint256 } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { withSlippageFloor } from '@/hooks/leverage/math';
import {
  type EnsureBundlerAuthorization,
  type MorphoMarketParams,
  type SendBundlerTransaction,
  sleep,
} from '@/hooks/leverage/transaction-shared';
import type { Erc4626LeverageRoute } from '@/hooks/leverage/types';
import { MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { type DeleverageStepType, getDeleverageRepayBounds } from './transaction-shared';

type DeleverageWithErc4626RedeemParams = {
  account: Address;
  autoWithdrawCollateralAmount: bigint;
  bundlerAddress: Address;
  ensureBundlerAuthorization: EnsureBundlerAuthorization;
  flashLoanAmount: bigint;
  isBundlerAuthorized: boolean | undefined;
  market: Market;
  marketParams: MorphoMarketParams;
  repayBySharesAmount: bigint;
  route: Erc4626LeverageRoute;
  sendTransactionAsync: SendBundlerTransaction;
  slippageBps: number;
  updateStep: (step: DeleverageStepType) => void;
  useCloseRoute: boolean;
  useSignatureAuthorization: boolean;
  withdrawCollateralAmount: bigint;
};

export const deleverageWithErc4626Redeem = async ({
  account,
  autoWithdrawCollateralAmount,
  bundlerAddress,
  ensureBundlerAuthorization,
  flashLoanAmount,
  isBundlerAuthorized,
  market,
  marketParams,
  repayBySharesAmount,
  route,
  sendTransactionAsync,
  slippageBps,
  updateStep,
  useCloseRoute,
  useSignatureAuthorization,
  withdrawCollateralAmount,
}: DeleverageWithErc4626RedeemParams): Promise<void> => {
  const txs: `0x${string}`[] = [];

  if (useSignatureAuthorization) {
    if (!isBundlerAuthorized) {
      updateStep('authorize_bundler_sig');
    }

    const { authorized, authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
    if (!authorized) {
      throw new Error('Failed to authorize Bundler via signature.');
    }
    if (isBundlerAuthorized && authorizationTxData) {
      throw new Error('Authorization state changed. Please retry deleverage.');
    }
    if (authorizationTxData) {
      txs.push(authorizationTxData);
      await sleep(700);
    }
  } else if (!isBundlerAuthorized) {
    updateStep('authorize_bundler_tx');
    const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
    if (!authorized) {
      throw new Error('Failed to authorize Bundler via transaction.');
    }
  }

  const { bundlerV2RepaySlippageAmount } = getDeleverageRepayBounds({
    flashLoanRepayAssets: flashLoanAmount,
    repayBySharesAmount,
    useRepayByShares: useCloseRoute,
  });

  const loanAssetsOutSlippageFloor = withSlippageFloor(flashLoanAmount, slippageBps);
  const callbackTxs: `0x${string}`[] = [
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoRepay',
      args: [
        marketParams,
        useCloseRoute ? 0n : flashLoanAmount,
        useCloseRoute ? repayBySharesAmount : 0n,
        bundlerV2RepaySlippageAmount,
        account,
        '0x',
      ],
    }),
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoWithdrawCollateral',
      // Withdraw ERC4626 shares onto the bundler because the same bundler multicall redeems them immediately.
      args: [marketParams, withdrawCollateralAmount, bundlerAddress],
    }),
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'erc4626Redeem',
      args: [route.collateralVault, withdrawCollateralAmount, loanAssetsOutSlippageFloor, bundlerAddress, bundlerAddress],
    }),
  ];

  if (autoWithdrawCollateralAmount > 0n) {
    callbackTxs.push(
      encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'morphoWithdrawCollateral',
        args: [marketParams, autoWithdrawCollateralAmount, account],
      }),
    );
  }

  const flashLoanCallbackData = encodeAbiParameters([{ type: 'bytes[]' }], [callbackTxs]);
  txs.push(
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoFlashLoan',
      args: [market.loanAsset.address as Address, flashLoanAmount, flashLoanCallbackData],
    }),
  );
  // Safety net: sweep any residual loan/collateral balances from the bundler back to the user.
  txs.push(
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'erc20Transfer',
      args: [market.loanAsset.address as Address, account, maxUint256],
    }),
  );
  txs.push(
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'erc20Transfer',
      args: [market.collateralAsset.address as Address, account, maxUint256],
    }),
  );

  updateStep('execute');
  await sleep(700);

  await sendTransactionAsync({
    account,
    to: bundlerAddress,
    data: (encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'multicall',
      args: [txs],
    }) + MONARCH_TX_IDENTIFIER) as `0x${string}`,
    value: 0n,
  });
};
