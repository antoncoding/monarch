import React from 'react';

const rotateCSS = `
  @keyframes rotate360 {
    from {
      transform: rotate(45deg);
    }
    to {
      transform: rotate(405deg);
    }
  }
  .RotateElement {
    animation: rotate360 1s cubic-bezier(0.83, 0, 0.17, 1) infinite;
    transform-origin: center center;
  }
`;

type LoadingSpinnerProps = {
  size?: number;
  width?: number;
  color?: string;
};

export function Spinner({ size = 32, width = 3, color }: LoadingSpinnerProps) {
  return (
    <div className="inline-flex items-center justify-center">
      <style>{rotateCSS}</style>
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className={`relative ${color ?? 'text-primary'}`}
          style={{ width: size, height: size }}
        >
          {/* Background circle */}
          <div
            className="absolute rounded-full border-current"
            style={{
              width: size,
              height: size,
              borderWidth: width,
              opacity: 0.2,
            }}
          />
          {/* Spinning element */}
          <div
            className="RotateElement absolute rounded-full border-current"
            style={{
              width: size,
              height: size,
              borderWidth: width,
              borderColor: 'currentColor transparent transparent transparent',
            }}
          />
        </div>
      </div>
    </div>
  );
}
