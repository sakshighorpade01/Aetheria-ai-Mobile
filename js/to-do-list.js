// js/to-do-list.js (Updated)

import NotificationService from './notification-service.js';

export class ToDoList {
    constructor() {
        this.tasks = [];
        this.elements = {};
        this.triggerButton = null; // Track which nav button opened this
        this.notificationService = new NotificationService();
    }

    async init() {
        this.cacheElements();
        this.setupEventListeners();
        this.registerFloatingWindow();
        await this.loadData();
        this.renderTasks();
    }

    cacheElements() {
        this.elements = {
            container: document.getElementById('to-do-list-container'),
            panel: document.querySelector('.to-do-list-panel'),
            closeBtn: document.querySelector('.to-do-list-header .close-btn'),

            taskList: document.getElementById('task-list'),
            addTaskBtn: document.getElementById('add-task-btn'),
            newTaskModal: document.getElementById('new-task-modal'),
            taskNameInput: document.getElementById('task-name'),
            saveTaskBtn: document.getElementById('save-task-btn'),
            cancelTaskBtn: document.getElementById('cancel-task-btn'),
            contextBtn: document.getElementById('context-btn'),
            userContextModal: document.getElementById('user-context-modal'),
            saveContextBtn: document.getElementById('save-context-btn'),
            cancelContextBtn: document.getElementById('cancel-context-btn'),
        };
    }

    setupEventListeners() {
        this.elements.closeBtn?.addEventListener('click', () => this.toggleWindow(false));
        this.elements.container?.addEventListener('click', (e) => {
            if (e.target === this.elements.container) {
                this.toggleWindow(false);
            }
        });

        this.elements.addTaskBtn?.addEventListener('click', () => this.openNewTaskModal());
        this.elements.saveTaskBtn?.addEventListener('click', () => this.saveNewTask());
        this.elements.cancelTaskBtn?.addEventListener('click', () => {
            this.closeNewTaskModal();
        });

        this.elements.contextBtn?.addEventListener('click', () => this.openUserContextModal());
        this.elements.saveContextBtn?.addEventListener('click', () => this.saveUserContext());
        this.elements.cancelContextBtn?.addEventListener('click', () => {
            this.closeUserContextModal();
        });
    }

    toggleWindow(show, buttonElement = null) {
        if (!this.elements.container) return;

        if (show && buttonElement) {
            this.triggerButton = buttonElement;
        }

        this.elements.container.classList.toggle('hidden', !show);

        if (!show && this.triggerButton) {
            this.triggerButton.classList.remove('active');
            this.triggerButton = null;
        }

        // Inform chat module so shuffle menu stays in sync
        if (window.chat?.setTasksVisibility) {
            window.chat.setTasksVisibility(show, { source: 'tasksModal' });
        }
    }

    openNewTaskModal() {
        this.elements.newTaskModal?.classList.remove('hidden');
    }

    closeNewTaskModal() {
        this.elements.newTaskModal?.classList.add('hidden');
        const form = this.elements.newTaskModal?.querySelector('.modal-content');
        if (form) {
            form.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.type === 'checkbox') el.checked = false;
                else el.value = '';
            });
        }
    }

    async loadData() {
        try {
            const data = localStorage.getItem('aios_tasks');
            const parsedData = data ? JSON.parse(data) : [];
            // Ensure every task has a `tags` array to prevent errors
            this.tasks = parsedData.map(task => ({
                ...task,
                tags: task.tags || [] 
            }));
        } catch (e) {
            console.error("Failed to load tasks from localStorage", e);
            this.tasks = [];
        }
    }

    saveData() {
        localStorage.setItem('aios_tasks', JSON.stringify(this.tasks));
    }

    saveNewTask() {
        const taskName = this.elements.taskNameInput.value.trim();
        if (!taskName) {
            this.showNotification('Task name is required.', 'warning');
            return;
        }

        const newTask = {
            id: Date.now(),
            text: taskName,
            description: document.getElementById('task-description')?.value.trim() || '',
            priority: document.getElementById('task-priority')?.value || 'low',
            deadline: document.getElementById('task-deadline')?.value || '',
            tags: (document.getElementById('task-tags')?.value || '')
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag),
            completed: false
        };

        this.tasks.push(newTask);
        this.saveData();
        this.renderTasks();
        this.closeNewTaskModal();
    }

    renderTasks() {
        if (!this.elements.taskList) return;
        this.elements.taskList.innerHTML = '';

        this.tasks.forEach(task => {
            const listItem = document.createElement('li');
            listItem.dataset.id = task.id;
            listItem.dataset.priority = task.priority;
            if (task.completed) listItem.classList.add('completed');

            // CRITICAL FIX: Ensure task.tags exists before trying to access .length
            const tagsHTML = (task.tags && task.tags.length) 
                ? `<div class="task-tags">${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join(' ')}</div>` 
                : '';

            listItem.innerHTML = `
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
                    <label class="checkmark" for="task-${task.id}">
                        <i class="fas fa-check"></i>
                    </label>
                </div>
                <div class="task-details">
                    <span class="task-text">${task.text}</span>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    ${task.deadline ? `<div class="task-deadline"><i class="fas fa-clock"></i> ${new Date(task.deadline).toLocaleString()}</div>` : ''}
                    ${tagsHTML}
                </div>
                <div class="button-container">
                    <button class="delete-btn" title="Delete Task"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;

            listItem.querySelector('input[type="checkbox"]')?.addEventListener('change', (e) => {
                this.toggleTaskCompletion(task.id, e.target.checked);
            });

            listItem.querySelector('.delete-btn')?.addEventListener('click', () => {
                this.deleteTask(task.id);
            });

            this.elements.taskList.appendChild(listItem);
        });
    }

    toggleTaskCompletion(taskId, isCompleted) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = isCompleted;
            this.saveData();
            this.renderTasks();
        }
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveData();
            this.renderTasks();
            this.showNotification('Task removed.', 'info');
        }
    }

    openUserContextModal() {
        this.elements.userContextModal?.classList.remove('hidden');
    }

    closeUserContextModal() {
        this.elements.userContextModal?.classList.add('hidden');
    }

    saveUserContext() {
        this.showNotification('User context saved.', 'success');
        this.closeUserContextModal();
    }

    registerFloatingWindow() {
        if (this.elements.container && window.chat?.registerFloatingWindow) {
            window.chat.registerFloatingWindow('tasks', this.elements.container);
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        if (this.notificationService) {
            this.notificationService.show(message, type, duration);
        }
    }
}