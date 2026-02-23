'use client';

import { useMemo, useState } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';

export function ButtonHarness(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="surface">Surface</Button>
      <Button variant="default">Default</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="primary" size="sm">
        Small
      </Button>
      <Button variant="primary" size="lg">
        Large
      </Button>
    </div>
  );
}

export function CardHarness(): JSX.Element {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Borrow Position</CardTitle>
        <CardDescription>Simple card with static content for spacing checks.</CardDescription>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-secondary">Collateral</p>
            <p>2.60 WETH</p>
          </div>
          <div>
            <p className="text-secondary">Debt</p>
            <p>1,200 USDC</p>
          </div>
        </div>
      </CardBody>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">
          Dismiss
        </Button>
        <Button variant="primary" size="sm">
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

export function TooltipHarness(): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <Tooltip content="Current APY includes base and rewards" placement="top">
        <span>
          <Button variant="surface" size="sm">
            Hover me
          </Button>
        </span>
      </Tooltip>
      <p className="text-sm text-secondary">Wrap trigger in `span` to avoid ResizeObserver issues.</p>
    </div>
  );
}

export function TooltipContentHarness(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="max-w-md rounded-sm border border-border bg-surface p-4">
        <TooltipContent
          title="WETH"
          icon={<div className="h-6 w-6 rounded-full bg-hovered" />}
        />
      </div>

      <div className="max-w-md rounded-sm border border-border bg-surface p-4">
        <TooltipContent
          title="USDC Market"
          detail="Current APY includes base interest and incentives."
          secondaryDetail="Data refreshed every 30 seconds"
          icon={<div className="h-6 w-6 rounded-full bg-hovered" />}
          actionIcon={<ExternalLinkIcon className="h-4 w-4" />}
          actionHref="https://docs.morpho.org/"
        />
      </div>
    </div>
  );
}

export function InputHarness(): JSX.Element {
  const [amount, setAmount] = useState('1250');

  return (
    <div className="max-w-md space-y-3">
      <Input label="Borrow Amount" value={amount} onValueChange={setAmount} endContent={<span className="text-xs text-secondary">USDC</span>} />
      <Input
        label="Invalid State"
        value={amount}
        onValueChange={setAmount}
        isInvalid
        errorMessage="Amount exceeds available liquidity"
      />
    </div>
  );
}

export function SelectHarness(): JSX.Element {
  const [network, setNetwork] = useState('mainnet');

  return (
    <div className="max-w-sm space-y-3">
      <p className="text-sm text-secondary">Selected network: {network}</p>
      <Select value={network} onValueChange={setNetwork}>
        <SelectTrigger>
          <SelectValue placeholder="Select network" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mainnet">Ethereum</SelectItem>
          <SelectItem value="base">Base</SelectItem>
          <SelectItem value="arbitrum">Arbitrum</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function BadgeHarness(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
    </div>
  );
}

export function TableHarness(): JSX.Element {
  const rows = useMemo(
    () => [
      { token: 'USDC', supplied: '$12,000', apy: '4.7%' },
      { token: 'WETH', supplied: '$8,540', apy: '2.9%' },
      { token: 'WBTC', supplied: '$2,150', apy: '1.8%' },
    ],
    [],
  );

  return (
    <div className="max-w-2xl rounded-sm border border-border p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left text-secondary">Asset</TableHead>
            <TableHead className="text-right text-secondary">Supplied</TableHead>
            <TableHead className="text-right text-secondary">APY</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="table-body-compact">
          {rows.map((row) => (
            <TableRow key={row.token}>
              <TableCell>{row.token}</TableCell>
              <TableCell className="text-right">{row.supplied}</TableCell>
              <TableCell className="text-right">{row.apy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TabsHarness(): JSX.Element {
  return (
    <Tabs defaultValue="borrow" className="max-w-xl">
      <TabsList>
        <TabsTrigger value="borrow">Borrow</TabsTrigger>
        <TabsTrigger value="repay">Repay</TabsTrigger>
      </TabsList>
      <TabsContent value="borrow">Borrow flow content placeholder.</TabsContent>
      <TabsContent value="repay">Repay flow content placeholder.</TabsContent>
    </Tabs>
  );
}

export function SliderHarness(): JSX.Element {
  const [value, setValue] = useState<number[]>([42]);

  return (
    <div className="max-w-md space-y-3">
      <p className="text-sm text-secondary">Utilization target: {value[0]}%</p>
      <Slider value={value} onValueChange={setValue} max={100} min={0} step={1} />
    </div>
  );
}

export function CheckboxHarness(): JSX.Element {
  const [checked, setChecked] = useState(false);

  return (
    <div className="space-y-3">
      <Checkbox checked={checked} onCheckedChange={(next) => setChecked(next === true)} label="Enable Permit2 for this flow" />
      <Checkbox variant="highlighted" checked={checked} onCheckedChange={(next) => setChecked(next === true)} label="Use highlighted style" />
    </div>
  );
}

export function PopoverHarness(): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="surface" size="sm">
            Open popover
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <p className="text-sm">This area is useful for quick spacing/layout checks inside overlays.</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function SpinnerHarness(): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <Spinner size={20} />
      <Spinner size={32} />
      <Spinner size={44} />
    </div>
  );
}
