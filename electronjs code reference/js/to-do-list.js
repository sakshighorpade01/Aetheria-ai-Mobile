// ToDoList module - Using electron APIs exposed through contextBridge

class ToDoList {
    constructor() {
        this.tasks = [];
        this.userContext = {
            personal: {
                name: '',
                email: '',
                location: '',
                timezone: '',
                language: ''
            },
            preferences: {
                workingHours: '',
                communicationPreference: '',
                notificationPreference: '',
                taskPrioritization: ''
            },
            capabilities: {
                allowedActions: [],
                restrictedDomains: [],
                apiKeys: {},
                tools: []
            },
            goals: {
                shortTerm: [],
                longTerm: [],
                constraints: []
            },
            systemAccess: {
                filesystemAccess: false,
                networkAccess: false,
                apiAccess: false,
                credentials: {}
            }
        };
        this.elements = {};
        this.dataPath = {
            tasks: null,
            userContext: null
        };
    }

    async init() {
        await this._initializePaths();
        this.cacheElements();
        this.setupEventListeners();
        await this.loadData();
        this.renderTasks();
    }

    async _initializePaths() {
        try {
            // Get the app path from the main process
            const appPath = await window.electron.ipcRenderer.invoke('get-app-path');
            
            this.dataPath = {
                tasks: window.electron.path.join(appPath, 'tasklist.txt'),
                userContext: window.electron.path.join(appPath, 'user_context.txt')
            };
        } catch (error) {
            console.error('Failed to initialize paths:', error);
            // Fallback to relative paths if the IPC call fails
            this.dataPath = {
                tasks: 'tasklist.txt',
                userContext: 'user_context.txt'
            };
        }
    }

