export type MerklCampaignType = 'MORPHOSUPPLY' | 'MORPHOBORROW' | 'MORPHOSUPPLY_SINGLETOKEN';

export type MerklCampaignStatus = {
  status: string;
  error: string;
  details: string;
  delay: number;
  computedUntil: number;
  processingStarted: number;
};

export type MerklChain = {
  id: number;
  name: string;
  icon: string;
  liveCampaigns: number;
  endOfDisputePeriod: number;
};

export type MerklToken = {
  id: string;
  name: string;
  chainId: number;
  address: string;
  decimals: number;
  icon: string;
  verified: boolean;
  isTest: boolean;
  type: string;
  isNative: boolean;
  price: number;
  updatedAt: number;
  priceSource: string;
  symbol: string;
};

export type MerklCreator = {
  address: string;
  tags: string[];
  creatorId: string | null;
};

export type MerklCampaignParams = {
  LLTV: string;
  market: string;
  duration: number;
  blacklist: string[];
  loanToken: string;
  whitelist: string[];
  forwarders: string[];
  targetToken: string;
  collateralToken: string;
  symbolLoanToken: string;
  decimalsLoanToken: number;
  symbolRewardToken: string;
  symbolTargetToken: string;
  decimalsRewardToken: number;
  decimalsTargetToken: number;
  symbolCollateralToken: string;
  computeScoreParameters: {
    computeMethod: string;
  };
  decimalsCollateralToken: number;
  distributionMethodParameters: {
    distributionMethod: string;
    distributionSettings: {
      apr: string;
      targetToken: string;
      symbolTargetToken: string;
      rewardTokenPricing: boolean;
      targetTokenPricing: boolean;
      decimalsTargetToken: number;
    };
  };
};

export type MerklCampaign = {
  id: string;
  computeChainId: number;
  distributionChainId: number;
  campaignId: string;
  type: MerklCampaignType;
  distributionType: string;
  subType: number;
  rewardTokenId: string;
  amount: string;
  opportunityId: string;
  startTimestamp: number;
  endTimestamp: number;
  dailyRewards: number;
  apr: number;
  creatorAddress: string;
  params: MerklCampaignParams;
  chain: MerklChain;
  rewardToken: MerklToken;
  distributionChain: MerklChain;
  campaignStatus: MerklCampaignStatus;
  creator: MerklCreator;
  createdAt: string;
  childCampaignIds: string[];
  program: any;
};

export type MerklCampaignsResponse = MerklCampaign[];

export type MerklApiParams = {
  type?: MerklCampaignType;
  chainId?: number;
  items?: number;
  page?: number;
  startTimestamp?: number;
  endTimestamp?: number;
};

export type SimplifiedCampaign = {
  marketId: string;
  chainId: number;
  campaignId: string;
  type: MerklCampaignType;
  apr: number;
  rewardToken: {
    symbol: string;
    icon: string;
    address: string;
  };
  collateralToken?: {
    symbol: string;
  };
  loanToken?: {
    symbol: string;
  };
  targetToken?: {
    symbol: string;
    address: string;
  };
  startTimestamp: number;
  endTimestamp: number;
  isActive: boolean;
};