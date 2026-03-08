import { type Address, encodeAbiParameters, encodeFunctionData, maxUint256 } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { LEVERAGE_FEE_RECIPIENT } from '@/config/leverage';
import { MONARCH_TX_IDENTIFIER } from '@/utils/morpho';
import type { Market } from '@/utils/types';
import { getBorrowSharesSlippageAmount, withSlippageFloor } from './math';
import {
  type EnsureLeverageAuthorization,
  type LeverageMarketParams,
  type LeverageStepType,
  type SendLeverageTransaction,
  type SignForLeverageBundlers,
  sleep,
} from './transaction-shared';
import type { Erc4626LeverageRoute } from './types';

type LeverageWithErc4626DepositParams = {
  account: Address;
  bundlerAddress: Address;
  market: Market;
  marketParams: LeverageMarketParams;
  route: Erc4626LeverageRoute;
  collateralAmount: bigint;
  collateralAmountInCollateralToken: bigint;
  inputTokenAddress: Address;
  inputTokenAmountForTransfer: bigint;
  isLoanAssetInput: boolean;
  flashCollateralAmount: bigint;
  flashLoanAmount: bigint; // amount to flashloan in loan asset
  leverageFeeAmount: bigint;
  usePermit2: boolean;
  permit2Authorized: boolean;
  isBundlerAuthorized: boolean | undefined;
  authorizePermit2: () => Promise<unknown>;
  ensureBundlerAuthorization: EnsureLeverageAuthorization;
  signForBundlers: SignForLeverageBundlers;
  isApproved: boolean;
  approve: () => Promise<unknown>;
  updateStep: (step: LeverageStepType) => void;
  sendTransactionAsync: SendLeverageTransaction;
};

export const leverageWithErc4626Deposit = async ({
  account,
  bundlerAddress,
  market,
  marketParams,
  route,
  collateralAmount,
  collateralAmountInCollateralToken,
  inputTokenAddress,
  inputTokenAmountForTransfer,
  isLoanAssetInput,
  flashCollateralAmount,
  flashLoanAmount,
  leverageFeeAmount,
  usePermit2,
  permit2Authorized,
  isBundlerAuthorized,
  authorizePermit2,
  ensureBundlerAuthorization,
  signForBundlers,
  isApproved,
  approve,
  updateStep,
  sendTransactionAsync,
}: LeverageWithErc4626DepositParams): Promise<void> => {
  const txs: `0x${string}`[] = [];

  if (usePermit2) {
    if (!permit2Authorized) {
      updateStep('approve_permit2');
      await authorizePermit2();
      await sleep(800);
    }

    if (!isBundlerAuthorized) {
      updateStep('authorize_bundler_sig');
    }

    const { authorized, authorizationTxData } = await ensureBundlerAuthorization({ mode: 'signature' });
    if (!authorized) {
      throw new Error('Failed to authorize Bundler via signature.');
    }
    if (isBundlerAuthorized && authorizationTxData) {
      throw new Error('Authorization state changed. Please retry leverage.');
    }
    if (authorizationTxData) {
      txs.push(authorizationTxData);
      await sleep(800);
    }

    updateStep('sign_permit');
    const { sigs, permitSingle } = await signForBundlers();
    txs.push(
      encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'approve2',
        args: [permitSingle, sigs, false],
      }),
    );
  } else {
    if (!isBundlerAuthorized) {
      updateStep('authorize_bundler_tx');
      const { authorized } = await ensureBundlerAuthorization({ mode: 'transaction' });
      if (!authorized) {
        throw new Error('Failed to authorize Bundler via transaction.');
      }
    }

    if (!isApproved) {
      updateStep('approve_token');
      await approve();
      await sleep(900);
    }
  }

  // Asset-based borrow uses an exact asset amount plus a max-share slippage bound.
  const borrowSharesSlippageAmount = getBorrowSharesSlippageAmount({
    borrowAssets: flashLoanAmount,
    totalBorrowAssets: BigInt(market.state.borrowAssets),
    totalBorrowShares: BigInt(market.state.borrowShares),
  });

  if (inputTokenAmountForTransfer > 0n) {
    txs.push(
      encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: usePermit2 ? 'transferFrom2' : 'erc20TransferFrom',
        args: [inputTokenAddress, inputTokenAmountForTransfer],
      }),
    );
  }

  if (isLoanAssetInput) {
    // WHY: this lets users start with loan-token underlying for ERC4626 markets.
    // We mint shares first so all leverage math and downstream Morpho collateral is in share units.
    txs.push(
      encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'erc4626Deposit',
        args: [route.collateralVault, collateralAmount, withSlippageFloor(collateralAmountInCollateralToken), bundlerAddress],
      }),
    );
  }

  const callbackTxs: `0x${string}`[] = [
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'erc4626Deposit',
      args: [route.collateralVault, flashLoanAmount, withSlippageFloor(flashCollateralAmount), bundlerAddress],
    }),
  ];

  // leverage fee is always in collateral unit.
  if (leverageFeeAmount > 0n) {
    callbackTxs.push(
      encodeFunctionData({
        abi: morphoBundlerAbi,
        functionName: 'erc20Transfer',
        args: [market.collateralAsset.address as Address, LEVERAGE_FEE_RECIPIENT, leverageFeeAmount],
      }),
    );
  }

  callbackTxs.push(
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoSupplyCollateral',
      args: [marketParams, maxUint256, account, '0x'],
    }),
  );

  callbackTxs.push(
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoBorrow',
      args: [marketParams, flashLoanAmount, 0n, borrowSharesSlippageAmount, bundlerAddress],
    }),
  );

  const flashLoanCallbackData = encodeAbiParameters([{ type: 'bytes[]' }], [callbackTxs]);
  txs.push(
    encodeFunctionData({
      abi: morphoBundlerAbi,
      functionName: 'morphoFlashLoan',
      args: [market.loanAsset.address as Address, flashLoanAmount, flashLoanCallbackData],
    }),
  );
  // Safety net: sweep any residual loan/collateral balances from bundler to the user.
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
  await sleep(500);

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
