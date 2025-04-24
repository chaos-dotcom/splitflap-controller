import React, { KeyboardEvent, MouseEvent } from 'react'; // Import event types
import SplitFlapChar from './SplitFlapChar';
import { SPLITFLAP_DISPLAY_LENGTH } from '../constants'; // Use renamed constant
import './SplitFlapDisplay.css';

interface SplitFlapDisplayProps {
  text: string; // This will now be the draftText from App
  caretPosition: number; // Only relevant when interactive
  isConnected: boolean; // To visually indicate active/inactive state and enable focus
  isInteractive: boolean; // Determines if the display accepts input
  size?: 'large' | 'small'; // Add size prop
  // Make onKeyDown and onClick optional, only needed for interactive mode
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void; // Pass the event for position calculation
}


const SplitFlapDisplay: React.FC<SplitFlapDisplayProps> = ({
  text,
  caretPosition,
  isConnected,
  isInteractive,
  size = 'large', // Default to large
  onKeyDown, // Can be undefined now
  onClick,   // Can be undefined now
}) => {
  // Ensure text is exactly SPLITFLAP_DISPLAY_LENGTH characters long, padding with spaces if needed
  // This should ideally be handled by the parent state management (draftText)
  const displayText = text.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH);
  const chars = displayText.split('');

  return (
    <div
      className={`split-flap-display ${size} ${isInteractive && isConnected ? 'interactive' : ''}`} // Add size class
      // Only make focusable and attach handlers if interactive, connected, AND handlers are provided
      tabIndex={isInteractive && isConnected && onKeyDown ? 0 : -1}
      onKeyDown={isInteractive && isConnected && onKeyDown ? onKeyDown : undefined}
      onClick={isInteractive && isConnected && onClick ? onClick : undefined}
      // Role and aria attributes might only make sense when truly interactive
      role={isInteractive ? "textbox" : undefined}
      aria-label={isInteractive ? "Split flap display input" : "Split flap display"}
      aria-readonly={!isInteractive || !isConnected}
      // Consider aria-activedescendant for better screen reader support if needed
    >
      {chars.map((char, index) => (
        <SplitFlapChar
          key={index}
          char={char}
          size={size} // Pass size down
          // Show caret only if interactive, connected, and caret position matches
          isCaret={isInteractive && isConnected && index === caretPosition}
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