    async loadData() {
        try {
            // Load tasks
            if (window.electron.fs.existsSync(this.dataPath.tasks)) {
                const tasksData = window.electron.fs.readFileSync(this.dataPath.tasks, 'utf8');
                this.tasks = JSON.parse(tasksData || '[]');
            }

            // Load user context
            if (window.electron.fs.existsSync(this.dataPath.userContext)) {
                const contextData = window.electron.fs.readFileSync(this.dataPath.userContext, 'utf8');
                this.userContext = JSON.parse(contextData || '{}');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error loading data', 'error');
        }
    }

    saveData() {
        try {
            // Save tasks
            window.electron.fs.writeFileSync(
                this.dataPath.tasks, 
                JSON.stringify(this.tasks, null, 2),
                'utf8'
            );

            // Save user context
            window.electron.fs.writeFileSync(
                this.dataPath.userContext,
                JSON.stringify(this.userContext, null, 2),
                'utf8'
            );

            this.showToast('Changes saved successfully', 'success');
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast('Error saving data', 'error');
        }
    }

    showToast(message, type = 'success') {
        window.NotificationService.show(message, type);
    }

    cacheElements() {
        this.elements = {
            taskList: document.getElementById('task-list'),
            addTaskBtn: document.getElementById('add-task-btn'),
            contextBtn: document.getElementById('context-btn'),
            newTaskModal: document.getElementById('new-task-modal'),
            taskNameInput: document.getElementById('task-name'),
            taskDescriptionInput: document.getElementById('task-description'),
            taskPriorityInput: document.getElementById('task-priority'),
            taskDeadlineInput: document.getElementById('task-deadline'),
            taskTagsInput: document.getElementById('task-tags'),
            saveTaskBtn: document.getElementById('save-task-btn'),
            cancelTaskBtn: document.getElementById('cancel-task-btn'),
            userContextModal: document.getElementById('user-context-modal'),
            userNameInput: document.getElementById('user-name'),
            userEmailInput: document.getElementById('user-email'),
            userLocationInput: document.getElementById('user-location'),
            userTimezoneInput: document.getElementById('user-timezone'),
            userLanguageInput: document.getElementById('user-language'),
            workingHoursInput: document.getElementById('working-hours'),
            communicationPrefInput: document.getElementById('communication-preference'),
            notificationPrefInput: document.getElementById('notification-preference'),
            taskPrioritizationInput: document.getElementById('task-prioritization'),
            allowedActionsInput: document.getElementById('allowed-actions'),
            restrictedDomainsInput: document.getElementById('restricted-domains'),
            apiKeysInput: document.getElementById('api-keys'),
            toolsInput: document.getElementById('tools'),
            shortTermGoalsInput: document.getElementById('short-term-goals'),
            longTermGoalsInput: document.getElementById('long-term-goals'),
            constraintsInput: document.getElementById('constraints'),
            filesystemAccessInput: document.getElementById('filesystem-access'),
            networkAccessInput: document.getElementById('network-access'),
            apiAccessInput: document.getElementById('api-access'),
            credentialsInput: document.getElementById('credentials'),
            saveContextBtn: document.getElementById('save-context-btn'),
            cancelContextBtn: document.getElementById('cancel-context-btn')
        };
    }

    setupEventListeners() {
        this.elements.addTaskBtn.addEventListener('click', () => this.openNewTaskModal());
        this.elements.saveTaskBtn.addEventListener('click', () => this.saveNewTask());
        this.elements.cancelTaskBtn.addEventListener('click', () => this.closeNewTaskModal());
        this.elements.contextBtn.addEventListener('click', () => this.openContextModal());
        this.elements.saveContextBtn.addEventListener('click', () => this.saveUserContext());
        this.elements.cancelContextBtn.addEventListener('click', () => this.closeContextModal());

        this.elements.newTaskModal.addEventListener('click', (e) => {
            if (e.target === this.elements.newTaskModal) this.closeNewTaskModal();
        });
        this.elements.userContextModal.addEventListener('click', (e) => {
            if (e.target === this.elements.userContextModal) this.closeContextModal();
        });
    }

    openNewTaskModal() {
        this.elements.newTaskModal.classList.remove('hidden');
        this.elements.taskNameInput.focus();
    }

    closeNewTaskModal() {
        this.elements.newTaskModal.classList.add('hidden');
        this.elements.taskNameInput.value = '';
        this.elements.taskDescriptionInput.value = '';
        this.elements.taskPriorityInput.value = 'medium';
        this.elements.taskDeadlineInput.value = '';
        this.elements.taskTagsInput.value = '';
    }

    saveNewTask() {
        const taskName = this.elements.taskNameInput.value.trim();
        if (!taskName) return;

        const newTask = {
            id: Date.now(),
            text: taskName,
            description: this.elements.taskDescriptionInput.value.trim() || null,
            priority: this.elements.taskPriorityInput.value || 'medium',
            deadline: this.elements.taskDeadlineInput.value || null,
            tags: this.elements.taskTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.tasks.push(newTask);
        this.saveData();
        this.renderTasks();
        this.closeNewTaskModal();
    }

    toggleComplete(taskId) {
        this.tasks = this.tasks.map(task => 
            task.id === taskId ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() } : task
        );
        this.saveData();
        this.renderTasks();
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        this.saveData();
        this.renderTasks();
    }

    openContextModal() {
        this.elements.userContextModal.classList.remove('hidden');
        const context = this.userContext;
        this.elements.userNameInput.value = context.personal.name || '';
        this.elements.userEmailInput.value = context.personal.email || '';
        this.elements.userLocationInput.value = context.personal.location || '';
        this.elements.userTimezoneInput.value = context.personal.timezone || '';
        this.elements.userLanguageInput.value = context.personal.language || '';
        this.elements.workingHoursInput.value = context.preferences.workingHours || '';
        this.elements.communicationPrefInput.value = context.preferences.communicationPreference || '';
        this.elements.notificationPrefInput.value = context.preferences.notificationPreference || '';
        this.elements.taskPrioritizationInput.value = context.preferences.taskPrioritization || '';
        this.elements.allowedActionsInput.value = context.capabilities.allowedActions.join(',') || '';
        this.elements.restrictedDomainsInput.value = context.capabilities.restrictedDomains.join(',') || '';
        this.elements.apiKeysInput.value = JSON.stringify(context.capabilities.apiKeys, null, 2) || '{}';
        this.elements.toolsInput.value = context.capabilities.tools.join(',') || '';
        this.elements.shortTermGoalsInput.value = context.goals.shortTerm.join(',') || '';
        this.elements.longTermGoalsInput.value = context.goals.longTerm.join(',') || '';
        this.elements.constraintsInput.value = context.goals.constraints.join(',') || '';
        this.elements.filesystemAccessInput.checked = context.systemAccess.filesystemAccess;
        this.elements.networkAccessInput.checked = context.systemAccess.networkAccess;
        this.elements.apiAccessInput.checked = context.systemAccess.apiAccess;
        this.elements.credentialsInput.value = JSON.stringify(context.systemAccess.credentials, null, 2) || '{}';
    }

    closeContextModal() {
        this.elements.userContextModal.classList.add('hidden');
    }

    saveUserContext() {
        try {
            this.userContext = {
                personal: {
                    name: this.elements.userNameInput.value.trim(),
                    email: this.elements.userEmailInput.value.trim(),
                    location: this.elements.userLocationInput.value.trim(),
                    timezone: this.elements.userTimezoneInput.value.trim(),
                    language: this.elements.userLanguageInput.value.trim()
                },
                preferences: {
                    workingHours: this.elements.workingHoursInput.value.trim(),
                    communicationPreference: this.elements.communicationPrefInput.value,
                    notificationPreference: this.elements.notificationPrefInput.value,
                    taskPrioritization: this.elements.taskPrioritizationInput.value
                },
                capabilities: {
                    allowedActions: this.elements.allowedActionsInput.value.split(',').map(x => x.trim()).filter(Boolean),
                    restrictedDomains: this.elements.restrictedDomainsInput.value.split(',').map(x => x.trim()).filter(Boolean),
                    apiKeys: JSON.parse(this.elements.apiKeysInput.value || '{}'),
                    tools: this.elements.toolsInput.value.split(',').map(x => x.trim()).filter(Boolean)
                },
                goals: {
                    shortTerm: this.elements.shortTermGoalsInput.value.split(',').map(x => x.trim()).filter(Boolean),
                    longTerm: this.elements.longTermGoalsInput.value.split(',').map(x => x.trim()).filter(Boolean),
                    constraints: this.elements.constraintsInput.value.split(',').map(x => x.trim()).filter(Boolean)
                },
                systemAccess: {
                    filesystemAccess: this.elements.filesystemAccessInput.checked,
                    networkAccess: this.elements.networkAccessInput.checked,
                    apiAccess: this.elements.apiAccessInput.checked,
                    credentials: JSON.parse(this.elements.credentialsInput.value || '{}')
                }
            };

            this.saveData();
            this.closeContextModal();
        } catch (error) {
            console.error('Error saving user context:', error);
            this.showToast('Error saving user context', 'error');
        }
    }

    renderTasks() {
        this.elements.taskList.innerHTML = '';
        this.tasks.forEach((task) => {
            const listItem = document.createElement('li');
            listItem.dataset.id = task.id;
            if (task.completed) listItem.classList.add('completed');
            if (task.priority) listItem.dataset.priority = task.priority;

            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('checkbox-wrapper');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.id = `checkbox-${task.id}`;
            checkbox.addEventListener('change', () => this.toggleComplete(task.id));

            const checkmark = document.createElement('label');
            checkmark.classList.add('checkmark');
            checkmark.htmlFor = checkbox.id;
            checkmark.innerHTML = '<i class="fas fa-check"></i>';

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(checkmark);

            const taskDetails = document.createElement('div');
            taskDetails.classList.add('task-details');

            const taskText = document.createElement('span');
            taskText.classList.add('task-text');
            taskText.textContent = task.text;
            taskDetails.appendChild(taskText);

            if (task.description) {
                const description = document.createElement('span');
                description.classList.add('task-description');
                description.textContent = task.description;
                taskDetails.appendChild(description);
            }

            if (task.deadline) {
                const deadline = document.createElement('div');
                deadline.classList.add('task-deadline');
                deadline.innerHTML = `<i class="fas fa-clock"></i>${new Date(task.deadline).toLocaleString()}`;
                taskDetails.appendChild(deadline);
            }

            if (task.tags && task.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.classList.add('task-tags');
                task.tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.classList.add('task-tag');
                    tagElement.textContent = tag;
                    tagsContainer.appendChild(tagElement);
                });
                taskDetails.appendChild(tagsContainer);
            }

            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('button-container');

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-btn');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.addEventListener('click', () => this.deleteTask(task.id));

            buttonContainer.appendChild(deleteButton);

            listItem.appendChild(checkboxWrapper);
            listItem.appendChild(taskDetails);
            listItem.appendChild(buttonContainer);

            this.elements.taskList.appendChild(listItem);
        });
    }
}

window.todo = new ToDoList();