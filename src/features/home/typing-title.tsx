'use client';

import { useState, useEffect } from 'react';

type Phrase = {
  text: string;
  highlightWords: { word: string; color: string }[];
};

const phrases: Phrase[] = [
  {
    text: 'Customized lending on Morpho Blue',
    highlightWords: [{ word: 'Morpho Blue', color: 'rgb(59, 130, 246)' }],
  },
  {
    text: 'Customized lending with full control',
    highlightWords: [],
  },
  {
    text: 'Customized lending with automation',
    highlightWords: [{ word: 'automation', color: 'rgb(251, 146, 60)' }],
  },
  {
    text: 'Manage your own risk with no fees',
    highlightWords: [],
  },
  {
    text: 'Manage your own yield with automation',
    highlightWords: [{ word: 'automation', color: 'rgb(251, 146, 60)' }],
  },
  {
    text: 'Deploy your own vault with zero fees',
    highlightWords: [{ word: 'zero fees', color: 'rgb(251, 146, 60)' }],
  },
  {
    text: 'Be your own risk curator',
    highlightWords: [],
  },
];

export function CustomTypingAnimation() {
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    // Cursor blink
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (isPaused) {
      const pauseTimeout = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000);
      return () => clearTimeout(pauseTimeout);
    }

    const currentPhrase = phrases[phraseIndex];
    const targetText = currentPhrase.text;

    // Calculate deletion strategy
    const getNextPhraseIndex = (current: number) => (current + 1) % phrases.length;
    const nextPhrase = phrases[getNextPhraseIndex(phraseIndex)];

    // Find common prefix between current and next phrase
    let commonPrefixLength = 0;
    for (let i = 0; i < Math.min(targetText.length, nextPhrase.text.length); i++) {
      if (targetText[i] === nextPhrase.text[i]) {
        commonPrefixLength = i + 1;
      } else {
        break;
      }
    }

    // Sometimes delete everything, sometimes keep common prefix
    const shouldDeleteAll = Math.random() > 0.5;
    const deleteToLength = shouldDeleteAll ? 0 : commonPrefixLength;

    const typingSpeed = 30;
    const deletingSpeed = 20;

    const timeout = setTimeout(
      () => {
        if (isDeleting) {
          // Deleting
          if (displayText.length > deleteToLength) {
            setDisplayText(displayText.slice(0, -1));
          } else {
            // Finished deleting, move to next phrase
            setIsDeleting(false);
            setPhraseIndex(getNextPhraseIndex(phraseIndex));
          }
        } else if (displayText.length < targetText.length) {
          // Typing
          setDisplayText(targetText.slice(0, displayText.length + 1));
        } else {
          // Finished typing, pause
          setIsPaused(true);
        }
      },
      isDeleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [displayText, phraseIndex, isDeleting, isPaused]);

  // Render text with colored highlights
  const renderColoredText = () => {
    const currentPhrase = phrases[phraseIndex];
    let remainingText = displayText;
    const elements: React.ReactNode[] = [];
    let keyIndex = 0;

    currentPhrase.highlightWords.forEach(({ word, color }) => {
      const index = remainingText.indexOf(word);
      if (index >= 0) {
        // Add text before the highlight
        if (index > 0) {
          elements.push(<span key={`text-${keyIndex++}`}>{remainingText.slice(0, index)}</span>);
        }
        // Add highlighted text (only if fully typed)
        const highlightedPortion = remainingText.slice(index, index + word.length);
        elements.push(
          <span
            key={`highlight-${keyIndex++}`}
            style={{ color }}
          >
            {highlightedPortion}
          </span>,
        );
        remainingText = remainingText.slice(index + word.length);
      }
    });

    // Add remaining text
    if (remainingText.length > 0) {
      elements.push(<span key={`text-${keyIndex++}`}>{remainingText}</span>);
    }

    return elements.length > 0 ? elements : displayText;
  };

  return (
    <div className="text-center font-zen text-base leading-relaxed text-secondary sm:text-xl md:text-left md:text-2xl">
      {renderColoredText()}
      <span
        className="ml-1 inline-block"
        style={{ opacity: showCursor ? 1 : 0, transition: 'opacity 0.1s' }}
      >
        |
      </span>
    </div>
  );
}
