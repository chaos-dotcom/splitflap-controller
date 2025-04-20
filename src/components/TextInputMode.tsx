import React, { useState } from 'react';
import { DISPLAY_LENGTH, ALLOWED_CHARS } from '../constants'; // Import constants
import './TextInputMode.css'; // We'll create this CSS file next

interface TextInputModeProps {
  onSendText: (text: string) => void;
  maxLength: number;
  disabled: boolean;
}

const TextInputMode: React.FC<TextInputModeProps> = ({ onSendText, maxLength, disabled }) => {
  const [inputText, setInputText] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = event.target.value.toUpperCase(); // Convert to uppercase immediately
    setValidationError(null); // Clear error on change

    // Basic validation (can be enhanced)
    // Check if all characters are allowed (optional, can be strict)
    // const invalidChars = value.split('').filter(char => !ALLOWED_CHARS.includes(char));
    // if (invalidChars.length > 0) {
    //   setValidationError(`Invalid characters: ${invalidChars.join(', ')}`);
    //   // Optionally prevent setting state or trim invalid chars
    // }

    // Enforce max length
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
      setValidationError(`Maximum length is ${maxLength} characters.`);
    }

    setInputText(value);
  };

  const handleSend = () => {
    // Optional: Add final validation before sending if needed
    if (inputText.trim() === '') {
        setValidationError('Input cannot be empty.');
        return;
    }
    // Clear error before sending
    setValidationError(null);
    onSendText(inputText);
    // Optionally clear input after sending:
    // setInputText('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !disabled) {
      handleSend();
    }
  };

  return (
    <div className="text-input-mode">
      <h4>Enter Text to Display:</h4>
      <div className="input-group">
        <input
          type="text"
          value={inputText}
          onChange={handleChange}
          onKeyDown={handleKeyDown} // Allow sending with Enter key
          maxLength={maxLength} // HTML5 max length attribute
          disabled={disabled}
          placeholder={`Enter up to ${maxLength} characters`}
          aria-label="Text to display"
        />
        <span className="char-count">
          {inputText.length}/{maxLength}
        </span>
        <button onClick={handleSend} disabled={disabled || !!validationError}>
          Send
        </button>
      </div>
      {validationError && <p className="error-message">{validationError}</p>}
       {/* Optional: Display allowed characters */}
       {/* <details>
         <summary>Allowed Characters</summary>
         <p className="allowed-chars">{ALLOWED_CHARS.join(' ')}</p>
       </details> */}
    </div>
  );
};

export default TextInputMode;
