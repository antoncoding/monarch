export type RedstoneOracleEntry = {
  path: string;
  priceFeedAddress: string;
  fundamental: boolean;
  dataServiceId: string;
  heartbeat: number;
  threshold: number;
};
