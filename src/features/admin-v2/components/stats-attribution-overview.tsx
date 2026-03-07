'use client';

import { Card, CardBody } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatReadable } from '@/utils/balance';
import type { AttributionScoreboardRow, AttributionScoreboardSummary } from '@/hooks/useAttributionScoreboard';

type StatsAttributionOverviewProps = {
  summary: AttributionScoreboardSummary;
  breakdown: AttributionScoreboardRow[];
  revenueBps: number;
  isLoading: boolean;
};

type MiniStatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

function MiniStatCard({ title, value, subtitle }: MiniStatCardProps) {
  return (
    <Card className="rounded-md bg-surface shadow-sm">
      <CardBody className="p-4">
        <h3 className="text-sm text-secondary">{title}</h3>
        <p className="mt-2 font-zen text-2xl">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-secondary">{subtitle}</p>}
      </CardBody>
    </Card>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPaybackDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(1)}d`;
}

export function StatsAttributionOverview({ summary, breakdown, revenueBps, isLoading }: StatsAttributionOverviewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-zen">
        <MiniStatCard
          title="Qualified Leads"
          value={summary.qualifiedLeads.toLocaleString()}
          subtitle="First-touch wallets in window"
        />
        <MiniStatCard
          title="Activated Accounts"
          value={summary.activatedAccounts.toLocaleString()}
          subtitle={`Activation rate ${formatPercent(summary.activationRate)}`}
        />
        <MiniStatCard
          title="Attributed Volume"
          value={`$${formatReadable(summary.attributedVolumeUsd)}`}
          subtitle={`Revenue model ${revenueBps} bps`}
        />
        <MiniStatCard
          title="Estimated Revenue"
          value={`$${formatReadable(summary.attributedRevenueUsd)}`}
          subtitle={`Payback ${formatPaybackDays(summary.cacPaybackDays)}`}
        />
      </div>

      <div className="rounded-md bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-zen text-lg">Attribution Breakdown</h3>
          <p className="mt-1 text-sm text-secondary">Source/medium/campaign cohorts with activation and economics.</p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-8 text-center text-secondary">Loading attribution data...</div>
          ) : breakdown.length === 0 ? (
            <div className="py-8 text-center text-secondary">No attribution cohorts in selected window</div>
          ) : (
            <Table className="responsive w-full min-w-full rounded-md font-zen">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Source</TableHead>
                  <TableHead className="whitespace-nowrap">Medium</TableHead>
                  <TableHead className="whitespace-nowrap">Campaign</TableHead>
                  <TableHead className="whitespace-nowrap">Ref Code</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Leads</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Activated</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Activation Rate</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Volume USD</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Revenue USD</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Payback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((row) => (
                  <TableRow key={`${row.source}-${row.medium}-${row.campaign}-${row.refCode}`}>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>{row.medium}</TableCell>
                    <TableCell>{row.campaign}</TableCell>
                    <TableCell>{row.refCode}</TableCell>
                    <TableCell className="text-right">{row.qualifiedLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.activatedAccounts.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.activationRate)}</TableCell>
                    <TableCell className="text-right">${formatReadable(row.attributedVolumeUsd)}</TableCell>
                    <TableCell className="text-right">${formatReadable(row.attributedRevenueUsd)}</TableCell>
                    <TableCell className="text-right">{formatPaybackDays(row.cacPaybackDays)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
