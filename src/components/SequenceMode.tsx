import React, { useState, useEffect, useRef } from 'react';
// Import dnd-kit components
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MdDragIndicator as DragHandleIcon, MdDeleteForever as DeleteIcon, MdContentCopy as DuplicateIcon } from "react-icons/md"; // Import icons
import { Scene, SceneLine } from '../types';
import { SPLITFLAP_DISPLAY_LENGTH } from '../constants'; // Use renamed constant
import './SequenceMode.css';
import SplitFlapDisplay from './SplitFlapDisplay'; // Import the display component
import InteractiveTextInput from './InteractiveTextInput';

interface SequenceModeProps {
    isConnected: boolean; // Keep isConnected for disabling UI elements
    onPlay: (scene: Scene) => void; // Callback to request backend play
    onStop: () => void; // Callback to request backend stop
}

// --- Sortable Item Component ---
// We create a separate component for the draggable list item
// to properly use the useSortable hook.
interface SortableLineItemProps {
    line: SceneLine;
    isPlaying: boolean;
    editingLineId: string | null;
    handleLineClick: (id: string) => void;
    handleLineTextChange: (id: string, text: string) => void;
    handleLineEnter: () => void; // Renamed from handleFinishEditing for clarity here
    handleLineBlur: () => void;
    handleDurationChange: (id: string, duration: number) => void;
    handleDeleteLine: (id: string) => void;
    handleDuplicateLine: (id: string) => void;
}

const SortableLineItem: React.FC<SortableLineItemProps> = ({
    line, isPlaying, editingLineId, handleLineClick, handleLineTextChange,
    handleLineEnter, handleLineBlur, handleDurationChange, handleDeleteLine, handleDuplicateLine
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging, // Use this to style the item while dragging
    } = useSortable({ id: line.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1, // Example dragging style
        // Add other styles as needed, e.g., zIndex if elements overlap during drag
        zIndex: isDragging ? 100 : 'auto',
    };

    const finishEditing = () => {
        handleLineBlur();
    };

    const isEditing = editingLineId === line.id;
    const durationInputId = `duration-${line.id}`; // Unique ID for label association

    return (
        <li ref={setNodeRef} style={style} className={`sequence-line-item ${isEditing ? 'editing' : ''} ${isDragging ? 'dragging-style' : ''}`}>
            {/* Drag Handle - GDS Button */}
            <button
                {...attributes}
                {...listeners}
                className="drag-handle govuk-button govuk-button--secondary govuk-!-margin-right-1"
                aria-label="Drag to reorder line"
                disabled={isPlaying || isEditing} // Disable drag when editing this line too
                title="Drag to reorder"
            >
                <DragHandleIcon size="1.5em" />
            </button>

            {/* Text Display/Input Area */}
            <div className="line-text-area">
                {isEditing ? (
                    <div className="govuk-form-group line-text-input-group">
                        <InteractiveTextInput
                            value={line.text}
                            onChange={(newText) => handleLineTextChange(line.id, newText)}
                            onEnter={finishEditing}
                            onBlur={finishEditing}
                            maxLength={SPLITFLAP_DISPLAY_LENGTH}
                            disabled={isPlaying}
                            autoFocus
                            // Assuming InteractiveTextInput internally uses govuk-input or similar styling
                        />
                    </div>
                ) : (
                    <div
                        className="line-display-clickable"
                        onClick={() => !isPlaying && handleLineClick(line.id)}
                        title="Click to edit text"
                        role="button" // Semantics
                        tabIndex={isPlaying ? -1 : 0} // Keyboard accessible when not playing
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !isPlaying && handleLineClick(line.id); }} // Allow activation with Enter/Space
                    >
                        <SplitFlapDisplay size="small" text={line.text} isConnected={true} isInteractive={false} caretPosition={-1} />
                    </div>
                )}
            </div>

            {/* Duration Input - GDS Style */}
            <div className="govuk-form-group govuk-!-margin-left-2 line-duration-group">
                <label className="govuk-label govuk-visually-hidden" htmlFor={durationInputId}>
                    Duration (ms) for line {line.text}
                </label>
                <input
                    type="number"
                    id={durationInputId}
                    className="govuk-input govuk-input--width-5 line-duration-input"
                    value={line.durationMs ?? 1000}
                    onChange={(e) => handleDurationChange(line.id, parseInt(e.target.value, 10))}
                    min="100"
                    step="100"
                    disabled={isPlaying || isEditing} // Disable when editing this line
                    title="Line display duration (milliseconds)"
                />
                <span className="govuk-input__suffix" aria-hidden="true">ms</span>
            </div>

            {/* Action Buttons - GDS Style */}
            <div className="line-action-buttons govuk-button-group govuk-!-margin-left-2">
                {/* Duplicate Button */}
                <button
                    className="govuk-button govuk-button--secondary duplicate-line-btn"
                    onClick={() => handleDuplicateLine(line.id)}
                    disabled={isPlaying || isEditing} // Disable when editing this line
                    title="Duplicate Line"
                    aria-label={`Duplicate line ${line.text}`}
                >
                    <DuplicateIcon size="1.2em" />
                    <span className="govuk-visually-hidden">Duplicate</span>
                </button>
                {/* Delete Button */}
                <button
                    className="govuk-button govuk-button--warning delete-line-btn"
                    onClick={() => handleDeleteLine(line.id)}
                    disabled={isPlaying || isEditing} // Disable when editing this line
                    title="Delete Line"
                    aria-label={`Delete line ${line.text}`}
                >
                    <DeleteIcon size="1.2em" />
                    <span className="govuk-visually-hidden">Delete</span>
                </button>
            </div>
        </li>
    );
};
// --- End Sortable Item Component ---


