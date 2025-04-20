import React from 'react';
import './SplitFlapChar.css'; // Uses the CSS file
import { COLOR_MAP } from '../constants'; // Import constants

interface SplitFlapCharProps {
  char: string;
}

const SplitFlapChar: React.FC<SplitFlapCharProps> = ({ char }) => {
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
    // Simplified structure: just one div for the character background/display
    <div className="split-flap-char" style={charStyle}>
      {/* Only display the character text if it's NOT a color code */}
      {!isColorCode && (
        <span className="char-text">{displayChar.toUpperCase()}</span>
      )}
    </div>
  );
};

export default SplitFlapChar;
