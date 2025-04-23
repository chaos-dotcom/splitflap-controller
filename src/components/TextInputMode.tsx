import React, { useState, KeyboardEvent } from 'react';
import './TextInputMode.css'; // We will update this CSS next
import { SPLITFLAP_DISPLAY_LENGTH } from '../constants'; // Removed ALLOWED_CHARS, corrected constant name

interface TextInputModeProps {
  onSendText: (text: string) => void;
  maxLength: number;
  disabled: boolean;
}

const TextInputMode: React.FC<TextInputModeProps> = ({ onSendText, maxLength, disabled }) => {
  const [inputText, setInputText] = useState<string>('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = event.target.value;

    // Optional: Convert to uppercase immediately for visual feedback
    value = value.toUpperCase();

    // Optional: Filter out characters not allowed by the physical display
    // value = value.split('').filter(char => ALLOWED_CHARS.includes(char) || ALLOWED_CHARS.includes(char.toLowerCase())).join('');
    // Note: The above filter might be too restrictive if users want to type lowercase colors directly.
    // A simpler approach is just length limiting here and letting the parent `sendMessage` handle final formatting/validation.

    // Limit length
    if (value.length <= maxLength) {
      setInputText(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !disabled) {
        // Send current input (padded) if Enter is pressed, even if empty
        const textToSend = inputText.padEnd(maxLength);
        onSendText(textToSend);
        setInputText(''); // Clear input after sending
    }
    // Removed specific check for empty input sending blank, as padEnd handles it.
  };

  return (
    <div className="text-input-mode">
      <input
        type="text"
        value={inputText}
        onChange={handleChange}
        onKeyDown={handleKeyDown} // Use onKeyDown for Enter key
        maxLength={maxLength} // HTML5 length limit
        disabled={disabled}
        placeholder={disabled ? 'Connect MQTT to enable input' : `Type up to ${maxLength} chars & press Enter`}
        className="text-input-field" // Use a specific class for the input
        // Use monospace font similar to the display
        style={{ fontFamily: 'Roboto Mono, monospace' }}
      />
       {/* Optional: Display character count */}
       <span className="char-count">
         {inputText.length} / {maxLength}
       </span>
       {/* Removed the Send button and error message display */}
    </div>
  );
};

export default TextInputMode;
