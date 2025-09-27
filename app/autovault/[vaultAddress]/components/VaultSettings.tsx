import { Card, CardHeader, CardBody } from '@heroui/react';
import { Button } from '@/components/common/Button';
import { AutovaultData } from '@/hooks/useAutovaultData';

type VaultSettingsProps = {
  vault: AutovaultData;
  onClose: () => void;
};

export function VaultSettings({ onClose }: VaultSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Vault Settings</h3>
        <p className="text-sm text-secondary">Configure your autovault automation and strategies</p>
      </div>

      {/* Agent Configuration */}
      <Card className="bg-surface">
        <CardHeader>
          <h4 className="text-lg font-semibold">Agent Configuration</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Rebalancing Agent</p>
                <p className="text-sm text-secondary">
                  Automatically rebalance funds between markets based on yield opportunities
                </p>
              </div>
              <Button variant="cta" size="sm">
                Configure
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Risk Management Agent</p>
                <p className="text-sm text-secondary">
                  Monitor and manage risk exposure across markets
                </p>
              </div>
              <Button variant="light" size="sm">
                Add Agent
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Yield Optimization Agent</p>
                <p className="text-sm text-secondary">
                  Optimize yield by finding the best opportunities
                </p>
              </div>
              <Button variant="light" size="sm">
                Add Agent
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Rebalancing Rules */}
      <Card className="bg-surface">
        <CardHeader>
          <h4 className="text-lg font-semibold">Rebalancing Rules</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-secondary">Minimum APY Difference</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">2.0%</span>
                <Button variant="light" size="sm">
                  Edit
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Maximum Position per Market</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">50%</span>
                <Button variant="light" size="sm">
                  Edit
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Rebalance Frequency</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">Daily</span>
                <Button variant="light" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Risk Parameters */}
      <Card className="bg-surface">
        <CardHeader>
          <h4 className="text-lg font-semibold">Risk Parameters</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-secondary">Maximum Utilization</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">80%</span>
                <Button variant="light" size="sm">
                  Edit
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Emergency Stop Loss</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">Enabled</span>
                <Button variant="light" size="sm">
                  Edit
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Minimum Liquidity</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">$100K</span>
                <Button variant="light" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Vault Management */}
      <Card className="bg-surface">
        <CardHeader>
          <h4 className="text-lg font-semibold">Vault Management</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pause Vault</p>
                <p className="text-sm text-secondary">Temporarily stop all automated activities</p>
              </div>
              <Button variant="light" size="sm">
                Pause
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Emergency Withdrawal</p>
                <p className="text-sm text-secondary">
                  Withdraw all funds and stop vault operations
                </p>
              </div>
              <Button variant="light" size="sm" className="text-red-500">
                Emergency Stop
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button variant="cta" onPress={onClose}>
          Close Settings
        </Button>
      </div>
    </div>
  );
}
