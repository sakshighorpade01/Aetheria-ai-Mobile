// js/to-do-list.js
import NotificationService from './notification-service.js';
import { supabase } from './supabase-client.js';

export class ToDoList {
    constructor() {
        this.tasks = [];
        this.elements = {};
        this.triggerButton = null;
        this.notificationService = new NotificationService();
        this.subscription = null;
    }

    async init() {
        this.cacheElements();
        this.setupEventListeners();
        this.registerFloatingWindow();

        // Wait for auth to be ready
        await this.waitForAppReady();

        // Initial fetch
        await this.fetchTasks();

        // Setup realtime
        this.setupRealtimeSubscription();
    }

    async waitForAppReady() {
        // Wait until we have a session
        let attempts = 0;
        while (attempts < 30) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) return true;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }
        console.warn('ToDoList: Auth session not found after waiting.');
        return false;
    }

    cacheElements() {
        this.elements = {
            container: document.getElementById('to-do-list-container'),
            panel: document.querySelector('.to-do-list-panel'),
            closeBtn: document.querySelector('.to-do-list-header .close-btn'),

            taskList: document.getElementById('task-list'),
            addTaskBtn: document.getElementById('add-task-btn'),
            newTaskModal: document.getElementById('new-task-modal'),

            // Cached Inputs
            taskNameInput: document.getElementById('task-name'),
            taskDescriptionInput: document.getElementById('task-description'),
            taskPriorityInput: document.getElementById('task-priority'),
            taskDeadlineInput: document.getElementById('task-deadline'),
            taskTagsInput: document.getElementById('task-tags'),

            saveTaskBtn: document.getElementById('save-task-btn'),
            cancelTaskBtn: document.getElementById('cancel-task-btn'),

            // Task Work Modal Elements
            taskWorkModal: document.getElementById('task-work-modal'),
            taskWorkContent: document.getElementById('task-work-content'),
            taskWorkCloseBtn: document.querySelector('.task-work-modal-close'),

            // User Context
            contextBtn: document.getElementById('context-btn'),
            userContextModal: document.getElementById('user-context-modal'),
            saveContextBtn: document.getElementById('save-context-btn'),
            cancelContextBtn: document.getElementById('cancel-context-btn'),
        };
    }

    setupEventListeners() {
        // Main Panel
        this.elements.closeBtn?.addEventListener('click', () => this.toggleWindow(false));
        this.elements.container?.addEventListener('click', (e) => {
            if (e.target === this.elements.container) {
                this.toggleWindow(false);
            }
        });

        // Add Task
        this.elements.addTaskBtn?.addEventListener('click', () => this.openNewTaskModal());
        this.elements.saveTaskBtn?.addEventListener('click', () => this.saveNewTask());
        this.elements.cancelTaskBtn?.addEventListener('click', () => this.closeNewTaskModal());

        // Task Work Modal
        this.elements.taskWorkCloseBtn?.addEventListener('click', () => this.closeTaskWorkModal());
        this.elements.taskWorkModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.taskWorkModal) {
                this.closeTaskWorkModal();
            }
        });

        // Context (Placeholder)
        this.elements.contextBtn?.addEventListener('click', () => this.openUserContextModal());
        this.elements.saveContextBtn?.addEventListener('click', () => this.saveUserContext());
        this.elements.cancelContextBtn?.addEventListener('click', () => this.closeUserContextModal());
    }

    toggleWindow(show, buttonElement = null) {
        if (!this.elements.container) return;

        if (show && buttonElement) {
            this.triggerButton = buttonElement;
        }

        this.elements.container.classList.toggle('hidden', !show);

        // Add body class for layout shifts if needed
        if (show) document.body.classList.add('tasks-panel-open');
        else document.body.classList.remove('tasks-panel-open');

        if (!show && this.triggerButton) {
            this.triggerButton.classList.remove('active');
            this.triggerButton = null;
        }

        if (window.chat?.setTasksVisibility) {
            window.chat.setTasksVisibility(show, { source: 'tasksModal' });
        }
    }

    setupRealtimeSubscription() {
        this.subscription = supabase
            .channel('tasks_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
                console.log('Realtime update:', payload);
                // Refresh list on any change
                this.fetchTasks();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('ToDoList: Subscribed to realtime updates');
                }
            });
    }

    async fetchTasks() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return; // Should not happen if waitForAppReady passes

            console.log('Fetching tasks for user:', user.id);
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log('Tasks fetched:', data?.length);
            this.tasks = data || [];
            this.renderTasks();
        } catch (err) {
            console.error('Error fetching tasks:', err);
            this.showNotification('Failed to fetch tasks', 'error');
        }
    }

    async saveNewTask() {
        const taskName = this.elements.taskNameInput.value.trim();
        if (!taskName) {
            this.showNotification('Task name is required.', 'warning');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                this.showNotification('You must be logged in to create tasks.', 'error');
                return;
            }

            const rawTags = this.elements.taskTagsInput.value || '';
            const tagsArray = rawTags.split(',').map(t => t.trim()).filter(t => t);

            // Generate UUID for the task to ensure ID consistency
            const taskId = crypto.randomUUID();

            const newTask = {
                id: taskId,
                user_id: user.id,
                text: taskName,
                description: this.elements.taskDescriptionInput.value.trim() || null,
                priority: this.elements.taskPriorityInput.value || 'medium',
                status: 'pending',
                deadline: this.elements.taskDeadlineInput.value || null,
                tags: tagsArray,
                created_at: new Date().toISOString(),
                metadata: { source: 'pwa', user_agent: navigator.userAgent }
            };

            // Use select() to return the inserted data to verify it hit the DB
            const { data, error } = await supabase
                .from('tasks')
                .insert([newTask])
                .select();

            if (error) {
                console.error('Supabase Insert Error:', error);
                throw error;
            }

            console.log('Task inserted successfully:', data);

            this.showNotification('Task created successfully', 'success');
            this.closeNewTaskModal();

            // Optimistic update not strictly needed if realtime is fast/active, 
            // but we call fetch to be sure
            await this.fetchTasks();

        } catch (err) {
            console.error('Error creating task:', err);
            this.showNotification('Failed to create task: ' + err.message, 'error');
        }
    }

    async toggleTaskCompletion(taskId, isChecked) {
        // If checked, mark as completed. If unchecked, revert to pending.
        const newStatus = isChecked ? 'completed' : 'pending';
        const completedAt = isChecked ? new Date().toISOString() : null;

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ status: newStatus, completed_at: completedAt })
                .eq('id', taskId);

            if (error) throw error;

            // Re-fetch handled by realtime usually, but local update helps UI responsiveness
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                this.renderTasks();
            }
        } catch (err) {
            console.error('Error updating task:', err);
            this.showNotification('Failed to update task', 'error');
            // Revert UI if failed
            await this.fetchTasks();
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            this.showNotification('Task removed', 'info');
            // Realtime handles refetch
        } catch (err) {
            console.error('Error deleting task:', err);
            this.showNotification('Failed to delete task', 'error');
        }
    }

    renderTasks() {
        if (!this.elements.taskList) return;
        this.elements.taskList.innerHTML = '';

        if (this.tasks.length === 0) {
            this.elements.taskList.innerHTML = '<li class="empty-state">No tasks found. Create one to get started!</li>';
            return;
        }

        this.tasks.forEach(task => {
            const listItem = document.createElement('li');
            listItem.dataset.id = task.id;
            listItem.dataset.priority = task.priority;

            const isCompleted = task.status === 'completed';
            if (isCompleted) listItem.classList.add('completed');

            // --- Header Row ---
            const headerRow = document.createElement('div');
            headerRow.className = 'task-header-row';

            // Checkbox
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'checkbox-wrapper';
            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="task-${task.id}" ${isCompleted ? 'checked' : ''}>
                <label class="checkmark" for="task-${task.id}">
                    <i class="fas fa-check"></i>
                </label>
            `;
            // Listener for checkbox
            const checkbox = checkboxWrapper.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation(); // Prevent toggling accordion
                this.toggleTaskCompletion(task.id, e.target.checked);
            });

            // Title
            const titleSpan = document.createElement('span');
            titleSpan.className = 'task-text';
            titleSpan.textContent = this.escapeHtml(task.text);
            // Click title to toggle
            titleSpan.addEventListener('click', () => listItem.classList.toggle('expanded'));

            // Toggle Button (Chevron)
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'task-toggle-btn';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                listItem.classList.toggle('expanded');
            });

            headerRow.appendChild(checkboxWrapper);
            headerRow.appendChild(titleSpan);
            headerRow.appendChild(toggleBtn);

            // --- Expanded Content Body ---
            const expandedContent = document.createElement('div');
            expandedContent.className = 'task-expanded-content';

            // Description
            if (task.description) {
                const desc = document.createElement('div');
                desc.className = 'task-description';
                desc.textContent = task.description;
                expandedContent.appendChild(desc);
            }

            // Tags
            if (task.tags && task.tags.length > 0) {
                const tagsDiv = document.createElement('div');
                tagsDiv.className = 'task-tags';
                tagsDiv.innerHTML = task.tags.map(tag => `<span class="task-tag">${this.escapeHtml(tag)}</span>`).join('');
                expandedContent.appendChild(tagsDiv);
            }

            // Footer Row (Date, Status, Actions)
            const footerRow = document.createElement('div');
            footerRow.className = 'task-footer-row';

            // Deadline / Date
            const dateDiv = document.createElement('div');
            if (task.deadline) {
                dateDiv.className = 'task-deadline';
                dateDiv.innerHTML = `<i class="fas fa-clock"></i> ${new Date(task.deadline).toLocaleString()}`;
                footerRow.appendChild(dateDiv);
            }

            // Status Badge (if processing)
            if (task.status === 'in_progress') {
                const statusBadge = document.createElement('div');
                statusBadge.className = 'status-indicator status-in-progress';
                statusBadge.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing';
                footerRow.appendChild(statusBadge);
            }

            // Actions Wrapper (Vertical Stack: View Work above Delete)
            const actionsWrapper = document.createElement('div');
            actionsWrapper.className = 'task-actions-wrapper';

            // View Work Button (Icon Only)
            if (task.task_work && task.task_work.trim().length > 0) {
                const viewWorkBtn = document.createElement('button');
                viewWorkBtn.className = 'view-work-btn';
                viewWorkBtn.title = "View Work";
                viewWorkBtn.innerHTML = '<i class="fas fa-file-alt"></i>'; // Icon only
                viewWorkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showTaskWorkModal(task.task_work);
                });
                actionsWrapper.appendChild(viewWorkBtn);
            }

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = "Delete Task";
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTask(task.id);
            });
            actionsWrapper.appendChild(deleteBtn);

            footerRow.appendChild(actionsWrapper);

            expandedContent.appendChild(footerRow);

            // Assemble List Item
            listItem.appendChild(headerRow);
            listItem.appendChild(expandedContent);

            this.elements.taskList.appendChild(listItem);
        });
    }

    showTaskWorkModal(content) {
        if (!this.elements.taskWorkContent || !this.elements.taskWorkModal) return;

        // Parse Markdown
        if (typeof marked !== 'undefined') {
            // Configure marked for custom renderer if needed, or just use parse
            this.elements.taskWorkContent.innerHTML = marked.parse(content);

            // Highlight code blocks and add copy buttons
            if (typeof hljs !== 'undefined') {
                this.elements.taskWorkContent.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                    this.addCopyButton(block);
                });
            }

            // Render Mermaid diagrams
            if (typeof mermaid !== 'undefined') {
                const mermaidBlocks = this.elements.taskWorkContent.querySelectorAll('.language-mermaid');
                mermaidBlocks.forEach((block, index) => {
                    const div = document.createElement('div');
                    div.classList.add('mermaid');
                    div.textContent = block.textContent;
                    div.id = `mermaid-chart-${Date.now()}-${index}`;
                    block.parentElement.replaceWith(div);
                });

                try {
                    mermaid.init(undefined, this.elements.taskWorkContent.querySelectorAll('.mermaid'));
                } catch (e) {
                    console.error('Mermaid init failed', e);
                }
            }

        } else {
            this.elements.taskWorkContent.textContent = content;
        }

        this.elements.taskWorkModal.classList.remove('hidden');
    }

    addCopyButton(block) {
        const pre = block.parentElement;
        if (pre.querySelector('.copy-btn')) return; // Already exists

        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.innerHTML = '<i class="fas fa-copy"></i>';
        btn.title = 'Copy code';
        btn.style.position = 'absolute';
        btn.style.top = '0.5rem';
        btn.style.right = '0.5rem';
        btn.style.background = 'rgba(255,255,255,0.1)';
        btn.style.border = 'none';
        btn.style.color = '#fff';
        btn.style.padding = '0.25rem 0.5rem';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';

        // Ensure pre is relative
        if (getComputedStyle(pre).position === 'static') {
            pre.style.position = 'relative';
        }

        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(block.textContent);
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
            } catch (err) {
                console.error('Failed to copy', err);
            }
        });

        pre.appendChild(btn);
    }

    closeTaskWorkModal() {
        if (this.elements.taskWorkModal) {
            this.elements.taskWorkModal.classList.add('hidden');
            this.elements.taskWorkContent.innerHTML = ''; // Clear content
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
                if (el.tagName === 'SELECT') return; // Keep defaults
                el.value = '';
            });
        }
    }

    openUserContextModal() {
        this.elements.userContextModal?.classList.remove('hidden');
    }

    closeUserContextModal() {
        this.elements.userContextModal?.classList.add('hidden');
    }

    saveUserContext() {
        this.showNotification('User context saved (simulation).', 'success');
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
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}