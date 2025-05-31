'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

/**
 * ThemeProvider component
 * 
 * Wraps the next-themes ThemeProvider to provide theme context to the application.
 * Supports light, dark, and system themes with class-based application.
 * 
 * @param props ThemeProviderProps from next-themes
 * @returns ThemeProvider component
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      {children}
    </NextThemesProvider>
  );
}

/**
 * Custom hook for accessing and manipulating the current theme
 * 
 * @returns Object with theme state and functions to change the theme
 */
export const useTheme = () => {
  const { theme, setTheme, systemTheme, themes } = React.use(NextThemesProvider);
  
  // Check if component is mounted to avoid hydration mismatch
  const [mounted, setMounted] = React.useState(false);
  
  // Set mounted to true on client-side
  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  // Determine the current theme accounting for system preference
  const currentTheme = React.useMemo(() => {
    if (!mounted) return undefined;
    return theme === 'system' ? systemTheme : theme;
  }, [mounted, theme, systemTheme]);
  
  // Toggle between light and dark themes
  const toggleTheme = React.useCallback(() => {
    if (currentTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }, [currentTheme, setTheme]);
  
  return {
    theme,
    setTheme,
    currentTheme,
    toggleTheme,
    systemTheme,
    themes,
    mounted,
  };
};
