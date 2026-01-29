/**
 * Logic for calculating Filter Expirations and handling Notifications.
 */
import { showToast } from './toast.js';

export function checkFilterStatus(clients, events) {
    const today = new Date();
    const expiringClients = [];

    clients.forEach(client => {
        // 1. Get client lifespan preference (default 180 days / 6 months)
        const lifespanDays = client.filterLifespanDays || 180;

        // 2. Find last "Filter Change" or "Installation" event for this client
        const clientEvents = events.filter(e =>
            e.clientId === client.id &&
            (e.type === 'Filter Change' || e.type === 'Installation') &&
            e.status === 'Completed' // Only count completed events as a base
        );

        if (clientEvents.length === 0) return; // No history, can't calc

        // Sort by date descending
        clientEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastChange = clientEvents[0];
        const lastDate = new Date(lastChange.date);

        // 3. Calculate Due Date
        const dueDate = new Date(lastDate);
        dueDate.setDate(dueDate.getDate() + lifespanDays);

        // 4. Check if Due Soon (within 7 days) or Overdue
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
            expiringClients.push({
                client: client,
                lastDate: lastChange.date,
                dueDate: dueDate.toISOString().split('T')[0],
                daysRemaining: diffDays
            });
        }
    });

    return expiringClients.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function updateNotificationBadge(count) {
    const btn = document.getElementById('btn-view-reminders');
    if (!btn) return;

    // Remove existing badge
    const existingBadge = btn.querySelector('.notification-badge');
    if (existingBadge) existingBadge.remove();

    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = "notification-badge absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900";
        badge.textContent = count > 9 ? '9+' : count;
        btn.appendChild(badge);

        // Visuals: Colorize Icon & Pulse
        btn.classList.add('text-yellow-500', 'dark:text-yellow-400', 'animate-pulse');
        btn.classList.remove('text-gray-500', 'dark:text-gray-400');
    } else {
        // Reset Visuals
        btn.classList.remove('text-yellow-500', 'dark:text-yellow-400', 'animate-pulse');
        btn.classList.add('text-gray-500', 'dark:text-gray-400');
    }
}

export async function sendSystemNotification(expiringCount) {
    if (expiringCount === 0) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification("Speedyex Filtre", {
            body: `${expiringCount} Filtres à changer cette semaine !`,
            icon: "./favicon.ico"
        });
    } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            new Notification("Speedyex Filtre", {
                body: `${expiringCount} Filtres à changer cette semaine !`,
                icon: "./favicon.ico"
            });
        }
    }
}
