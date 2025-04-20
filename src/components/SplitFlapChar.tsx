import React from 'react';
import './SplitFlapChar.css'; // We'll create this CSS file next

interface SplitFlapCharProps {
  char: string;
}

const SplitFlapChar: React.FC<SplitFlapCharProps> = ({ char }) => {
  // Basic structure for now, will add split-flap animation later
  return (
    <div className="split-flap-char">
      <div className="char-top">{char}</div>
      <div className="char-bottom">{char}</div>
      {/* Placeholder for the flipping animation elements */}
    </div>
  );
};

export default SplitFlapChar;
