import { store } from './store.js';

let revenueChart = null;
let servicesChart = null;

export function renderDashboard() {
    updateStats();
    renderCharts();
    renderInventoryStatus();
}

function updateStats() {
    // 1. Total Revenue (Paid & Completed)
    // Assuming 'cost' is numeric. paymentStatus should be 'Paid'. Or simply 'Completed' jobs?
    // Let's go with PaymentStatus = Paid for actual revenue.
    const totalRevenue = store.events
        .filter(e => e.paymentStatus === 'Paid')
        .reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);

    document.getElementById('dash-revenue').textContent = `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // 2. Completed Jobs
    const completedCount = store.events.filter(e => e.status === 'Completed').length;
    document.getElementById('dash-completed').textContent = completedCount;

    // 3. Active Clients
    document.getElementById('dash-clients').textContent = store.clients.length;
}

function renderCharts() {
    const ctxRevenue = document.getElementById('chart-revenue').getContext('2d');
    const ctxServices = document.getElementById('chart-services').getContext('2d');

    // Prepare Data for Revenue (Last 6 Months)
    // Group by Month
    const months = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toLocaleString('default', { month: 'short' });
        months[key] = 0;
    }

    store.events.forEach(e => {
        if (e.paymentStatus === 'Paid' && e.date) {
            const d = new Date(e.date);
            const key = d.toLocaleString('default', { month: 'short' });
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
                label: 'Revenue ($)',
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

    // Prepare Data for Services
    const serviceCounts = {
        'Installation': 0,
        'Maintenance': 0,
        'Filter Change': 0,
        'General': 0
    };
    store.events.forEach(e => {
        if (serviceCounts.hasOwnProperty(e.type)) {
            serviceCounts[e.type]++;
        }
    });

    if (servicesChart) servicesChart.destroy();
    servicesChart = new Chart(ctxServices, {
        type: 'doughnut',
        data: {
            labels: Object.keys(serviceCounts),
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
    container.innerHTML = '';

    // Low stock items first
    const items = [...store.inventory].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-700/50";

        const isLow = item.quantity < 10;
        const colorClass = isLow ? "text-red-500" : "text-green-500";

        div.innerHTML = `
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${item.name}</span>
            <span class="text-sm font-bold ${colorClass}">${item.quantity} units</span>
        `;
        container.appendChild(div);
    });
}
