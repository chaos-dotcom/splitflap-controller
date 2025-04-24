import React, { KeyboardEvent, MouseEvent, useRef, useEffect } from 'react'; // Import event types, useRef, and useEffect
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
        // Force blur and then focus to ensure keyboard appears on iOS
        hiddenInputRef.current.blur();
        
        // Clear any existing value
        hiddenInputRef.current.value = '';
        
        // Small timeout to ensure the blur completes
        setTimeout(() => {
          if (hiddenInputRef.current) {
            // Try multiple focus techniques
            hiddenInputRef.current.focus();
            hiddenInputRef.current.click();
            
            // For iOS, sometimes we need to set readonly first, then remove it
            hiddenInputRef.current.setAttribute('readonly', 'readonly');
            setTimeout(() => {
              if (hiddenInputRef.current) {
                hiddenInputRef.current.removeAttribute('readonly');
              }
            }, 10);
          }
        }, 10);
      }
      
      // Call the original onClick handler if provided
      if (onClick) {
        onClick(event);
      }
    }
  };

  // Add useEffect to handle mode changes and re-focus
  useEffect(() => {
    // When isInteractive changes to true (switching to text mode), 
    // we need to reset the input state
    if (isInteractive && isConnected && hiddenInputRef.current) {
      // Small delay to ensure the DOM has updated
      setTimeout(() => {
        if (hiddenInputRef.current) {
          // Reset the input value
          hiddenInputRef.current.value = '';
          // Force blur first
          hiddenInputRef.current.blur();
          // Then focus after a small delay
          setTimeout(() => {
            if (hiddenInputRef.current) {
              hiddenInputRef.current.focus();
            }
          }, 50);
        }
      }, 100);
    }
  }, [isInteractive, isConnected]);

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
          // Make it slightly more visible for debugging if needed
          style={{
            position: 'absolute',
            opacity: 0.01, // Very slight opacity instead of 0
            height: '100%',
            width: '100%',
            left: 0,
            top: 0,
            zIndex: 2, // Increase z-index to ensure it's on top
            background: 'transparent',
            fontSize: '16px', // iOS won't zoom in if font size is at least 16px
            border: 'none',
            outline: 'none'
          }}
          onInput={handleHiddenInput}
          onFocus={() => {
            console.log('Hidden input focused');
          }}
          onBlur={() => {
            console.log('Hidden input blurred');
          }}
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
          // Add click handler directly to the input
          onClick={(e) => {
            // Stop propagation to prevent double-handling with the div's click
            e.stopPropagation();
          }}
        />
      )}
    </div>
  );
};

export default SplitFlapDisplay;
