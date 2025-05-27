// Define the character set used by the split-flap display
export const SPLIT_FLAP_CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-+=/()";

// Color codes for the frontend
export const COLOR_CODES = ['r', 'o', 'y', 'g', 'b', 'v', 'p', 't', 'w'];

// Combined character set for the frontend (includes both display chars and color codes)
export const ALLOWED_CHARS: ReadonlyArray<string> = [
  ' ', ...COLOR_CODES, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '=', '?', '$', '&', '!'
];

// Map lowercase color codes to actual colors for potential styling
export const COLOR_MAP: { [key: string]: string } = {
  'r': 'red',
  'o': 'orange',
  'y': 'yellow',
  'g': 'green',
  'b': 'blue',
  'v': 'violet', // or purple
  'p': 'pink',
  't': 'turquoise', // or teal/cyan
  'w': 'white',
};

// Sequence of colors to use as separators
export const SEPARATOR_COLORS: ReadonlyArray<string> = COLOR_CODES;
