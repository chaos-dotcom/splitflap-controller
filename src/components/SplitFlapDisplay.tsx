import React from 'react';
// We will create SplitFlapChar next
// import SplitFlapChar from './SplitFlapChar';
import './SplitFlapDisplay.css'; // We'll create this CSS file later

interface SplitFlapDisplayProps {
  text: string;
  numChars: number;
}

const SplitFlapDisplay: React.FC<SplitFlapDisplayProps> = ({ text, numChars }) => {
  // Pad or truncate the text to match numChars
  const displayText = text.padEnd(numChars, ' ').slice(0, numChars);

  return (
    <div className="split-flap-display">
      {displayText.split('').map((char, index) => (
        // Replace div with SplitFlapChar once it's created
        <div key={index} className="split-flap-char-placeholder">
          {char}
        </div>
        // <SplitFlapChar key={index} targetChar={char} />
      ))}
    </div>
  );
};

export default SplitFlapDisplay;
