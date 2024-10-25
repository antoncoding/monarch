'use client';

import { useParams } from 'next/navigation';
import { useMarket } from '@/hooks/useMarket';
import { TimeseriesOptions } from '@/utils/types';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardBody } from "@nextui-org/card";
import { Divider } from "@nextui-org/divider";
import { Spinner } from "@nextui-org/spinner";

const MarketContent = () => {
  const { marketid } = useParams();
  const [timeRange, setTimeRange] = useState<TimeseriesOptions>({
    startTimestamp: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60, // 1 week ago
    endTimestamp: Math.floor(Date.now() / 1000),
    interval: 'HOUR',
  });

  const { data: market, isLoading, error } = useMarket(marketid as string, timeRange);

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  if (error) return <div className="text-center text-red-500">Error: {(error as Error).message}</div>;
  if (!market) return <div className="text-center">Market not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">
        {market.loanAsset.symbol}/{market.collateralAsset.symbol} Market
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader className="text-2xl font-semibold">Market Overview</CardHeader>
          <Divider />
          <CardBody>
            <ul className="space-y-2">
              <li><span className="font-semibold">Loan Asset:</span> {market.loanAsset.symbol}</li>
              <li><span className="font-semibold">Collateral Asset:</span> {market.collateralAsset.symbol}</li>
              <li><span className="font-semibold">LLTV:</span> {(parseFloat(market.lltv) * 100).toFixed(2)}%</li>
              <li><span className="font-semibold">Supply APY:</span> {(market.state.supplyApy * 100).toFixed(2)}%</li>
              <li><span className="font-semibold">Borrow APY:</span> {(market.state.borrowApy * 100).toFixed(2)}%</li>
              <li><span className="font-semibold">Utilization:</span> {(market.state.utilization * 100).toFixed(2)}%</li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="text-2xl font-semibold">Market Stats</CardHeader>
          <Divider />
          <CardBody>
            <ul className="space-y-2">
              <li><span className="font-semibold">Total Supply:</span> ${parseFloat(market.state.supplyAssetsUsd).toLocaleString()}</li>
              <li><span className="font-semibold">Total Borrow:</span> ${parseFloat(market.state.borrowAssetsUsd).toLocaleString()}</li>
              <li><span className="font-semibold">Available Liquidity:</span> ${market.state.liquidityAssetsUsd.toLocaleString()}</li>
              <li><span className="font-semibold">Collateral:</span> ${market.state.collateralAssetsUsd?.toLocaleString() ?? 'N/A'}</li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader className="text-2xl font-semibold">Historical APY</CardHeader>
        <Divider />
        <CardBody>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={market.historicalState.supplyApy}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tickFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleDateString()} />
              <YAxis tickFormatter={(value) => `${(value * 100).toFixed(2)}%`} />
              <Tooltip
                labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
              />
              <Legend />
              <Line type="monotone" dataKey="y" name="Supply APY" stroke="#8884d8" />
              <Line type="monotone" dataKey={(data) => market.historicalState.borrowApy.find(item => item.x === data.x)?.y} name="Borrow APY" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card className="mb-8">
        <CardHeader className="text-2xl font-semibold">Historical Assets USD</CardHeader>
        <Divider />
        <CardBody>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={market.historicalState.supplyAssetsUsd}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tickFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleDateString()} />
              <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
              <Tooltip
                labelFormatter={(unixTime) => new Date(unixTime * 1000).toLocaleString()}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Line type="monotone" dataKey="y" name="Supply Assets USD" stroke="#8884d8" />
              <Line type="monotone" dataKey={(data) => market.historicalState.borrowAssetsUsd.find(item => item.x === data.x)?.y} name="Borrow Assets USD" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="text-2xl font-semibold">Market Warnings</CardHeader>
        <Divider />
        <CardBody>
          {market.warningsWithDetail.length > 0 ? (
            <ul className="space-y-2">
              {market.warningsWithDetail.map((warning, index) => (
                <li key={index} className="bg-yellow-100 p-2 rounded">
                  <span className="font-semibold">{warning.category}:</span> {warning.description}
                </li>
              ))}
            </ul>
          ) : (
            <p>No warnings for this market.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default MarketContent;

