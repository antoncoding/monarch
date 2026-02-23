import type { ReactNode } from 'react';

export type UiLabCategory = 'ui-primitives' | 'filters' | 'identity' | 'data-display' | 'controls' | 'modals';

export type UiLabCanvasBackground = 'background' | 'surface' | 'hovered';

export type UiLabCanvasState = {
  pad: number;
  maxW: number;
  bg: UiLabCanvasBackground;
};

export type UiLabEntry = {
  id: string;
  title: string;
  category: UiLabCategory;
  description: string;
  render: () => ReactNode;
  defaultCanvas?: Partial<UiLabCanvasState>;
};
