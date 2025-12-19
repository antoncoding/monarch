'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { BarLoader } from 'react-spinners';
import loadingImg from '../imgs/aragon/loading.png';

type LoadingScreenProps = {
  message?: string;
  className?: string;
};

const loadingPhrases = ['Loading...', 'Fetching data...', 'Almost there...', 'Preparing your view...', 'Connecting to Morpho...'];

function TypingAnimation({ phrases, singleMode = false }: { phrases: string[]; singleMode?: boolean }) {
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const prevPhraseRef = useRef<string>(phrases[0]);

  // Reset animation when phrase changes in single mode
  useEffect(() => {
    if (singleMode && phrases[0] !== prevPhraseRef.current) {
      prevPhraseRef.current = phrases[0];
      setDisplayText('');
      setIsDeleting(false);
      setIsPaused(false);
      setPhraseIndex(0);
    }
  }, [phrases, singleMode]);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (isPaused) {
      // In single mode, stay paused forever after typing completes
      if (singleMode) {
        return;
      }
      const pauseTimeout = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 1500);
      return () => clearTimeout(pauseTimeout);
    }

    const currentPhrase = phrases[phraseIndex];
    const targetText = currentPhrase;

    const getNextPhraseIndex = (current: number) => (current + 1) % phrases.length;

    const typingSpeed = 40;
    const deletingSpeed = 25;

    const timeout = setTimeout(
      () => {
        if (isDeleting) {
          if (displayText.length > 0) {
            setDisplayText(displayText.slice(0, -1));
          } else {
            setIsDeleting(false);
            setPhraseIndex(getNextPhraseIndex(phraseIndex));
          }
        } else if (displayText.length < targetText.length) {
          setDisplayText(targetText.slice(0, displayText.length + 1));
        } else {
          setIsPaused(true);
        }
      },
      isDeleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [displayText, phraseIndex, isDeleting, isPaused, phrases, singleMode]);

  return (
    <span className="inline-flex items-center">
      <span>{displayText}</span>
      <span
        className="ml-0.5 inline-block"
        style={{ opacity: showCursor ? 1 : 0, transition: 'opacity 0.1s' }}
      >
        |
      </span>
    </span>
  );
}

export default function LoadingScreen({ message, className }: LoadingScreenProps) {
  const phrases = message ? [message] : loadingPhrases;
  const singleMode = !!message;

  return (
    <div
      className={`bg-surface my-4 flex min-h-48 flex-col items-center justify-center space-y-4 rounded py-8 shadow-sm font-zen ${
        className ?? ''
      }`}
    >
      <Image
        src={loadingImg}
        alt="Logo"
        width={200}
        height={200}
        className="py-4"
      />
      <BarLoader
        width={100}
        color="#f45f2d"
        height={2}
        className="pb-1"
      />
      <p className="pt-4 text-center text-secondary">
        <TypingAnimation
          phrases={phrases}
          singleMode={singleMode}
        />
      </p>
    </div>
  );
}