const LOCAL_STORAGE_KEY = 'splitFlapScenes';

const SequenceMode: React.FC<SequenceModeProps> = ({ isConnected, onPlay, onStop }) => {
    const [currentLines, setCurrentLines] = useState<SceneLine[]>([]);
    const [newLineText, setNewLineText] = useState<string>('');
    // Removed top-level delayMs state
    const [savedScenes, setSavedScenes] = useState<{ [name: string]: Scene }>({});
    const [selectedSceneName, setSelectedSceneName] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [editingLineId, setEditingLineId] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const addLineInputId = 'add-sequence-line-input'; // ID for label association
    const loadSceneSelectId = 'load-sequence-scene-select'; // ID for label association

    // Load saved scenes from localStorage on mount
    useEffect(() => {
        const storedScenes = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedScenes) {
            try {
                setSavedScenes(JSON.parse(storedScenes));
            } catch (e) {
                console.error("Failed to parse saved scenes from localStorage", e);
                localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
            }
        }
    }, []);

    // Effect to clear timeout if component unmounts or isPlaying changes
     useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);


    const handleAddLine = () => {
        if (newLineText.trim() === '') return;
        // Use the exact text from the interactive input
        const textToAdd = newLineText; // Already managed by InteractiveTextInput
        const newLine: SceneLine = {
            id: Date.now().toString() + Math.random(), // Simple unique ID
            text: textToAdd.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH), // Ensure padding/length
            durationMs: 1000, // Default duration for new lines
        };
        setCurrentLines([...currentLines, newLine]);
        setNewLineText(''); // Clear input
        setEditingLineId(null); // Ensure no line is being edited after adding
    };

    const handleDeleteLine = (idToDelete: string) => {
        setCurrentLines(currentLines.filter(line => line.id !== idToDelete));
        if (editingLineId === idToDelete) {
            setEditingLineId(null); // Stop editing if the deleted line was being edited
        }
    };

    const handleDuplicateLine = (idToDuplicate: string) => {
        const lineIndex = currentLines.findIndex(line => line.id === idToDuplicate);
        if (lineIndex === -1) return; // Line not found

        const originalLine = currentLines[lineIndex];
        const newLine: SceneLine = {
            ...originalLine, // Copy text and duration
            id: Date.now().toString() + Math.random(), // Generate a new unique ID
        };

        // Insert the copy immediately after the original line
        const linesCopy = [...currentLines];
        linesCopy.splice(lineIndex + 1, 0, newLine);
        setCurrentLines(linesCopy);
        setEditingLineId(null); // Ensure editing stops if duplicating while editing was somehow possible
    };


    const handleDurationChange = (idToUpdate: string, newDuration: number) => {
        setCurrentLines(currentLines.map(line => {
            if (line.id === idToUpdate) {
                // Ensure duration is a positive number, default to 100ms if invalid
                const validDuration = Math.max(100, parseInt(String(newDuration), 10) || 100);
                return { ...line, durationMs: validDuration };
            }
            return line;
        }));
    };

    // --- In-place Editing Handlers ---
    const handleLineClick = (lineId: string) => {
        if (isPlaying) return; // Don't allow editing while playing
        setEditingLineId(lineId);
    };

    const handleLineTextChange = (idToUpdate: string, newText: string) => {
        // Ensure text is always padded/truncated correctly during edit
        const formattedText = newText.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH);
        setCurrentLines(currentLines.map(line =>
            line.id === idToUpdate ? { ...line, text: formattedText } : line
        ));
    };

    const handleLineBlur = () => {
        // Optional: Validate text on blur? For now, just stop editing.
        setEditingLineId(null); // Stop editing when the input loses focus
    };

    const handleLineEnter = () => {
        setEditingLineId(null); // Stop editing when Enter is pressed
    };
    // Combine blur and enter into one handler for finishing edits
    const handleFinishEditing = () => {
        setEditingLineId(null);
    };
    // --- End In-place Editing Handlers ---


    const handleSaveScene = () => {
        setEditingLineId(null); // Ensure editing stops before saving
        const sceneName = prompt("Enter a name for this scene:", selectedSceneName || "New Scene");
        if (!sceneName || sceneName.trim() === '') return;

        const newScene: Scene = {
            name: sceneName.trim(),
            lines: currentLines,
            // delayMs removed from Scene
        };
        const updatedScenes = { ...savedScenes, [newScene.name]: newScene };
        setSavedScenes(updatedScenes);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedScenes));
        setSelectedSceneName(newScene.name); // Select the newly saved scene
        alert(`Scene "${newScene.name}" saved!`);
    };

    const handleLoadScene = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const sceneName = event.target.value;
        if (sceneName && savedScenes[sceneName]) {
            const scene = savedScenes[sceneName];
            setSelectedSceneName(scene.name);
            setCurrentLines(scene.lines);
            // delayMs removed
        } else {
            // Handle "New Scene" selection or error
            setSelectedSceneName('');
            setCurrentLines([]);
            // delayMs removed
        }
    };

     const handleDeleteSavedScene = () => {
        if (!selectedSceneName || !savedScenes[selectedSceneName]) {
            alert("No scene selected to delete.");
            return;
        }
        if (confirm(`Are you sure you want to delete the scene "${selectedSceneName}"?`)) {
            const { [selectedSceneName]: _, ...remainingScenes } = savedScenes; // Destructure to remove
            setSavedScenes(remainingScenes);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remainingScenes));
            // Reset editor to new scene state
            setSelectedSceneName('');
            setCurrentLines([]);
            // delayMs removed
            alert(`Scene "${selectedSceneName}" deleted.`);
        }
    };

    const handlePlayScene = () => {
        if (isPlaying || currentLines.length === 0 || !isConnected) return;

        // Construct the scene object to send to backend
        const currentScene: Scene = {
            name: selectedSceneName || `Untitled Scene ${Date.now()}`, // Use selected name or generate one
            lines: currentLines,
        };
        onPlay(currentScene); // Emit event to backend via App.tsx prop
        setIsPlaying(true); // Set local playing state immediately for UI feedback
        // Backend will manage the actual playback and timing
    };

     const handleStopScene = () => {
        // if (timeoutRef.current) { // Backend now manages the timer
        //     clearTimeout(timeoutRef.current);
        //     timeoutRef.current = null;
        // }
        onStop(); // Emit event to backend via App.tsx prop
        setIsPlaying(false); // Set local playing state immediately for UI feedback
        // Backend state update might confirm this later
    };

    // --- Drag and Drop Handler (dnd-kit) ---
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setCurrentLines((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                // Use arrayMove from dnd-kit/sortable
                return arrayMove(items, oldIndex, newIndex);
            });
            setEditingLineId(null); // Stop editing after reorder
        }
    }
    // --- End Drag and Drop Handler ---

    return (
        <div className="sequence-mode govuk-!-padding-4"> {/* Add GDS padding */}
            <h4 className="govuk-heading-m draggable-handle">Sequence Mode</h4> {/* GDS Heading */}

            {/* Scene Loading/Saving - GDS Style */}
            <div className="scene-management govuk-grid-row govuk-!-margin-bottom-6">
                <div className="govuk-grid-column-two-thirds">
                    <div className="govuk-form-group">
                        <label className="govuk-label" htmlFor={loadSceneSelectId}>
                            Load Saved Scene
                        </label>
                        <select
                            className="govuk-select"
                            id={loadSceneSelectId}
                            onChange={handleLoadScene}
                            value={selectedSceneName}
                            disabled={isPlaying || !!editingLineId} // Also disable if editing a line
                        >
                            <option value="">-- Select Scene --</option>
                            {Object.keys(savedScenes).sort().map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="govuk-grid-column-one-third">
                    {/* Buttons aligned to the right or below select on smaller screens */}
                    <div className="govuk-button-group scene-management-buttons">
                        <button
                            onClick={handleSaveScene}
                            disabled={currentLines.length === 0 || isPlaying || !!editingLineId}
                            className="govuk-button govuk-button--secondary" // Secondary for save
                            data-module="govuk-button"
                            title="Save the current lines as a new scene or overwrite the selected scene"
                        >
                            Save Scene
                        </button>
                        <button
                            onClick={handleDeleteSavedScene}
                            disabled={!selectedSceneName || isPlaying || !!editingLineId}
                            className="govuk-button govuk-button--warning" // Warning for delete
                            data-module="govuk-button"
                            title="Delete the currently selected saved scene"
                        >
                            Delete Scene
                        </button>
                    </div>
                </div>
            </div>


            {/* Scene Editor - GDS Style */}
            <div className="scene-editor">
                <h5 className="govuk-heading-s">Edit Scene Lines ({currentLines.length})</h5> {/* GDS Heading */}
                {/* Add Line Form - GDS Style */}
                <div className="add-line-form govuk-form-group">
                     <label className="govuk-label govuk-visually-hidden" htmlFor={addLineInputId}>
                        Add new line text
                     </label>
                    {/* Assuming InteractiveTextInput applies govuk-input style */}
                    <InteractiveTextInput
                        value={newLineText}
                        onChange={setNewLineText}
                        onEnter={handleAddLine}
                        maxLength={SPLITFLAP_DISPLAY_LENGTH}
                        placeholder={`Enter new line text (max ${SPLITFLAP_DISPLAY_LENGTH} chars)`}
                        disabled={isPlaying || !!editingLineId} // Disable if playing or editing any line
                        // Pass ID for label association if InteractiveTextInput supports it
                        // id={addLineInputId}
                    />
                    {/* Add button is implicit via Enter key in InteractiveTextInput */}
                </div>

                {/* dnd-kit List */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={currentLines} // Pass array of items with unique 'id'
                        strategy={verticalListSortingStrategy}
                    >
                        <ul className="line-list">
                            {currentLines.map((line) => (
                                // Render the separate SortableLineItem component
                                <SortableLineItem
                                    key={line.id}
                                    line={line}
                                    isPlaying={isPlaying}
                                    editingLineId={editingLineId}
                                    handleLineClick={handleLineClick}
                                    handleLineTextChange={handleLineTextChange}
                                    handleLineEnter={handleFinishEditing} // Pass combined handler
                                    handleLineBlur={handleFinishEditing} // Pass combined handler
                                    handleDurationChange={handleDurationChange}
                                    handleDeleteLine={handleDeleteLine}
                                    handleDuplicateLine={handleDuplicateLine} // Pass duplicate handler
                                />
                            ))}
                            {currentLines.length === 0 && <li className="no-lines">Add lines to create a scene.</li>}
                        </ul>
                    </SortableContext>
                </DndContext>
            </div>
            {/* Play/Stop Controls - GDS Style */}
            <div className="scene-controls govuk-button-group govuk-!-margin-top-6">
                <button
                    onClick={handlePlayScene}
                    disabled={!isConnected || isPlaying || currentLines.length === 0 || !!editingLineId} // Disable if editing
                    className="govuk-button" // Primary button for Play
                    data-module="govuk-button"
                >
                    ▶️ Play Scene
                </button>
                <button
                    onClick={handleStopScene}
                    disabled={!isPlaying} // Only depends on playing state
                    className="govuk-button govuk-button--secondary stop-button" // Secondary for Stop
                    data-module="govuk-button"
                >
                    ⏹️ Stop
                </button>
            </div>
            {/* Connection Warning - GDS Style */}
            {!isConnected && (
                <div className="govuk-warning-text govuk-!-margin-top-4">
                    <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
                    <strong className="govuk-warning-text__text">
                        <span className="govuk-warning-text__assistive">Warning</span>
                        Disconnected from backend. Connect to play scenes.
                    </strong>
                </div>
            )}
        </div>
    );
};

export default SequenceMode;
