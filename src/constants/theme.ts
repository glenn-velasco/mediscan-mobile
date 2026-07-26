/**
 * Auto-generated from src/global.css — Do not hand-edit these hex values.
 * After changing src/global.css, run: npm run sync-theme-colors
 * and paste the output below.
 */
export const Colors = {
  light: {
    background: '#f5f3f0', // #f5f3f0
    foreground: '#1a1d21', // #1a1d21
    card: '#ffffff', // #ffffff
    cardForeground: '#1a1d21', // #1a1d21
    popover: '#ffffff', // #ffffff
    popoverForeground: '#1a1d21', // #1a1d21
    primary: '#0d7377', // #0d7377
    primaryForeground: '#ffffff', // #ffffff
    secondary: '#eceff2', // #eceff2
    secondaryForeground: '#2d3136', // #2d3136
    muted: '#e8ede9', // #e8ede9
    mutedForeground: '#424952', // #424952
    accent: '#d4ebe6', // #d4ebe6
    accentForeground: '#0a4f45', // #0a4f45
    destructive: '#e8725c', // #e8725c
    destructiveForeground: '#ffffff', // #ffffff
    border: '#d8ddd9', // #d8ddd9
    input: '#d8ddd9', // #d8ddd9
    ring: '#0d7377', // #0d7377
    chart1: '#0d7377', // #0d7377
    chart2: '#148f8a', // #148f8a
    chart3: '#2d8b4e', // #2d8b4e
    chart4: '#d4a03c', // #d4a03c
    chart5: '#e8725c', // #e8725c
    success: '#2d8b4e', // #2d8b4e
    successForeground: '#ffffff', // #ffffff
    warning: '#d4a03c', // #d4a03c
    warningForeground: '#3d2e00', // #3d2e00
    critical: '#e8725c', // #e8725c
    criticalForeground: '#ffffff', // #ffffff
  },
  dark: {
    background: '#0b0e11', // #0b0e11
    foreground: '#e8eaed', // #e8eaed
    card: '#141619', // #141619
    cardForeground: '#e8eaed', // #e8eaed
    popover: '#141619', // #141619
    popoverForeground: '#e8eaed', // #e8eaed
    primary: '#1ea89a', // #1ea89a
    primaryForeground: '#ffffff', // #ffffff
    secondary: '#1d2022', // #1d2022
    secondaryForeground: '#d4d8dd', // #d4d8dd
    muted: '#1a1e1b', // #1a1e1b
    mutedForeground: '#9ea4ad', // #9ea4ad
    accent: '#0a4f45', // #0a4f45
    accentForeground: '#b8e0d8', // #b8e0d8
    destructive: '#f08a76', // #f08a76
    destructiveForeground: '#ffffff', // #ffffff
    border: '#2a2e2b', // #2a2e2b
    input: '#2a2e2b', // #2a2e2b
    ring: '#1ea89a', // #1ea89a
    chart1: '#1ea89a', // #1ea89a
    chart2: '#148f8a', // #148f8a
    chart3: '#3a9e5e', // #3a9e5e
    chart4: '#e0b44e', // #e0b44e
    chart5: '#f08a76', // #f08a76
    success: '#3a9e5e', // #3a9e5e
    successForeground: '#ffffff', // #ffffff
    warning: '#e0b44e', // #e0b44e
    warningForeground: '#2d1f00', // #2d1f00
    critical: '#f08a76', // #f08a76
    criticalForeground: '#ffffff', // #ffffff
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
