import { useEffect, useMemo, useRef, useState } from 'react';

const quickActions = [
  'VOICE',
  'SYSTEM',
  'FILES',
  'BROWSER',
  'AI',
  'PROJECTS',
  'GITHUB',
  'REMINDERS',
  'SETTINGS',
];

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001`;

function App() {
  const [messages, setMessages] = useState([
    { id: 1, role: 'jarvis', text: 'JARVIS online. Voice and text systems are ready.' },
  ]);
  const [activity, setActivity] = useState([
    { id: 1, time: '00:00:00', message: 'SYSTEM READY' },
  ]);
  const [system, setSystem] = useState({
    status: 'ONLINE',
    core: 'ACTIVE',
    voice: 'READY',
    ai: 'CONNECTED',
    tools: 12,
    network: 'CONNECTED',
    pc: 'ONLINE',
    os: 'Windows 11',
    cpu: 'Intel',
    ram: { total: 'N/A', free: 'N/A' },
  });
  const [toolList, setToolList] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [coreState, setCoreState] = useState('idle');
  const [pendingAction, setPendingAction] = useState(null);
  const [connectionState, setConnectionState] = useState('connected');
  const recognitionRef = useRef(null);
  const wsRef = useRef(null);

  const statusSummary = useMemo(
    () => ({
      system: system.status || 'ONLINE',
      core: system.core || 'ACTIVE',
      voice: isListening ? 'LISTENING' : system.voice || 'READY',
      ai: system.ai || 'CONNECTED',
      tools: `${system.tools || 12} ACTIVE`,
      network: connectionState === 'connected' ? 'CONNECTED' : 'OFFLINE',
      pc: connectionState === 'connected' ? 'ONLINE' : 'OFFLINE',
    }),
    [system, isListening, connectionState],
  );

  const addMessage = (role, text) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role, text },
    ].slice(-18));
  };

  const appendActivity = (message) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setActivity((prev) => [{ id: Date.now() + Math.random(), time, message }, ...prev].slice(0, 12));
  };

  const fetchSystem = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/system`);
      const result = await response.json();
      setSystem(result);
    } catch (error) {
      setConnectionState('offline');
    }
  };

  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tools`);
      const result = await response.json();
      setToolList(result);
    } catch (error) {
      setToolList([]);
    }
  };

  const connectSocket = () => {
    const socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3001`;
    const socket = new WebSocket(socketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionState('connected');
      appendActivity('PC CONNECTED');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'activity') {
          appendActivity(payload.payload.message);
        }
        if (payload.type === 'status') {
          setConnectionState(payload.payload.online ? 'connected' : 'offline');
        }
      } catch (error) {
        // Ignore malformed messages.
      }
    };

    socket.onclose = () => {
      setConnectionState('offline');
      appendActivity('PC OFFLINE');
      setTimeout(connectSocket, 2000);
    };
  };

  const speakText = (text) => {
    if (!text || typeof window === 'undefined') {
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      setCoreState('speaking');
    }
  };

  const submitCommand = async (command) => {
    const value = command || inputValue;
    if (!value.trim()) return;

    addMessage('user', value.trim());
    setInputValue('');
    setCoreState('thinking');
    appendActivity('COMMAND ANALYZED');

    try {
      const response = await fetch(`${API_BASE}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value.trim() }),
      });

      const result = await response.json();
      if (result.requiresConfirmation) {
        setPendingAction(result.pendingAction);
        addMessage('tool', result.message || 'Permission requested.');
        appendActivity('PERMISSION REQUIRED');
        setCoreState('executing');
        return;
      }

      const responseText = result.response || result.summary || result.message || 'Command completed.';
      addMessage('jarvis', responseText);
      appendActivity('JARVIS RESPONSE READY');
      setCoreState(result.status === 'error' ? 'error' : 'completed');
      speakText(responseText);
    } catch (error) {
      addMessage('jarvis', 'AI service unavailable. Please verify the JARVIS backend is running.');
      appendActivity('AI SERVICE UNAVAILABLE');
      setCoreState('error');
    }
  };

  const handleConfirmation = async (allow) => {
    if (!pendingAction) return;
    try {
      const response = await fetch(`${API_BASE}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: pendingAction.id, confirmed: allow }),
      });
      const result = await response.json();
      setPendingAction(null);
      if (allow) {
        const responseText = result.response || 'Action approved and completed.';
        addMessage('jarvis', responseText);
        speakText(responseText);
      } else {
        addMessage('tool', 'Action cancelled by user.');
      }
      setCoreState(allow ? 'executing' : 'idle');
    } catch (error) {
      addMessage('jarvis', 'Unable to confirm the requested action.');
      setCoreState('error');
    }
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage('jarvis', 'Microphone access is unavailable in this browser.');
      setCoreState('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setCoreState('listening');
      appendActivity('VOICE INPUT RECEIVED');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      submitCommand(transcript);
    };

    recognition.onerror = () => {
      addMessage('jarvis', 'Microphone permission required or speech recognition failed.');
      setCoreState('error');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setCoreState('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    fetchSystem();
    fetchTools();
    connectSocket();
  }, []);

  return (
    <div className="app-shell">
      <div className="hud-grid">
        <header className="topbar panel">
          <div>
            <p className="eyebrow">SYSTEM STATUS</p>
            <h1>JARVIS CORE</h1>
          </div>
          <div className="status-capsules">
            {Object.entries(statusSummary).map(([key, value]) => (
              <span key={key} className="capsule">
                {key.toUpperCase()}: {value}
              </span>
            ))}
          </div>
        </header>

        <aside className="left-panel panel">
          <div className="panel-title">COMMANDS</div>
          <div className="command-list">
            {quickActions.map((label) => (
              <button key={label} className="action-button" onClick={() => submitCommand(label.toLowerCase() === 'voice' ? 'show system information' : label.toLowerCase() === 'system' ? 'show system information' : label.toLowerCase() === 'files' ? 'search my project for error' : label.toLowerCase() === 'browser' ? 'open my website' : label.toLowerCase() === 'ai' ? 'hello JARVIS' : label.toLowerCase() === 'projects' ? 'run my project' : label.toLowerCase() === 'github' ? 'check git status' : label.toLowerCase() === 'reminders' ? 'remember that my main website project is Final' : 'show system information') }>
                {label}
              </button>
            ))}
          </div>

          <div className="mini-panel">
            <p className="eyebrow">SYSTEM</p>
            <div className="stats-grid">
              <div><span>OS</span><strong>{system.os || 'Windows 11'}</strong></div>
              <div><span>CPU</span><strong>{system.cpu || 'Intel'}</strong></div>
              <div><span>RAM</span><strong>{system.ram?.total || 'N/A'}</strong></div>
              <div><span>Network</span><strong>{connectionState === 'connected' ? 'Connected' : 'Offline'}</strong></div>
            </div>
          </div>
        </aside>

        <main className="core-panel panel">
          <div className="core-label">JARVIS CORE</div>
          <div className={`jarvis-core state-${coreState}`}>
            <div className="ring ring-outer" />
            <div className="ring ring-mid" />
            <div className="ring ring-inner" />
            <div className="core-pulse" />
          </div>

          <div className="visualizer">
            {[...Array(24)].map((_, index) => (
              <span key={index} style={{ animationDelay: `${index * 0.08}s` }} />
            ))}
          </div>

          <div className="console-command">
            <button className="voice-button" onClick={startVoice}>
              {isListening ? 'LISTENING' : '🎤 VOICE'}
            </button>
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCommand();
              }}
              placeholder="Type a command..."
            />
            <button className="send-button" onClick={() => submitCommand()}>
              SEND
            </button>
          </div>
        </main>

        <aside className="right-panel panel">
          <div className="panel-title">TOOLS</div>
          <div className="tool-list">
            {toolList.slice(0, 8).map((tool) => (
              <div key={tool.name} className="tool-item">
                <span>{tool.name}</span>
                <em>{tool.riskLevel}</em>
              </div>
            ))}
          </div>

          <div className="mini-panel">
            <p className="eyebrow">ACTIVITY</p>
            <button className="clear-button" onClick={() => {
              setActivity([{ id: Date.now(), time: '00:00:00', message: 'LOG CLEARED' }]);
              fetch(`${API_BASE}/api/activity/clear`, { method: 'POST' });
            }}>
              CLEAR LOG
            </button>
          </div>
        </aside>

        <section className="chat-panel panel">
          <div className="panel-title">CHAT / COMMAND PANEL</div>
          <div className="messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <strong>{message.role === 'user' ? 'USER' : message.role === 'jarvis' ? 'JARVIS' : 'TOOL'}</strong>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="activity-panel panel">
          <div className="panel-title">ACTIVITY LOG</div>
          <ul className="activity-log">
            {activity.map((entry) => (
              <li key={entry.id}>
                <span>{entry.time}</span>
                <strong>{entry.message}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {pendingAction && (
        <div className="confirm-modal">
          <div className="modal-card panel">
            <p className="eyebrow">CONFIRMATION</p>
            <h3>JARVIS wants to perform this action</h3>
            <p>{pendingAction.description}</p>
            <div className="modal-actions">
              <button className="allow" onClick={() => handleConfirmation(true)}>Allow</button>
              <button className="cancel" onClick={() => handleConfirmation(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
