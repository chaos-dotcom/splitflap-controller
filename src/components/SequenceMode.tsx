import React, { useState, useEffect, useRef } from 'react';
import { Scene, SceneLine } from '../types';
import { DISPLAY_LENGTH } from '../constants';
import './SequenceMode.css';
import InteractiveTextInput from './InteractiveTextInput'; // Import the new component

interface SequenceModeProps {
    isConnected: boolean;
    onSendMessage: (message: string) => void;
}

const LOCAL_STORAGE_KEY = 'splitFlapScenes';

const SequenceMode: React.FC<SequenceModeProps> = ({ isConnected, onSendMessage }) => {
    const [currentLines, setCurrentLines] = useState<SceneLine[]>([]);
    const [newLineText, setNewLineText] = useState<string>('');
    const [delayMs, setDelayMs] = useState<number>(1000); // Default 1 second
    const [savedScenes, setSavedScenes] = useState<{ [name: string]: Scene }>({});
    const [selectedSceneName, setSelectedSceneName] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID

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
        const formattedText = newLineText.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
        const newLine: SceneLine = {
            id: Date.now().toString() + Math.random(), // Simple unique ID
            text: formattedText,
        };
        setCurrentLines([...currentLines, newLine]);
        setNewLineText(''); // Clear input
    };

    const handleDeleteLine = (idToDelete: string) => {
        setCurrentLines(currentLines.filter(line => line.id !== idToDelete));
    };

    const handleSaveScene = () => {
        const sceneName = prompt("Enter a name for this scene:", selectedSceneName || "New Scene");
        if (!sceneName || sceneName.trim() === '') return;

        const newScene: Scene = {
            name: sceneName.trim(),
            lines: currentLines,
            delayMs: delayMs,
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
            setDelayMs(scene.delayMs);
        } else {
            // Handle "New Scene" selection or error
            setSelectedSceneName('');
            setCurrentLines([]);
            setDelayMs(1000);
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
            setDelayMs(1000);
            alert(`Scene "${selectedSceneName}" deleted.`);
        }
    };

    const handlePlayScene = () => {
        if (isPlaying || currentLines.length === 0 || !isConnected) return;

        setIsPlaying(true);
        let lineIndex = 0;

        const playNextLine = () => {
            if (lineIndex >= currentLines.length) {
                setIsPlaying(false); // Finished playing
                timeoutRef.current = null;
                return;
            }

            const line = currentLines[lineIndex];
            onSendMessage(line.text); // Send the current line
            lineIndex++;

            // Schedule the next line
            timeoutRef.current = setTimeout(playNextLine, delayMs);
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
                <ul className="line-list">
                    {currentLines.map((line, index) => (
                        <li key={line.id}>
                            <span>{index + 1}:</span>
                            <code className="line-text">{line.text.replace(/ /g, '\u00A0')}</code> {/* Show spaces */}
                            <button onClick={() => handleDeleteLine(line.id)} disabled={isPlaying} title="Delete Line">×</button>
                        </li>
                    ))}
                     {currentLines.length === 0 && <li className="no-lines">Add lines to create a scene.</li>}
                </ul>
            </div>

            {/* Delay and Play Controls */}
            <div className="scene-controls">
                <label htmlFor="delayInput">Delay (ms): </label>
                <input
                    id="delayInput"
                    type="number"
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(100, parseInt(e.target.value, 10) || 100))} // Min 100ms delay
                    min="100"
                    step="100"
                    disabled={isPlaying}
                />
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
