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

interface LoadingSpinnerProps {
  size?: number;
  width?: number;
  color?: string;
}

export function Spinner({
  size = 32,
  width = 3,
  color = 'primary',
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <style>{rotateCSS}</style>
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="relative p-2" style={{ width: size, height: size }}>
          {/* Background circle */}
          <div
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              borderWidth: width,
              borderColor: color,
              opacity: 0.1,
            }}
          />
          {/* Spinning element */}
          <div
            className="RotateElement absolute rounded-full"
            style={{
              width: size,
              height: size,
              borderWidth: width,
              borderTopColor: color,
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: 'transparent',
            }}
          />
        </div>
      </div>
    </div>
  );
}
