// DOM Elements
const commandInput = document.getElementById('commandInput');
const sendButton = document.getElementById('sendButton');
const responseArea = document.getElementById('responseArea');
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');


// Sample responses for demonstration
const sampleResponses = [
    "I'm processing your request...",
    "Here's what I found for you!",
    "I can help you with that!",
    "Let me check that information...",
    "Task completed successfully!",
    "Would you like me to elaborate on that?"
];

// Send Command Function
function sendCommand() {
    const command = commandInput.value.trim();
    
    if (!command) {
        addResponse("Please type a command first!", true);
        return;
    }
    
    // Add user command to response area
    addResponse(`You: ${command}`, false);
    
    // Clear input
    commandInput.value = '';
    
    // Simulate assistant thinking
    setTimeout(() => {
        const randomResponse = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
        addResponse(`Assistant: ${randomResponse}`, true);
    }, 1000);
}

// Add response to chat area
function addResponse(text, isAssistant) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isAssistant ? 'assistant' : 'user'}`;
    messageDiv.innerHTML = `
        <div class="message-bubble ${isAssistant ? 'assistant-bubble' : 'user-bubble'}">
            ${text}
        </div>
    `;
    
    responseArea.appendChild(messageDiv);
    responseArea.scrollTop = responseArea.scrollHeight;
}

// Event Listeners
sendButton.addEventListener('click', sendCommand);

commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendCommand();
    }
});

// Window Controls (using Electron's remote)
if (window.require) {
    const { remote } = window.require('electron');
    
    minimizeBtn.addEventListener('click', () => {
        remote.getCurrentWindow().minimize();
    });
    
    maximizeBtn.addEventListener('click', () => {
        const currentWindow = remote.getCurrentWindow();
        if (currentWindow.isMaximized()) {
            currentWindow.unmaximize();
        } else {
            currentWindow.maximize();
        }
    });
    
    closeBtn.addEventListener('click', () => {
        remote.getCurrentWindow().close();
    });
} else {
    // Fallback for browser testing
    console.log('Window controls would work in Electron app');
    
    minimizeBtn.addEventListener('click', () => {
        alert('Minimize would work in Electron');
    });
    
    maximizeBtn.addEventListener('click', () => {
        alert('Maximize would work in Electron');
    });
    
    closeBtn.addEventListener('click', () => {
        alert('Close would work in Electron');
    });
}

// Add some CSS for messages
const style = document.createElement('style');
style.textContent = `
    .message {
        margin: 10px 0;
        display: flex;
    }
    
    .message.user {
        justify-content: flex-end;
    }
    
    .message.assistant {
        justify-content: flex-start;
    }
    
    .message-bubble {
        max-width: 80%;
        padding: 10px 15px;
        border-radius: 20px;
        word-wrap: break-word;
    }
    
    .user-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom-right-radius: 5px;
    }
    
    .assistant-bubble {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border-bottom-left-radius: 5px;
        backdrop-filter: blur(10px);
    }
`;
document.head.appendChild(style);

// Initialize with welcome message
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        addResponse("Assistant: Hello! I'm your Smart Assistant. How can I help you today?", true);
    }, 1000);
});
const { ipcRenderer } = require('electron');

document.querySelector('.icon-btn').addEventListener('click', () => {
    ipcRenderer.send('open-pomodoro');
});