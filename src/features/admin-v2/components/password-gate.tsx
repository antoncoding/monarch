'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAdminAuth } from '@/stores/useAdminAuth';

type PasswordGateProps = {
  children: React.ReactNode;
};

export function PasswordGate({ children }: PasswordGateProps) {
  const { isAuthenticated, isLoading, isCheckingAuth, error, authenticate, checkAuth } = useAdminAuth();
  const [password, setPassword] = useState('');

  // Check auth status on mount (validates existing cookie)
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Show spinner while checking existing auth
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size={32} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const success = await authenticate(password);
    if (!success) {
      setPassword('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardBody className="p-6">
          <div className="mb-6 text-center">
            <h1 className="font-zen text-xl">Monarch Stats</h1>
            <p className="mt-2 text-sm text-secondary">Protected admin dashboard for Monarch protocol activity.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              type="password"
              label="Access password"
              placeholder="Enter password"
              value={password}
              onValueChange={setPassword}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
              autoFocus
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="primary"
              className="mt-4 font-normal"
              fullWidth
              isLoading={isLoading}
              disabled={isLoading || !password}
            >
              Access dashboard
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-secondary">Contact the team for access credentials.</p>
        </CardBody>
      </Card>
    </div>
  );
}
