import { forwardRef, type ElementRef, type ComponentPropsWithoutRef } from 'react';
import { Root, List, Trigger, Content } from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const Tabs = Root;

const TabsList = forwardRef<ElementRef<typeof List>, ComponentPropsWithoutRef<typeof List>>(({ className, ...props }, ref) => (
  <List
    ref={ref}
    className={cn('inline-flex h-10 justify-start border-b border-border w-full', className)}
    {...props}
  />
));
TabsList.displayName = List.displayName;

const TabsTrigger = forwardRef<ElementRef<typeof Trigger>, ComponentPropsWithoutRef<typeof Trigger>>(({ className, ...props }, ref) => (
  <Trigger
    ref={ref}
    className={cn(
      'relative inline-flex h-full items-center justify-center whitespace-nowrap px-0 text-lg font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
      'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary',
      'first:mr-6 mr-6',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = Trigger.displayName;

const TabsContent = forwardRef<ElementRef<typeof Content>, ComponentPropsWithoutRef<typeof Content>>(({ className, ...props }, ref) => (
  <Content
    ref={ref}
    className={cn(
      'mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
