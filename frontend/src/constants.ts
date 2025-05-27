// Import shared constants
import { ALLOWED_CHARS } from '../../shared/constants';

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

// Import shared constants
import { COLOR_MAP, SEPARATOR_COLORS } from '../../shared/constants';
