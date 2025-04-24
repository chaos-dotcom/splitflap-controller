import React, { useState, useEffect } from 'react'; // Removed useRef
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
    isConnected: boolean;
    onPlay: (scene: Scene) => void;
    onStop: () => void;
    // --- New Props for Backend Interaction ---
    sceneNames: string[]; // List of scene names from App state
    loadedScene: Scene | null; // Currently loaded scene data from App state
    onGetSceneList: () => void; // Callback to request scene list from backend
    onLoadScene: (sceneName: string) => void; // Callback to request loading a scene
    onSaveScene: (sceneName: string, sceneData: Scene) => void; // Callback to save scene to backend
    onDeleteScene: (sceneName: string) => void; // Callback to delete scene from backend
    // --- End New Props ---
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
    // handleLineEnter: () => void; // Removed - Combined into handleFinishEditing/handleLineBlur
    handleLineBlur: () => void;
    handleDurationChange: (id: string, duration: number) => void;
    handleDeleteLine: (id: string) => void;
    handleDuplicateLine: (id: string) => void;
}

const SortableLineItem: React.FC<SortableLineItemProps> = ({
    line, isPlaying, editingLineId, handleLineClick, handleLineTextChange,
    handleLineBlur, handleDurationChange, handleDeleteLine, handleDuplicateLine // Removed handleLineEnter
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
                            maxLength={SPLITFLAP_DISPLAY_LENGTH()}
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

            {/* Duration Input - GDS Style (Seconds) */}
            <div className="govuk-form-group govuk-!-margin-left-2 line-duration-group">
                <label className="govuk-label govuk-visually-hidden" htmlFor={durationInputId}>
                    Duration (seconds) for line {line.text}
                </label>
                <input
                    type="number" // Keep as number, but handle floats
                    id={durationInputId}
                    className="govuk-input govuk-input--width-5 line-duration-input"
                    // Display value in seconds
                    value={(line.durationMs ?? 1000) / 1000}
                    // Convert input value (seconds) back to milliseconds for state update
                    onChange={(e) => {
                        const seconds = parseFloat(e.target.value);
                        // Convert valid float seconds to milliseconds, default/minimum 100ms
                        const ms = !isNaN(seconds) ? Math.max(100, Math.round(seconds * 1000)) : 100;
                        handleDurationChange(line.id, ms);
                    }}
                    min="0.1" // Minimum 0.1 seconds (100ms)
                    step="0.1" // Step in 0.1 second increments
                    disabled={isPlaying || isEditing} // Disable when editing this line
                    title="Line display duration (seconds)"
                />
                <span className="govuk-input__suffix" aria-hidden="true" style={{ color: 'black' }}>s</span> {/* Changed unit to 's' and set color */}
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


// const LOCAL_STORAGE_KEY = 'splitFlapScenes'; // No longer needed

const SequenceMode: React.FC<SequenceModeProps> = ({
    isConnected,
    onPlay,
    onStop,
    sceneNames, // Use prop
    loadedScene, // Use prop
    onGetSceneList, // Use prop
    onLoadScene, // Use prop
    onSaveScene, // Use prop
    onDeleteScene, // Use prop
 }) => {
    const [currentLines, setCurrentLines] = useState<SceneLine[]>([]);
    const [newLineText, setNewLineText] = useState<string>('');
    // const [savedScenes, setSavedScenes] = useState<{ [name: string]: Scene }>({}); // Removed localStorage state
    const [selectedSceneName, setSelectedSceneName] = useState<string>(''); // Still needed for dropdown selection
    const [isPlaying, setIsPlaying] = useState<boolean>(false); // Local UI playing state
    const [editingLineId, setEditingLineId] = useState<string | null>(null);
    const [loopScene, setLoopScene] = useState<boolean>(false); // State for loop checkbox
    // const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Backend manages timing now
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const addLineInputId = 'add-sequence-line-input';
    const loadSceneSelectId = 'load-sequence-scene-select';

    // Request scene list on mount if connected
    useEffect(() => {
        if (isConnected) {
            console.log('[SequenceMode] Requesting initial scene list.');
            onGetSceneList();
        }
        // Optionally clear local state if disconnected?
        // else {
        //     setCurrentLines([]);
        //     setSelectedSceneName('');
        // }
    }, [isConnected, onGetSceneList]); // Rerun if connection status changes

    // Update local state when a scene is loaded from the backend via props
    useEffect(() => {
        if (loadedScene) {
            console.log(`[SequenceMode] Loaded scene "${loadedScene.name}" from props.`);
            setCurrentLines(loadedScene.lines);
            setCurrentLines(loadedScene.lines);
            setSelectedSceneName(loadedScene.name); // Sync dropdown selection
            setLoopScene(loadedScene.loop ?? false); // Update loop state from loaded scene
        } else {
            // If loadedScene becomes null (e.g., after delete or error), reset local state
            // Avoid resetting if it was just initially null
            // if (selectedSceneName !== '') { // Only reset if a scene *was* selected
            //     console.log('[SequenceMode] loadedScene prop is null, resetting local state.');
            //     setCurrentLines([]);
            //     setSelectedSceneName('');
            // }
        }
    }, [loadedScene]); // Depend only on loadedScene prop


    const handleAddLine = () => {
        if (newLineText.trim() === '') return;
        // Use the exact text from the interactive input
        const textToAdd = newLineText; // Already managed by InteractiveTextInput
        const newLine: SceneLine = {
            id: Date.now().toString() + Math.random(), // Simple unique ID
            text: textToAdd.padEnd(SPLITFLAP_DISPLAY_LENGTH()).substring(0, SPLITFLAP_DISPLAY_LENGTH()), // Ensure padding/length
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
        const formattedText = newText.padEnd(SPLITFLAP_DISPLAY_LENGTH()).substring(0, SPLITFLAP_DISPLAY_LENGTH());
        setCurrentLines(currentLines.map(line =>
            line.id === idToUpdate ? { ...line, text: formattedText } : line
        ));
    };

    // Removed handleLineBlur as it's combined into handleFinishEditing
    // const handleLineBlur = () => {
    //     // Optional: Validate text on blur? For now, just stop editing.
    //     setEditingLineId(null); // Stop editing when the input loses focus
    // };

    // Removed handleLineEnter as it's combined into handleFinishEditing
    // const handleLineEnter = () => {
    //     setEditingLineId(null); // Stop editing when Enter is pressed
    // };

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
            loop: loopScene, // Include loop state in saved data
            // delayMs removed
        };
        // Call the onSaveScene prop (passed from App.tsx) to emit the socket event
        onSaveScene(newScene.name, newScene);
        // Backend will handle saving and broadcasting the updated list via sceneListUpdate event
        // App.tsx will update sceneNames state, which flows back down as props.
        // setSelectedSceneName(newScene.name); // Let the sceneLoaded event handle selection if needed, or rely on sceneListUpdate
        // alert(`Scene "${newScene.name}" saved!`); // Confirmation can be handled in App.tsx based on backend response if needed
    };

    const handleLoadScene = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const sceneName = event.target.value;
        if (sceneName) {
            console.log(`[SequenceMode] Requesting load for scene: ${sceneName}`);
            onLoadScene(sceneName); // Call prop to emit socket event
            // The actual loading happens when App.tsx receives 'sceneLoaded' and updates the `loadedScene` prop
        } else {
            // Handle "-- Select Scene --" selection
            setSelectedSceneName('');
            setCurrentLines([]); // Clear local editor
            setLoopScene(false); // Reset loop state
            // Optionally tell App.tsx to clear its loadedScene state if needed
        }
    };

     const handleDeleteSavedScene = () => {
        if (!selectedSceneName) {
            alert("No scene selected to delete.");
            return;
        }
        if (confirm(`Are you sure you want to delete the scene "${selectedSceneName}"?`)) {
            console.log(`[SequenceMode] Requesting delete for scene: ${selectedSceneName}`);
            onDeleteScene(selectedSceneName); // Call prop to emit socket event
            // Backend handles deletion and broadcasts 'sceneListUpdate'
            // App.tsx updates sceneNames state.
            // We also clear local state immediately for better UX
            setSelectedSceneName('');
            setCurrentLines([]);
            setLoopScene(false); // Reset loop state on delete
            // alert(`Scene "${selectedSceneName}" deleted.`); // Confirmation handled by backend/App state update
        }
    };

    const handlePlayScene = () => {
        if (isPlaying || currentLines.length === 0 || !isConnected) return;

        // Construct the scene object to send to backend
        const currentScene: Scene = {
            name: selectedSceneName || `Untitled Scene ${Date.now()}`, // Use selected name or generate one
            lines: currentLines,
            loop: loopScene, // Include loop state
        };
        onPlay(currentScene); // Emit event to backend via App.tsx prop (will include loop)
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
        <div className="sequence-mode"> {/* Remove GDS padding utility class */}
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
                            {/* Use sceneNames prop from App state */}
                            {sceneNames.map(name => (
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
                            title="Delete the currently selected saved scene from the backend" // Updated title
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
                        maxLength={SPLITFLAP_DISPLAY_LENGTH()}
                        placeholder={`Enter new line text (max ${SPLITFLAP_DISPLAY_LENGTH()} chars)`}
                        disabled={isPlaying || !!editingLineId} // Disable if playing or editing any line
                        // Pass ID for label association if InteractiveTextInput supports it
                        // id={addLineInputId}
                    />
                    {/* Add button is implicit via Enter key in InteractiveTextInput */}
                </div>

                {/* Panel Wrapper for the Line List */}
                <div className="sequence-lines-panel">
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
                                        // handleLineEnter={handleFinishEditing} // Removed prop
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
                {/* Loop Checkbox - GDS Style */}
                <div className="govuk-checkboxes__item govuk-!-margin-left-4">
                    <input
                        className="govuk-checkboxes__input"
                        id="loop-scene-checkbox"
                        name="loopScene"
                        type="checkbox"
                        checked={loopScene}
                        onChange={(e) => setLoopScene(e.target.checked)}
                        disabled={isPlaying || !!editingLineId} // Disable while playing or editing
                    />
                    <label className="govuk-label govuk-checkboxes__label" htmlFor="loop-scene-checkbox">
                        Loop Scene
                    </label>
                </div>
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
