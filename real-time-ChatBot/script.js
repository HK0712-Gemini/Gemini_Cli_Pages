document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        apiKeyInput: document.getElementById('api-key'),
        saveKeyButton: document.getElementById('save-key'),
        chatHistory: document.getElementById('chat-history'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        newChatButton: document.getElementById('new-chat-button'),
        chatList: document.getElementById('chat-list'),
        chatTitle: document.getElementById('chat-title'),
        deleteChatButton: document.getElementById('delete-chat-button'),
    };

    // Application State
    let state = {
        apiKey: null,
        chats: {},
        currentChatId: null,
    };

    // --- State Management ---
    function saveState() {
        localStorage.setItem('gemini-chat-app-state', JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem('gemini-chat-app-state');
        if (savedState) {
            state = JSON.parse(savedState);
            elements.apiKeyInput.value = state.apiKey || '';
            if (state.apiKey) {
                enableChatInputs();
            }
        }
        if (!state.chats || Object.keys(state.chats).length === 0) {
            createNewChat(false); // Create first chat without saving yet
        }
    }

    // --- Rendering ---
    function renderChatList() {
        elements.chatList.innerHTML = '';
        Object.values(state.chats).forEach(chat => {
            const li = document.createElement('li');
            li.dataset.chatId = chat.id;
            li.textContent = chat.title;
            if (chat.id === state.currentChatId) {
                li.classList.add('active');
            }
            elements.chatList.appendChild(li);
        });
    }

    function renderCurrentChat() {
        elements.chatHistory.innerHTML = '';
        const currentChat = state.chats[state.currentChatId];
        if (!currentChat) return;

        elements.chatTitle.textContent = currentChat.title;
        currentChat.history.forEach(message => {
            // The initial message might not have parts
            if (message.parts && message.parts[0].text) {
                addMessageToHistory(message.role, message.parts[0].text);
            }
        });
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
    }
    
    function renderAll() {
        renderChatList();
        renderCurrentChat();
    }

    // --- Chat Actions ---
    function createNewChat(save = true) {
        const newChatId = `chat-${Date.now()}`;
        const newChat = {
            id: newChatId,
            title: `New Chat ${Object.keys(state.chats).length + 1}`,
            history: [],
        };
        state.chats[newChatId] = newChat;
        state.currentChatId = newChatId;
        
        if (save) {
            renderAll();
            saveState();
        }
    }

    function switchChat(chatId) {
        if (state.chats[chatId]) {
            state.currentChatId = chatId;
            renderAll();
            saveState();
        }
    }

    function deleteCurrentChat() {
        const chatIdToDelete = state.currentChatId;
        if (Object.keys(state.chats).length <= 1) {
            alert("You can't delete the last chat!");
            return;
        }

        delete state.chats[chatIdToDelete];
        
        state.currentChatId = Object.keys(state.chats)[0];
        
        renderAll();
        saveState();
    }

    function addMessageToHistory(role, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role === 'user' ? 'user-message' : 'bot-message');
        
        const paragraph = document.createElement('p');
        paragraph.innerHTML = marked.parse(text);
        messageElement.appendChild(paragraph);
        
        elements.chatHistory.appendChild(messageElement);
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
    }
    
    function enableChatInputs() {
        elements.messageInput.disabled = false;
        elements.sendButton.disabled = false;
    }

    // --- Main Send Logic ---
    async function sendMessage() {
        const messageText = elements.messageInput.value.trim();
        if (!messageText || !state.apiKey) return;

        const currentChat = state.chats[state.currentChatId];
        currentChat.history.push({ role: 'user', parts: [{ text: messageText }] });
        
        if (currentChat.history.length === 1 && currentChat.title.startsWith('New Chat')) {
            currentChat.title = messageText.substring(0, 30);
        }

        renderAll(); // Re-render to show user message immediately
        elements.messageInput.value = '';
        elements.sendButton.disabled = true;

        const botMessageElement = document.createElement('div');
        botMessageElement.classList.add('message', 'bot-message');
        const paragraph = document.createElement('p');
        paragraph.innerHTML = marked.parse('...');
        botMessageElement.appendChild(paragraph);
        elements.chatHistory.appendChild(botMessageElement);
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;

        let fullResponse = "";
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: state.apiKey, history: currentChat.history }),
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Unknown error');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6);
                            const data = JSON.parse(jsonStr);
                            if (data.candidates && data.candidates[0].content.parts[0].text) {
                                fullResponse += data.candidates[0].content.parts[0].text;
                                paragraph.innerHTML = marked.parse(fullResponse + ' ▌'); // Add a cursor
                            }
                        } catch (e) { /* Ignore parsing errors on incomplete chunks */ }
                    }
                }
            }
            paragraph.innerHTML = marked.parse(fullResponse);
            currentChat.history.push({ role: 'model', parts: [{ text: fullResponse }] });

        } catch (error) {
            paragraph.innerHTML = `<strong>Error:</strong> ${error.message}`;
            currentChat.history.push({ role: 'model', parts: [{ text: `Error: ${error.message}` }] });
        } finally {
            elements.sendButton.disabled = false;
            elements.messageInput.focus();
            saveState(); // Save the complete conversation
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        elements.saveKeyButton.addEventListener('click', () => {
            const key = elements.apiKeyInput.value.trim();
            if (key) {
                state.apiKey = key;
                saveState();
                alert('API Key saved!');
                enableChatInputs();
            }
        });
        
        elements.newChatButton.addEventListener('click', () => createNewChat(true));
        elements.deleteChatButton.addEventListener('click', deleteCurrentChat);
        
        elements.chatList.addEventListener('click', (e) => {
            if (e.target && e.target.tagName === 'LI') {
                switchChat(e.target.dataset.chatId);
            }
        });
        
        elements.sendButton.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // --- Initialization ---
    function init() {
        loadState();
        renderAll();
        setupEventListeners();
    }

    init();
});