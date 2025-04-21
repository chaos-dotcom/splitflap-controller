import React, { useState, useEffect, useRef } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Scene, SceneLine } from '../types';
import { DISPLAY_LENGTH } from '../constants';
import './SequenceMode.css';
import SplitFlapDisplay from './SplitFlapDisplay'; // Import the display component
import InteractiveTextInput from './InteractiveTextInput';

interface SequenceModeProps {
    isConnected: boolean;
    onSendMessage: (message: string) => void;
}

const LOCAL_STORAGE_KEY = 'splitFlapScenes';

const SequenceMode: React.FC<SequenceModeProps> = ({ isConnected, onSendMessage }) => {
    const [currentLines, setCurrentLines] = useState<SceneLine[]>([]);
    const [newLineText, setNewLineText] = useState<string>('');
    // Removed top-level delayMs state
    const [savedScenes, setSavedScenes] = useState<{ [name: string]: Scene }>({});
    const [selectedSceneName, setSelectedSceneName] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [editingLineId, setEditingLineId] = useState<string | null>(null); // State to track which line is being edited
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
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
    // --- End In-place Editing Handlers ---

    // --- Drag and Drop Handler (Removed - To be replaced with dnd-kit) ---


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

        setIsPlaying(true);
        let lineIndex = 0;

        const playNextLine = () => {
            // Get the line that was *just* displayed (or starting condition)
            const previousLineIndex = lineIndex - 1;
            const currentLineDuration = previousLineIndex >= 0
                ? currentLines[previousLineIndex].durationMs ?? 1000 // Use duration of the line just shown
                : 0; // No delay before the first line

            if (lineIndex >= currentLines.length) { // Check if we've processed all lines
                setIsPlaying(false); // Finished playing
                timeoutRef.current = null;
                return;
            }

            const line = currentLines[lineIndex];
            onSendMessage(line.text); // Send the line to be displayed now
            lineIndex++; // Move to the next line index for the *next* iteration

            // Schedule the *next* call to playNextLine after the current line's duration
            timeoutRef.current = setTimeout(playNextLine, currentLineDuration);
        };

        playNextLine(); // Start the sequence
    };

     const handleStopScene = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsPlaying(false);
    };

    // --- Drag and Drop Handler ---
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setCurrentLines((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setEditingLineId(null); // Stop editing if item is moved
        }
    };

    // --- Sortable Item Component ---
    const SortableLineItem: React.FC<{ line: SceneLine }> = ({ line }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging, // Add isDragging state
        } = useSortable({ id: line.id });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1, // Make item semi-transparent while dragging
            zIndex: isDragging ? 1 : 'auto', // Ensure dragging item is on top
            // Add a class for dragging state if needed for more complex styling
        };

        return (
            <li
                ref={setNodeRef}
                style={style}
                key={line.id} // Keep React key
                className={`${editingLineId === line.id ? 'editing' : ''} ${isDragging ? 'dragging' : ''}`} // Add dragging class
            >
                {/* Drag Handle */}
                <span
                    className="drag-handle"
                    title="Drag to reorder"
                    {...attributes} // Spread dnd attributes here
                    {...listeners} // Spread dnd listeners here
                >
                    ⠿ {/* Use a drag handle icon (or text like '::') */}
                </span>
                {/* Conditionally render Display or Input */}
                {editingLineId === line.id ? (
                    <InteractiveTextInput
                        value={line.text}
                        onChange={(newText) => handleLineTextChange(line.id, newText)}
                        onEnter={handleLineEnter}
                        onBlur={handleLineBlur} // Stop editing on blur
                        maxLength={DISPLAY_LENGTH}
                        disabled={isPlaying}
                        autoFocus // Focus when the input appears
                    />
                ) : (
                    <div className="line-display-clickable" onClick={() => handleLineClick(line.id)} title="Click to edit text">
                        <SplitFlapDisplay
                            size="small"
                            text={line.text}
                        />
                    </div>
                )}
                <input
                    type="number"
                    className="line-duration-input"
                    value={line.durationMs ?? 1000} // Use default if undefined
                    onChange={(e) => handleDurationChange(line.id, parseInt(e.target.value, 10))}
                    min="100"
                    step="100"
                    disabled={isPlaying || !!editingLineId} // Disable if editing text too
                    title="Line display duration (ms)"
                />
                <span className="duration-unit">ms</span>
                <button className="delete-line-btn" onClick={() => handleDeleteLine(line.id)} disabled={isPlaying || !!editingLineId} title="Delete Line">×</button>
            </li>
        );
    };


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
                 {/* List container - dnd-kit context will wrap this */}
                 <ul className="line-list">
                 {/* List container - Wrap with DndContext and SortableContext */}
                 <DndContext
                     sensors={sensors}
                     collisionDetection={closestCenter}
                     onDragEnd={handleDragEnd}
                 >
                     <SortableContext
                         items={currentLines} // Pass the array of items with unique 'id' properties
                         strategy={verticalListSortingStrategy}
                     >
                         <ul className="line-list">
                             {currentLines.map((line) => (
                                 // Use the SortableLineItem component
                                 <SortableLineItem key={line.id} line={line} />
                             ))}
                             {/* Placeholder for empty list remains */}
                             {currentLines.length === 0 && <li className="no-lines">Add lines to create a scene.</li>}
                         </ul>
                     </SortableContext>
                 </DndContext>
                 {/* Removed old list rendering logic */}
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

/* --- Old list rendering logic (removed) ---
 {currentLines.map((line, index) => (
                         // List item - will be made draggable by dnd-kit
                         <li
                             key={line.id} // Keep React key
                             className={editingLineId === line.id ? 'editing' : ''}
                         >
                             {/* Drag Handle - dnd-kit will attach listeners here * /}
                             <span
                                 className="drag-handle"
                                 title="Drag to reorder"
                             >
                                 {index + 1}:
                             </span>
                             {/* Conditionally render Display or Input * /}
                             {editingLineId === line.id ? (
                                 <InteractiveTextInput
                                     value={line.text}
                                     onChange={(newText) => handleLineTextChange(line.id, newText)}
                                     onEnter={handleLineEnter}
                                     onBlur={handleLineBlur} // Stop editing on blur
                                     maxLength={DISPLAY_LENGTH}
                                     disabled={isPlaying}
                                     autoFocus // Focus when the input appears
                                 />
                             ) : (
                                 <div className="line-display-clickable" onClick={() => handleLineClick(line.id)} title="Click to edit text">
                                     {/* Pass minimal props for static display */}
                                     <SplitFlapDisplay
                                         size="small"
                                         text={line.text}
                                         // Removed unnecessary props for static display
                                     />
                                 </div>
                             )}
                             <input
                                 type="number"
                                 className="line-duration-input"
                                 value={line.durationMs ?? 1000} // Use default if undefined
                                 onChange={(e) => handleDurationChange(line.id, parseInt(e.target.value, 10))}
                                 min="100"
                                 step="100"
                                 disabled={isPlaying || !!editingLineId} // Disable if editing text too
                                 title="Line display duration (ms)"
                             />
                             <span className="duration-unit">ms</span>
                             <button className="delete-line-btn" onClick={() => handleDeleteLine(line.id)} disabled={isPlaying || !!editingLineId} title="Delete Line">×</button>
                         </li>
                     ))}
                     {/* Placeholder for empty list remains */}
                     {currentLines.length === 0 && <li className="no-lines">Add lines to create a scene.</li>}
                 </ul>
                 {/* Removed DragDropContext, Droppable, Draggable */}
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
