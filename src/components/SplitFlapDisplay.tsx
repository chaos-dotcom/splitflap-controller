import React from 'react';
import SplitFlapChar from './SplitFlapChar'; // Import the actual char component
import { DISPLAY_LENGTH } from '../constants'; // Import constants
import './SplitFlapDisplay.css'; // Import the CSS for this component

interface SplitFlapDisplayProps {
  text: string;
  // numChars prop is removed, using DISPLAY_LENGTH from constants instead
}

const SplitFlapDisplay: React.FC<SplitFlapDisplayProps> = ({ text }) => {
  // Ensure text is exactly DISPLAY_LENGTH characters long, padding with spaces
  const displayText = text.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
  const chars = displayText.split('');

  return (
    <div className="split-flap-display">
      {chars.map((char, index) => (
        // Use the actual SplitFlapChar component
        <SplitFlapChar key={index} char={char} />
      ))}
    </div>
  );
};

export default SplitFlapDisplay;
