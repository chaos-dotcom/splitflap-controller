import React from 'react';
import React from 'react';
import './SplitFlapChar.css';
import { COLOR_MAP } from '../constants';

interface SplitFlapCharProps {
  char: string;
  isCaret?: boolean; // Optional prop to indicate cursor position
}

const SplitFlapChar: React.FC<SplitFlapCharProps> = ({ char, isCaret = false }) => {
  // Basic validation/fallback
  const displayChar = char && char.length === 1 ? char : ' ';

  // Check if the character is a color code
  const isColorCode = displayChar in COLOR_MAP;
  const charStyle: React.CSSProperties = {};

  if (isColorCode) {
    // Style the background for color codes
    charStyle.backgroundColor = COLOR_MAP[displayChar];
    charStyle.color = 'transparent'; // Hide the letter itself
  }

  return (
    <div
      className={`split-flap-char ${isCaret ? 'caret' : ''}`} // Add caret class if active
      style={charStyle}
      // Add aria-hidden if it's just a color block? Or maybe not needed.
    >
      {/* Only display the character text if it's NOT a color code */}
      {!isColorCode && (
        <span className="char-text" aria-hidden={isColorCode}> {/* Hide text visually and from SR if color */}
            {displayChar.toUpperCase()}
        </span>
      )}
    </div>
  );
};

export default SplitFlapChar;
