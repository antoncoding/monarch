import { RewardResponseType, MarketProgramType, UniformRewardType } from '@/utils/types';

export function isMarketReward(reward: RewardResponseType): reward is MarketProgramType {
  return reward.type === 'market-reward';
}

export function isUniformReward(reward: RewardResponseType): reward is UniformRewardType {
  return reward.type === 'uniform-reward';
}

export function filterMarketRewards(rewards: RewardResponseType[]): MarketProgramType[] {
  return rewards.filter(isMarketReward);
}

export function filterUniformRewards(rewards: RewardResponseType[]): UniformRewardType[] {
  return rewards.filter(isUniformReward);
}
