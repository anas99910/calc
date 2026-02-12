import { store } from './store.js';
import { getCurrentLang, getText } from './settings.js';
import { generateGhostEvents } from './calendar.js';
import { openEventModal } from './modals.js';

let revenueChart = null;
let servicesChart = null;

export function renderDashboard() {
    updateStats();
    renderCharts();
    renderInventoryStatus();
    renderUpcomingMaintenance();
}

function updateStats() {
    // 1. Total Revenue (Paid & Completed)
    const totalRevenue = store.events
        .filter(e => e.paymentStatus === 'Paid')
        .reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);

    document.getElementById('dash-revenue').textContent = `${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD`;

    // 2. Completed Jobs
    const completedCount = store.events.filter(e => e.status === 'Completed').length;
    document.getElementById('dash-completed').textContent = completedCount;

    // 3. Active Clients
    document.getElementById('dash-clients').textContent = store.clients.length;

    // 4. Projected Revenue (Next 30 Days)
    // Include Ghost Events
    const allEvents = [...store.events, ...generateGhostEvents(store.clients)];
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().split('T')[0];
    const next30DaysStr = next30Days.toISOString().split('T')[0];

    const projectedRevenue = allEvents
        .filter(e => {
            return e.date >= todayStr && e.date <= next30DaysStr &&
                (e.status === 'Scheduled' || e.status === 'Planned'); // Only future/unpaid
        })
        .reduce((sum, e) => {
            // Use event cost if set, otherwise client nextServicePrice
            let cost = parseFloat(e.cost) || 0;
            if (cost === 0 && e.clientId) {
                const client = store.clients.find(c => c.id === e.clientId);
                if (client) cost = parseFloat(client.nextServicePrice) || 0;
            }
            return sum + cost;
        }, 0);

    const projEl = document.getElementById('dash-projected');
    if (projEl) {
        projEl.textContent = `${projectedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD`;
    }
}

function renderCharts() {
    const ctxRevenue = document.getElementById('chart-revenue').getContext('2d');
    const ctxServices = document.getElementById('chart-services').getContext('2d');

    // Merge Ghost Events for Service Breakdown (but NOT for Revenue history, as ghosts are future/unpaid)
    // Revenue Chart = strictly historical PAID events.
    // Service Breakdown Chart = All time? Or Last year? Or All including future?
    // Let's keep Service Breakdown as "All Time Activity" (Past + Future stats could be interesting, but maybe just stick to existing + future?)
    // Actually, usually charts show "What has happened".
    // But the user complained "we don't see it".
    // Let's include ALL (Past Completed + Future Planned) to show "Business Volume".

    const allEventsForStats = [...store.events, ...generateGhostEvents(store.clients)];

    // --- Chart 1: Revenue (Actual / Paid only) ---
    // Group by Month
    const months = {};
    const today = new Date();
    const langCode = getCurrentLang() === 'fr' ? 'fr-FR' : 'en-US';

    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toLocaleString(langCode, { month: 'short' });
        months[key] = 0;
    }

    store.events.forEach(e => {
        if (e.paymentStatus === 'Paid' && e.date) {
            const d = new Date(e.date);
            const key = d.toLocaleString(langCode, { month: 'short' });
            if (months.hasOwnProperty(key)) {
                months[key] += (parseFloat(e.cost) || 0);
            }
        }
    });

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctxRevenue, {
        type: 'line',
        data: {
            labels: Object.keys(months),
            datasets: [{
                label: `${getText('dashboard.total_revenue')} (MAD)`,
                data: Object.values(months),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });

    // --- Chart 2: Services Breakdown (Include Ghost Events to show volume) ---
    const serviceCounts = {
        'Installation': 0,
        'Maintenance': 0,
        'Filter Change': 0,
        'General': 0
    };

    allEventsForStats.forEach(e => {
        // Only count valid types
        if (serviceCounts.hasOwnProperty(e.type)) {
            serviceCounts[e.type]++;
        }
    });

    // Translate keys for display
    const translatedLabels = Object.keys(serviceCounts).map(key => {
        if (key === 'Installation') return getText('legend.installation');
        if (key === 'Maintenance') return getText('legend.maintenance');
        if (key === 'Filter Change') return getText('legend.filter_change');
        if (key === 'General') return getText('legend.general');
        return key;
    });

    if (servicesChart) servicesChart.destroy();
    servicesChart = new Chart(ctxServices, {
        type: 'doughnut',
        data: {
            labels: translatedLabels,
            datasets: [{
                data: Object.values(serviceCounts),
                backgroundColor: ['#3b82f6', '#22c55e', '#eab308', '#a855f7'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#9ca3af' } }
            }
        }
    });
}

function renderInventoryStatus() {
    const container = document.getElementById('dash-inventory-list');
    if (!container) return;
    container.innerHTML = '';

    // Low stock items first
    const items = [...store.inventory].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

    if (items.length === 0) {
        container.innerHTML = `<div class="text-sm text-gray-500 text-center py-2">${getText('text.no_inventory')}</div>`;
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";

        const isLow = item.quantity < 10;
        const colorClass = isLow ? "text-red-500" : "text-green-500";

        div.innerHTML = `
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${item.name}</span>
            <span class="text-sm font-bold ${colorClass}">${item.quantity} ${getText('text.units')}</span>
        `;
        container.appendChild(div);
    });
}

function renderUpcomingMaintenance() {
    const container = document.getElementById('dash-maintenance-list');
    if (!container) return;
    container.innerHTML = '';

    // Get all events (including ghosts)
    const allEvents = [...store.events, ...generateGhostEvents(store.clients)];
    const today = new Date().toISOString().split('T')[0];

    // Filter: Future events, limit to 5
    const upcoming = allEvents
        .filter(e => e.date >= today && e.status !== 'Completed')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = `<div class="text-sm text-gray-500 text-center py-2">${getText('text.no_reminders')}</div>`;
        return;
    }

    upcoming.forEach(e => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group";

        // Color border based on type
        let borderClass = 'border-l-2 border-gray-400';
        if (e.type === 'Maintenance') borderClass = 'border-l-2 border-green-500';
        if (e.type === 'Filter Change') borderClass = 'border-l-2 border-yellow-500';
        if (e.type === 'Installation') borderClass = 'border-l-2 border-blue-500';

        div.className += ` ${borderClass}`;

        div.innerHTML = `
            <div class="pl-2">
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">${e.clientName || e.title}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${e.date} • ${e.type}</div>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
        `;

        div.onclick = () => openEventModal(e);
        container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons();
}
