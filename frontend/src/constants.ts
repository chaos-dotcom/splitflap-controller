export const ALLOWED_CHARS: ReadonlyArray<string> = [
  ' ', 'r', 'o', 'y', 'g', 'b', 'v', 'p', 't', 'w', 'A', 'B', 'C',
  'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2',
  '3', '4', '5', '6', '7', '8', '9', '.', '=', '?','$','&', '!',
];

// Use a dynamic value that can be updated from the backend
let _splitflapDisplayLength = parseInt(import.meta.env.VITE_SPLITFLAP_DISPLAY_LENGTH || '14', 10);

export const setSplitflapDisplayLength = (length: number) => {
  _splitflapDisplayLength = length;
  console.log(`[Config] Updated display length: ${_splitflapDisplayLength} characters`);
};

export const getSplitflapDisplayLength = () => _splitflapDisplayLength;

// Export a function that returns the current display length
// This works better with TypeScript and ES modules
export function SPLITFLAP_DISPLAY_LENGTH() {
  return _splitflapDisplayLength;
}

console.log(`[Config] Using initial display length: ${_splitflapDisplayLength} characters`);

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
export const SEPARATOR_COLORS: ReadonlyArray<string> = ['r', 'o', 'y', 'g', 'b', 'v', 'p', 't', 'w'];
