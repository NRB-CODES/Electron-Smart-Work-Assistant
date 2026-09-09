// Service Worker for background notifications across ALL pages
let waterInterval = null;
let screenInterval = null;
let waterMinutes = null;
let screenMinutes = null;

// Show notification function
function showNotification(title, message, icon = '💚') {
    self.registration.showNotification(title, {
        body: message,
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%2374E89B"/%3E%3Ctext x="50" y="70" text-anchor="middle" fill="white" font-size="50"%3E💚%3C/text%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%2374E89B"/%3E%3C/svg%3E',
        vibrate: [200, 100, 200],
        silent: false,
        requireInteraction: true,
        tag: 'wellness-reminder'
    });
}

// Start water reminder in background
function startWaterReminder(minutes) {
    if (waterInterval) clearInterval(waterInterval);
    waterMinutes = minutes;
    
    waterInterval = setInterval(() => {
        showNotification('💧 Time to Hydrate!', `Take a water break! Next reminder in ${waterMinutes} minutes.`, '💧');
        
        // Also notify any open pages
        notifyAllClients({
            type: 'REMINDER_TRIGGERED',
            title: '💧 Time to Hydrate!',
            message: `Take a water break! Next reminder in ${waterMinutes} minutes.`,
            icon: '💧'
        });
    }, minutes * 60 * 1000);
    
    saveReminderState();
}

// Start screen reminder in background
function startScreenReminder(minutes) {
    if (screenInterval) clearInterval(screenInterval);
    screenMinutes = minutes;
    
    screenInterval = setInterval(() => {
        showNotification('👁️ Screen Time Alert', `Time to rest your eyes! Next break in ${screenMinutes} minutes.`, '👁️');
        
        // Also notify any open pages
        notifyAllClients({
            type: 'REMINDER_TRIGGERED',
            title: '👁️ Screen Time Alert',
            message: `Time to rest your eyes! Next break in ${screenMinutes} minutes.`,
            icon: '👁️'
        });
    }, minutes * 60 * 1000);
    
    saveReminderState();
}

// Notify all open clients/pages
async function notifyAllClients(message) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
        client.postMessage(message);
    });
}

// Stop all reminders
function stopAllReminders() {
    if (waterInterval) clearInterval(waterInterval);
    if (screenInterval) clearInterval(screenInterval);
    waterInterval = null;
    screenInterval = null;
    waterMinutes = null;
    screenMinutes = null;
    saveReminderState();
}

// Save reminder state to cache
function saveReminderState() {
    const state = {
        waterMinutes: waterMinutes,
        screenMinutes: screenMinutes,
        timestamp: Date.now()
    };
    
    caches.open('wellness-reminders-v1').then(cache => {
        cache.put('/reminder-state', new Response(JSON.stringify(state)));
    });
}

// Load reminder state from cache
async function loadReminderState() {
    try {
        const cache = await caches.open('wellness-reminders-v1');
        const response = await cache.match('/reminder-state');
        if (response) {
            const state = await response.json();
            if (state.waterMinutes && !waterInterval) {
                startWaterReminder(state.waterMinutes);
            }
            if (state.screenMinutes && !screenInterval) {
                startScreenReminder(state.screenMinutes);
            }
        }
    } catch (error) {
        console.log('Error loading reminder state:', error);
    }
}

// Handle messages from pages
self.addEventListener('message', (event) => {
    const data = event.data;
    
    switch(data.type) {
        case 'UPDATE_REMINDERS':
            if (data.waterMinutes !== undefined && data.waterMinutes !== null) {
                startWaterReminder(data.waterMinutes);
            } else if (data.waterMinutes === null && waterInterval) {
                if (waterInterval) clearInterval(waterInterval);
                waterInterval = null;
                waterMinutes = null;
            }
            
            if (data.screenMinutes !== undefined && data.screenMinutes !== null) {
                startScreenReminder(data.screenMinutes);
            } else if (data.screenMinutes === null && screenInterval) {
                if (screenInterval) clearInterval(screenInterval);
                screenInterval = null;
                screenMinutes = null;
            }
            saveReminderState();
            break;
            
        case 'SHOW_NOTIFICATION':
            showNotification(data.title, data.message, data.icon);
            break;
            
        case 'GET_STATE':
            event.source.postMessage({
                type: 'REMINDER_STATE',
                waterMinutes: waterMinutes,
                screenMinutes: screenMinutes
            });
            break;
    }
});

// Handle notification click - opens the wellness page
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Try to find and focus an existing wellness page
                for (let client of windowClients) {
                    if (client.url.includes('wellness.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If no wellness page found, open one
                if (clients.openWindow) {
                    return clients.openWindow('wellness.html');
                }
            })
    );
});

// Service Worker lifecycle
self.addEventListener('install', (event) => {
    console.log('Service Worker installed - Reminders will work on all pages');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated - Background reminders active');
    event.waitUntil(clients.claim());
    loadReminderState();
});

// Keep service worker alive
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});