/* Global Reminder Notification Listener */
(function() {
    function detectCurrentTheme() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('2.html') || path.includes('theme2')) return 'theme2';
        if (path.includes('3.html')) return 'theme3';
        return 'theme1';
    }

    function setupGlobalReminders() {
        if (!window.electronAPI || !window.electronAPI.reminders) {
            console.warn('Electron API not found for reminders');
            return;
        }

        const currentTheme = detectCurrentTheme();
        console.log('Current Page Theme detected as:', currentTheme);

        window.electronAPI.reminders.onTriggered((data) => {
            // Theme Isolation: Only show if reminder theme matches current page theme
            if (data.themeId !== currentTheme) {
                console.log(`Skipping reminder for ${data.themeId} while on ${currentTheme}`);
                return;
            }

            console.log('Global Reminder Triggered:', data);
            showGlobalToast(data.title, data.message, data.type === 'water' ? '💧' : '👁️');
            
            // If the current page is a reminder page, also trigger its internal sync
            if (window.reminderApp && typeof window.reminderApp.syncWithBackend === 'function') {
                window.reminderApp.syncWithBackend();
            }
        });
    }

    function showGlobalToast(title, message, icon) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.add('toast-fadeout');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupGlobalReminders);
    } else {
        setupGlobalReminders();
    }
})();
