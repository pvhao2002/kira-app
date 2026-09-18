import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useContext, useEffect, useState} from 'react';

const baseColors = {
  bg: '#0a0e1a', surface: '#0f1524', elevated: '#1a2438',
  primary: '#7dd3fc', lavender: '#c8a0f0', text: '#e0e8f0', muted: '#a0b4c4',
  border: 'rgba(125,211,252,0.12)', success: '#69dfb1', warning: '#f1ca7b',
  error: '#ff8585', ink: '#001f2e',
};
export const colors = {...baseColors};
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold'
};

export type ThemeName = 'ice' | 'violet' | 'emerald' | 'amber';
export type ThemeColors = typeof colors;
const palettes: Record<ThemeName, ThemeColors> = {
  ice: {...baseColors},
  violet: {...baseColors, primary: '#c4b5fd', lavender: '#f0abfc', ink: '#19112d', border: 'rgba(196,181,253,0.16)'},
  emerald: {...baseColors, primary: '#6ee7b7', lavender: '#a7f3d0', ink: '#06251d', border: 'rgba(110,231,183,0.16)'},
  amber: {...baseColors, primary: '#fcd34d', lavender: '#f9a8d4', ink: '#2d1d05', border: 'rgba(252,211,77,0.16)'},
};
const KEY = 'kira-life-theme';
type ThemeContextValue = { themeName: ThemeName; colors: ThemeColors; setTheme: (name: ThemeName) => void };
const Context = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({children}: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('ice');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(value => {
      if (value && value in palettes) {
        const name = value as ThemeName;
        Object.assign(colors, palettes[name]);
        setThemeName(name);
      }
    }).catch(() => {
    });
  }, []);

  function setTheme(name: ThemeName) {
    Object.assign(colors, palettes[name]);
    setThemeName(name);
    AsyncStorage.setItem(KEY, name).catch(() => {
    });
  }

  return React.createElement(Context.Provider, {value: {themeName, colors: palettes[themeName], setTheme}}, children);
}

export function useTheme() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing ThemeProvider');
  return value;
}
