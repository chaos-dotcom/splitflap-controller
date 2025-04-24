import React, { KeyboardEvent, MouseEvent, useRef } from 'react'; // Import event types and useRef
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
  // Add refs for the display and hidden input
  const displayRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  // Ensure text is exactly SPLITFLAP_DISPLAY_LENGTH characters long, padding with spaces if needed
  // This should ideally be handled by the parent state management (draftText)
  const displayText = text.padEnd(SPLITFLAP_DISPLAY_LENGTH()).substring(0, SPLITFLAP_DISPLAY_LENGTH());
  const chars = displayText.split('');

  // Handle click on the display - focus the hidden input to trigger mobile keyboard
  const handleDisplayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isInteractive && isConnected) {
      // Focus the hidden input to show keyboard on mobile
      if (hiddenInputRef.current) {
        hiddenInputRef.current.focus({
          preventScroll: true // Prevent page from scrolling when focusing
        });
      }
      
      // Call the original onClick handler if provided
      if (onClick) {
        onClick(event);
      }
    }
  };

  // Handle input from the hidden input field (for mobile keyboards)
  const handleHiddenInput = (e: React.FormEvent<HTMLInputElement>) => {
    if (isInteractive && isConnected && onKeyDown) {
      const inputValue = e.currentTarget.value;
      
      // Process each character as a separate keydown event
      for (const char of inputValue) {
        const simulatedEvent = {
          key: char,
          preventDefault: () => {},
          ctrlKey: false,
          metaKey: false,
          altKey: false
        } as unknown as KeyboardEvent<HTMLDivElement>;
        
        onKeyDown(simulatedEvent);
      }
      
      // Clear the input for next use
      e.currentTarget.value = '';
    }
  };

  return (
    <div
      ref={displayRef}
      className={`split-flap-display ${size} ${isInteractive && isConnected ? 'interactive' : ''}`} // Add size class
      // Only make focusable and attach handlers if interactive, connected, AND handlers are provided
      tabIndex={isInteractive && isConnected ? 0 : -1}
      onKeyDown={isInteractive && isConnected && onKeyDown ? onKeyDown : undefined}
      onClick={handleDisplayClick}
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
       
      {/* Hidden input element to capture mobile keyboard input */}
      {isInteractive && isConnected && (
        <input
          ref={hiddenInputRef}
          type="text"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="characters"
          style={{
            position: 'absolute',
            opacity: 0,
            height: '100%', // Make it cover the entire display area
            width: '100%',  // Make it cover the entire display area
            left: 0,
            top: 0,
            pointerEvents: 'none', // This allows clicks to pass through to the display
            zIndex: -1
          }}
          onInput={handleHiddenInput}
          onKeyDown={(e) => {
            // Handle special keys like backspace, delete, arrows
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key) && onKeyDown) {
              const simulatedEvent = {
                ...e,
                preventDefault: () => {
                  e.preventDefault();
                }
              } as unknown as KeyboardEvent<HTMLDivElement>;
              
              onKeyDown(simulatedEvent);
            }
          }}
        />
      )}
    </div>
  );
};

export default SplitFlapDisplay;
