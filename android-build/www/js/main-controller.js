import { AIOS } from './aios.js';
import { chatModule } from './chat.js';
import { ToDoList } from './to-do-list.js';
import ContextHandler from './context-handler.js';

class MainController {
    constructor() {
        this.elements = {};
        this.modules = {};
    }

    init() {
        this.cacheElements();
        this.initModules(); // Initialize modules first
        this.bindEvents();  // Then bind events to the now-ready modules
        this.switchView('chat');
    }

    cacheElements() {
        this.elements = {
            mainAppWrapper: document.getElementById('main-app-wrapper'),
            settingsView: document.getElementById('settings-view'),
            menuBtn: document.getElementById('menu-btn'),
            settingsBackBtn: document.getElementById('settings-back-btn'),
            topNavTitle: document.getElementById('top-nav-title'),
            newChatBtn: document.getElementById('new-chat-btn'),
            mainViews: document.querySelectorAll('.main-view'),
            bottomNavButtons: document.querySelectorAll('.bottom-nav-btn'),
            chatInputArea: document.getElementById('chat-input-area'),
            chatInput: document.getElementById('chat-input'),
            sendBtn: document.getElementById('send-btn'), // Explicitly cache send button
            contextWindow: document.getElementById('context-window'),
        };
    }

    bindEvents() {
        this.elements.menuBtn.addEventListener('click', () => this.toggleSettingsView(true));
        this.elements.settingsBackBtn.addEventListener('click', () => this.toggleSettingsView(false));

        this.elements.bottomNavButtons.forEach(button => {
            button.addEventListener('click', () => this.switchView(button.dataset.view));
        });

        this.elements.newChatBtn.addEventListener('click', () => {
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) chatMessages.innerHTML = '';
            alert('New chat started!');
        });
        
        this.elements.chatInput.addEventListener('input', () => {
            this.elements.chatInput.style.height = 'auto';
            this.elements.chatInput.style.height = `${this.elements.chatInput.scrollHeight}px`;
        });

        // FIXED: Bind the send button click to the chat module's handler
        this.elements.sendBtn.addEventListener('click', () => {
            this.modules.chat.handleSendMessage();
        });
        
        // FIXED: Bind the enter key press to the chat module's handler
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.modules.chat.handleSendMessage();
            }
        });
    }

    initModules() {
        this.modules.aios = new AIOS();
        this.modules.aios.init();

        this.modules.chat = chatModule;
        this.modules.chat.init();

        this.modules.todo = new ToDoList();
        this.modules.todo.init();
        
        this.modules.context = new ContextHandler();
        this.modules.context.initializeElements();
        this.modules.context.bindEvents();
    }

    toggleSettingsView(show) {
        this.elements.settingsView.classList.toggle('visible', show);
        this.elements.mainAppWrapper.style.display = show ? 'none' : 'flex';
    }

    switchView(viewName) {
        const activeButton = document.querySelector(`.bottom-nav-btn[data-view="${viewName}"]`);
        this.elements.topNavTitle.textContent = activeButton.dataset.title;

        this.elements.bottomNavButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        this.elements.mainViews.forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}-view`);
        });
        
        this.elements.chatInputArea.style.display = (viewName === 'chat') ? 'flex' : 'none';
        
        if (viewName === 'memory') {
            this.modules.context.loadSessions();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new MainController();
    app.init();
});