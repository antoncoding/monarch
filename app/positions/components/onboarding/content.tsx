'use client';

import React from 'react';
import { OnboardingModal } from './Modal';

export default function OnboardingContent() {
  return (
    <div className="flex justify-center">
      <OnboardingModal isOpen onClose={() => {}} />
    </div>
  );
}
