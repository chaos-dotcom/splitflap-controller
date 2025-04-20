import React, { KeyboardEvent, MouseEvent } from 'react'; // Import event types
import SplitFlapChar from './SplitFlapChar';
import { DISPLAY_LENGTH } from '../constants';
import './SplitFlapDisplay.css';

interface SplitFlapDisplayProps {
  text: string; // This will now be the draftText from App
  caretPosition: number;
  isConnected: boolean; // To visually indicate active/inactive state and enable focus
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onClick: (event: MouseEvent<HTMLDivElement>) => void; // Pass the event for position calculation
}


const SplitFlapDisplay: React.FC<SplitFlapDisplayProps> = ({
  text,
  caretPosition,
  isConnected,
  onKeyDown,
  onClick,
}) => {
  // Ensure text is exactly DISPLAY_LENGTH characters long, padding with spaces if needed
  // This should ideally be handled by the parent state management (draftText)
  const displayText = text.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
  const chars = displayText.split('');

  return (
    <div
      className={`split-flap-display ${isConnected ? 'interactive' : ''}`}
      tabIndex={isConnected ? 0 : -1} // Make it focusable only when connected
      onKeyDown={isConnected ? onKeyDown : undefined} // Attach handler only when connected
      onClick={isConnected ? onClick : undefined} // Attach handler only when connected
      role="textbox" // Accessibility hint
      aria-label="Split flap display input"
      aria-readonly={!isConnected}
      // Consider aria-activedescendant for better screen reader support if needed
    >
      {chars.map((char, index) => (
        <SplitFlapChar
          key={index}
          char={char}
          // Highlight the character *at* the caret position
          isCaret={index === caretPosition && isConnected}
        />
      ))}
      {/* Optional: Render a visual caret element explicitly if needed,
          especially if caret can be positioned *after* the last char */}
       {/* {isConnected && caretPosition === DISPLAY_LENGTH && (
         <span className="explicit-caret" style={{ left: `${caretPosition * CHAR_WIDTH}px` }}></span>
       )} */}
    </div>
  );
};

export default SplitFlapDisplay;
