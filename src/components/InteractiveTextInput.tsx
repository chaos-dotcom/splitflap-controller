import React, { useState, useEffect, KeyboardEvent, useRef, MouseEvent } from 'react'; // Added MouseEvent
import SplitFlapChar from './SplitFlapChar';
import { ALLOWED_CHARS } from '../constants'; // Removed DISPLAY_LENGTH as maxLength is prop
import './InteractiveTextInput.css';

interface InteractiveTextInputProps {
    value: string;
    onChange: (newValue: string) => void;
    onEnter: () => void; // Callback when Enter is pressed
    maxLength: number;
    placeholder?: string; // Optional placeholder text
    disabled?: boolean;
    autoFocus?: boolean; // Add autoFocus prop
    onBlur?: () => void; // Add onBlur prop
}

const InteractiveTextInput: React.FC<InteractiveTextInputProps> = ({
    value,
    onChange,
    onEnter,
    maxLength,
    placeholder = '',
    disabled = false,
    autoFocus = false, // Default autoFocus to false
    onBlur, // Destructure onBlur prop
}) => {
    const [caretPosition, setCaretPosition] = useState<number>(0);
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset caret if value is cleared externally
    useEffect(() => {
        if (value === '') {
            setCaretPosition(0);
        }
        // Ensure caret doesn't exceed new value length if value changes externally
        setCaretPosition(pos => Math.min(pos, value.length));

    }, [value]);

    // Effect for autoFocus
    useEffect(() => {
        if (autoFocus && containerRef.current) {
            containerRef.current.focus();
        }
    }, [autoFocus]); // Run only when autoFocus prop changes (or on mount if initially true)

    // Ensure value doesn't exceed maxLength (might happen if prop changes)
    // Pad with spaces to ensure full display length for visual consistency
    const displayValue = value.padEnd(maxLength).substring(0, maxLength);
    const chars = displayValue.split('');

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;

        const key = event.key;
        // Use the current actual value for manipulation, not the padded displayValue
        let currentChars = value.split('');
        let newCaretPos = caretPosition;
        let handled = false;

        if (key === 'Enter') {
            onEnter(); // Trigger the callback passed from parent
            handled = true;
        } else if (key === 'Backspace') {
            if (newCaretPos > 0) {
                // Remove character before caret
                currentChars.splice(newCaretPos - 1, 1);
                newCaretPos--;
                handled = true;
            }
        } else if (key === 'Delete') {
            if (newCaretPos < currentChars.length) { // Only delete if caret is before a character
                // Remove character at caret
                 currentChars.splice(newCaretPos, 1);
                // Caret position stays the same relative to remaining chars
                handled = true;
            }
        } else if (key === 'ArrowLeft') {
            if (newCaretPos > 0) {
                newCaretPos--;
                handled = true;
            }
        } else if (key === 'ArrowRight') {
             // Allow moving caret up to the position *after* the last actual character
            if (newCaretPos < value.length) { // Use actual value length
                newCaretPos++;
                handled = true;
            }
        } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            let charToInsert: string | null = null;
            if (ALLOWED_CHARS.includes(key)) {
                charToInsert = key;
            } else if (ALLOWED_CHARS.includes(key.toUpperCase())) {
                charToInsert = key.toUpperCase();
            }

            // Insert or replace character if allowed and within maxLength
            if (charToInsert !== null && newCaretPos < maxLength) {
                 // Insert character at caret position
                 currentChars.splice(newCaretPos, 0, charToInsert);
                 // Trim if exceeding maxLength due to insertion
                 if (currentChars.length > maxLength) {
                     currentChars = currentChars.slice(0, maxLength);
                 }
                 // Move caret forward only if not at the very end
                 if (newCaretPos < maxLength) {
                    newCaretPos++;
                 }
                handled = true;
            }
        }

        if (handled) {
            event.preventDefault();
            onChange(currentChars.join('')); // Update parent state with the new actual value
            setCaretPosition(newCaretPos);
        }
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>) => { // Use imported MouseEvent
        if (disabled) return;
        const displayRect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - displayRect.left;
        // Estimate character width based on container width and maxLength
        const approxCharWidth = displayRect.width / maxLength;
        // Calculate clicked index, clamping between 0 and actual value length + 1 (to allow placing caret at end)
        const clickedIndex = Math.floor(clickX / approxCharWidth);
        // Allow setting caret position up to the length of the current value
        setCaretPosition(Math.max(0, Math.min(value.length, clickedIndex)));
        containerRef.current?.focus(); // Ensure focus
    };

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => {
        setIsFocused(false);
        if (onBlur) { // Call the parent's onBlur handler if provided
            onBlur();
        }
    };

    // Show placeholder only if value is empty and component is not focused
    const showPlaceholder = value === '' && placeholder && !isFocused;

    return (
        <div
            ref={containerRef}
            className={`interactive-text-input ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onFocus={handleFocus}
            onBlur={handleBlur}
            role="textbox"
            aria-label={placeholder || "Interactive text input"} // Use placeholder as label if available
            aria-disabled={disabled}
        >
            {showPlaceholder && <div className="placeholder-text">{placeholder}</div>}
            {/* Render based on displayValue which is always maxLength */}
            {!showPlaceholder && chars.map((char, index) => (
                <SplitFlapChar
                    key={index}
                    char={char}
                    // Caret is shown if focused and caretPosition matches index
                    isCaret={isFocused && index === caretPosition}
                />
            ))}
        </div>
    );
};

export default InteractiveTextInput;
