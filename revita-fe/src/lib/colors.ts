// Revita Color Palette
export const colors = {
  // Primary color: #35b8cf
  primary: {
    hex: '#35b8cf',
    oklch: 'oklch(0.7 0.12 200)',
    rgb: 'rgb(53, 184, 207)',
  },
  
  // Secondary color: #11325b
  secondary: {
    hex: '#11325b',
    oklch: 'oklch(0.25 0.08 240)',
    rgb: 'rgb(17, 50, 91)',
  },
  
  // Variations for different use cases
  primaryLight: {
    hex: '#5cc7db',
    oklch: 'oklch(0.75 0.12 200)',
  },
  
  primaryDark: {
    hex: '#2a9bb5',
    oklch: 'oklch(0.65 0.12 200)',
  },
  
  secondaryLight: {
    hex: '#1a4a7a',
    oklch: 'oklch(0.35 0.08 240)',
  },
  
  secondaryDark: {
    hex: '#0d2442',
    oklch: 'oklch(0.2 0.08 240)',
  },
} as const;

export type ColorKey = keyof typeof colors;
