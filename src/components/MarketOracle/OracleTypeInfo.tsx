import { getOracleType, getOracleTypeDescription, OracleType } from '@/utils/oracle'
import { MarketOracleFeedInfo } from '@/components/MarketOracle'
import { MorphoChainlinkOracleData } from '@/utils/types'

type OracleTypeInfoProps = {
  oracleData: MorphoChainlinkOracleData | null | undefined
  oracleAddress: string
  chainId: number
}

export function OracleTypeInfo({ oracleData, oracleAddress, chainId }: OracleTypeInfoProps) {
  const oracleType = getOracleType(oracleData, oracleAddress, chainId)
  const typeDescription = getOracleTypeDescription(oracleType)
  
  return (
    <>
      <div className="flex items-center justify-between">
        <span>Oracle Type:</span>
        <span className="text-sm font-medium">{oracleType}</span>
      </div>
      
      {oracleType === OracleType.Standard ? (<MarketOracleFeedInfo
            baseFeedOne={oracleData?.baseFeedOne}
            baseFeedTwo={oracleData?.baseFeedTwo}
            quoteFeedOne={oracleData?.quoteFeedOne}
            quoteFeedTwo={oracleData?.quoteFeedTwo}
            chainId={chainId}
          />) : (
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {typeDescription}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            This market uses a custom oracle implementation that doesn't follow the standard Morpho feed structure.
          </div>
        </div>
      )}
    </>
  )
}