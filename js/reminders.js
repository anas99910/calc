/**
 * Logic for calculating Filter Expirations and handling Notifications.
 */
import { showToast } from './toast.js';

export function checkFilterStatus(clients, events) {
    const today = new Date();
    const expiringClients = [];

    // OPTIMIZATION: Index events by clientId first
    // Map: clientId -> [events]
    const eventsByClient = {};
    events.forEach(e => {
        if (!eventsByClient[e.clientId]) eventsByClient[e.clientId] = [];
        eventsByClient[e.clientId].push(e);
    });

    clients.forEach(client => {
        let dueDateVal = null;

        // 1. Manual Date
        if (client.nextFilterDate) {
            dueDateVal = new Date(client.nextFilterDate);
            if (isNaN(dueDateVal.getTime())) dueDateVal = null;
        }

        // 2. History
        let lastChangeDateStr = null;
        if (!dueDateVal) {
            const lifespanDays = client.filterLifespanDays || 180;
            // Lookup from map instead of filtering entire array
            const clientEvents = eventsByClient[client.id] || [];

            // Filter specific types
            const validEvents = clientEvents.filter(e =>
                (e.type === 'Filter Change' || e.type === 'Installation') &&
                e.status === 'Completed'
            );

            if (validEvents.length > 0) {
                validEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
                const lastChange = validEvents[0];
                lastChangeDateStr = lastChange.date;
                const lastDate = new Date(lastChange.date);
                dueDateVal = new Date(lastDate);
                dueDateVal.setDate(dueDateVal.getDate() + lifespanDays);
            }
        }

        if (!dueDateVal) return;

        // 3. Status
        const diffTime = dueDateVal - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Show if due within 7 days OR overdue by less than 30 days
        // (diffDays <= 7) AND (diffDays >= -30)
        if (diffDays <= 7 && diffDays >= -30) {
            expiringClients.push({
                client: client,
                filterName: client.defaultFilterType || 'Filtre Principal',
                filterId: 'main',
                lastDate: lastChangeDateStr || 'Manual Schedule',
                dueDate: dueDateVal.toISOString().split('T')[0],
                daysRemaining: diffDays
            });
        }

        // 4. Secondary Filters
        if (client.secondaryFilters && Array.isArray(client.secondaryFilters)) {
            client.secondaryFilters.forEach(filter => {
                if (!filter.nextDate) return;
                const fDue = new Date(filter.nextDate);
                if (isNaN(fDue.getTime())) return;

                const fDiffTime = fDue - today;
                const fDiffDays = Math.ceil(fDiffTime / (1000 * 60 * 60 * 24));

                if (fDiffDays <= 7 && fDiffDays >= -30) {
                    expiringClients.push({
                        client: client,
                        filterName: filter.type,
                        filterId: filter.id || filter.type, // Fallback if no ID
                        lastDate: 'Secondary Filter',
                        dueDate: fDue.toISOString().split('T')[0],
                        daysRemaining: fDiffDays
                    });
                }
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
        // Adjusted positioning: -top-1.5 -right-1.5 and increased size to w-5 h-5 (20px)
        badge.className = "notification-badge absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900 z-10";
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
        await triggerNotification(expiringCount);
    } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            await triggerNotification(expiringCount);
        }
    }
}

async function triggerNotification(count) {
    const title = "Speedyex Filtre";
    const options = {
        body: `${count} Filtres à changer cette semaine !`,
        icon: "./favicon.ico",
        badge: "./pwa-icon.png"
    };

    // Use Service Worker for Mobile Support
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, options);
            return;
        } catch (e) {
            console.warn("SW Notification failed, falling back to standard:", e);
        }
    }

    // Fallback for Desktop/Non-SW
    try {
        new Notification(title, options);
    } catch (e) {
        console.error("Notification failed:", e);
    }
}
