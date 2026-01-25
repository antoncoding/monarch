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
            <h1 className="font-zen text-xl">Stats V2 (Experimental)</h1>
            <p className="mt-2 text-sm text-secondary">This page uses an experimental API that may be reverted due to cost concerns.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              type="password"
              label="Access Password"
              placeholder="Enter password"
              value={password}
              onValueChange={setPassword}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              className="mt-4 w-full"
              disabled={isLoading || !password}
            >
              {isLoading ? 'Verifying...' : 'Access Dashboard'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-secondary">Contact the team if you need access credentials.</p>
        </CardBody>
      </Card>
    </div>
  );
}
