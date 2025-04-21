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
import { Scene, SceneLine } from '../types';
import { DISPLAY_LENGTH } from '../constants';
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
    handleLineBlur: () => void; // Renamed from handleFinishEditing for clarity here
    handleDurationChange: (id: string, duration: number) => void;
    handleDeleteLine: (id: string) => void;
    handleDuplicateLine: (id: string) => void; // Add duplicate handler prop
}

const SortableLineItem: React.FC<SortableLineItemProps> = ({
    line, isPlaying, editingLineId, handleLineClick, handleLineTextChange,
    handleLineEnter, handleLineBlur, handleDurationChange, handleDeleteLine, handleDuplicateLine // Destructure new prop
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
        zIndex: isDragging ? 100 : 'auto', // Ensure dragging item is on top
    };

    // Use handleLineBlur or handleLineEnter when the inline input loses focus or Enter is pressed
    const finishEditing = () => {
        handleLineBlur(); // Or handleLineEnter(), depending on desired behavior
    };


    return (
        <li ref={setNodeRef} style={style} className={`${editingLineId === line.id ? 'editing' : ''} ${isDragging ? 'dragging-style' : ''}`}>
            {/* Drag Handle - using listeners from useSortable */}
            <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
                ⠿
            </span>
            {/* Rest of the line item content remains the same */}
            {editingLineId === line.id ? (
                 <InteractiveTextInput
                    value={line.text}
                    onChange={(newText) => handleLineTextChange(line.id, newText)}
                    onEnter={finishEditing} // Use the combined handler
                    onBlur={finishEditing} // Use the combined handler
                    maxLength={DISPLAY_LENGTH}
                    disabled={isPlaying}
                    autoFocus />
            ) : (
                 <div className="line-display-clickable" onClick={() => !isPlaying && handleLineClick(line.id)} title="Click to edit text"><SplitFlapDisplay size="small" text={line.text} /></div>
            )}
            <input type="number" className="line-duration-input" value={line.durationMs ?? 1000} onChange={(e) => handleDurationChange(line.id, parseInt(e.target.value, 10))} min="100" step="100" disabled={isPlaying || editingLineId === line.id} title="Line display duration (ms)" />
            <span className="duration-unit">ms</span>
            {/* Add Duplicate Button - Disable if playing or *any* line is being edited */}
            <button className="duplicate-line-btn" onClick={() => handleDuplicateLine(line.id)} disabled={isPlaying || !!editingLineId} title="Duplicate Line">❐</button>
            <button className="delete-line-btn" onClick={() => handleDeleteLine(line.id)} disabled={isPlaying || editingLineId === line.id} title="Delete Line">×</button>
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
    const [editingLineId, setEditingLineId] = useState<string | null>(null); // State to track which line is being edited
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID
    // Setup dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
            text: textToAdd.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH), // Ensure padding/length
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
        const formattedText = newText.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
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
        <div className="sequence-mode">
            <h4>Sequence Mode</h4>

            {/* Scene Loading/Saving */}
            <div className="scene-management">
                <select onChange={handleLoadScene} value={selectedSceneName} disabled={isPlaying}>
                    <option value="">-- Load Saved Scene --</option>
                    {Object.keys(savedScenes).sort().map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                 <button onClick={handleDeleteSavedScene} disabled={!selectedSceneName || isPlaying} title="Delete Selected Scene">
                    🗑️ Delete
                </button>
                <button onClick={handleSaveScene} disabled={currentLines.length === 0 || isPlaying}>
                    💾 Save Current Scene
                </button>
            </div>

            {/* Scene Editor */}
            <div className="scene-editor">
                <h5>Edit Scene Lines ({currentLines.length})</h5>
                <div className="add-line-form">
                    {/* Replace input with InteractiveTextInput */}
                    <InteractiveTextInput
                        value={newLineText}
                        onChange={setNewLineText} // Pass the state setter directly
                        onEnter={handleAddLine} // Trigger add line on Enter
                        maxLength={DISPLAY_LENGTH}
                        placeholder={`Enter line (max ${DISPLAY_LENGTH} chars)`}
                        disabled={isPlaying}
                    />
                </div>
                {/* dnd-kit Implementation */}
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
            {/* Play/Stop Controls */}
             <div className="scene-controls">
                 <button onClick={handlePlayScene} disabled={!isConnected || isPlaying || currentLines.length === 0}>
                     ▶️ Play Scene
                 </button>
                  <button onClick={handleStopScene} disabled={!isPlaying} className="stop-button">
                     ⏹️ Stop
                 </button>
            </div>
             {!isConnected && <p className="connection-warning">Connect to MQTT to play scenes.</p>}
        </div>
    );
};

export default SequenceMode;
