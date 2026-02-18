import { store } from './store.js';
import { getEventTypeColors } from './utils.js';
import { openEventModal, openDayViewModal } from './modals.js';
import { saveEvents } from './api.js';
import { getCurrentLang } from './settings.js';

let draggedEventId = null;

/**
 * Renders the main calendar grid for the`currentDate`.
 */
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

export function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.innerHTML = ''; // Clear existing grid

    const currentDate = store.currentDate;
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    // Update header
    const header = document.getElementById('month-year-header');
    if (header) {
        const langCode = getCurrentLang() === 'fr' ? 'fr-FR' : 'en-US';
        header.textContent = `${currentDate.toLocaleString(langCode, { month: 'long' })} ${year}`;
    }

    // Get calendar days
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // --- OPTIMIZATION START ---
    // Pre-calculate Ghost Events for ALL clients ONCE
    const ghostEvents = generateGhostEvents(store.clients);

    // Map: dateString -> [Array of Ghost Events]
    const ghostEventsCache = {};
    ghostEvents.forEach(e => {
        if (!ghostEventsCache[e.date]) ghostEventsCache[e.date] = [];
        ghostEventsCache[e.date].push(e);
    });
    // --- OPTIMIZATION END ---

    // 42 cells for 6 weeks
    for (let i = 0; i < 42; i++) {
        const cell = document.createElement('div');
        // Adaptive Dark/Light class
        cell.className = 'calendar-day-cell bg-white dark:bg-gray-900 border-t border-l border-gray-200 dark:border-gray-700 p-2 overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors drop-zone cursor-pointer';

        let dayNum, dateObj, dateStr;

        if (i < firstDayOfMonth) {
            // Previous month
            dayNum = prevMonthDays - firstDayOfMonth + 1 + i;
            dateObj = new Date(year, month - 1, dayNum);
            cell.classList.add('other-month', 'text-gray-400', 'dark:text-gray-600', 'bg-gray-50', 'dark:bg-gray-800/50');
        } else if (i >= firstDayOfMonth && i < firstDayOfMonth + daysInMonth) {
            // Current month
            dayNum = i - firstDayOfMonth + 1;
            dateObj = new Date(year, month, dayNum);
            cell.classList.add('text-gray-900', 'dark:text-gray-300'); // Default text color
            if (isSameDay(dateObj, new Date())) {
                cell.classList.add('today', 'bg-blue-50', 'dark:bg-blue-900/20');
            }
        } else {
            // Next month
            dayNum = i - firstDayOfMonth - daysInMonth + 1;
            dateObj = new Date(year, month + 1, dayNum);
            cell.classList.add('other-month', 'text-gray-400', 'dark:text-gray-600', 'bg-gray-50', 'dark:bg-gray-800/50');
        }

        // Fix: Serialize using local time, NOT UTC/ISO
        dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        cell.dataset.date = dateStr;

        // NEW: Drop Listeners
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', (e) => handleDrop(e, dateStr));

        // Add day number
        cell.innerHTML = `<span class="day-number text-sm font-medium pointer-events-none">${dayNum}</span>`;

        // Find and render events for this day
        // OPTIMIZED: Use cached ghost events
        const ghostEvents = ghostEventsCache[dateStr] || [];
        const regularEvents = store.events.filter(event => event.date === dateStr);

        let dayEvents = [...regularEvents, ...ghostEvents];

        // Filter
        dayEvents = dayEvents
            .filter(event => {
                if (!store.searchFilter) return true;
                const title = (event.title || '').toLowerCase();
                const client = (event.clientName || '').toLowerCase();
                return title.includes(store.searchFilter) || client.includes(store.searchFilter);
            })
            .sort((a, b) => a.time.localeCompare(b.time));

        const eventList = document.createElement('div');
        eventList.className = 'mt-1 space-y-1 overflow-y-auto max-h-[80px]';

        dayEvents.forEach(event => {
            const eventPill = document.createElement('div');
            // Add Draggable
            eventPill.draggable = true;
            eventPill.className = 'event-pill text-xs font-medium px-[1px] md:px-2 py-0.5 rounded-md cursor-pointer truncate flex items-center shadow-sm hover:opacity-80 transition-opacity';

            // Status icons
            let statusIcon = '';
            if (event.paymentStatus === 'Paid') {
                statusIcon = `<i data-lucide="dollar-sign" class="status-icon w-3 h-3 text-green-600 dark:text-green-400 mr-0 md:mr-1 hidden md:block"></i>`;
            } else if (event.status === 'Completed') {
                statusIcon = `<i data-lucide="check-circle" class="status-icon w-3 h-3 text-green-600 dark:text-green-400 mr-0 md:mr-1 hidden md:block"></i>`;
            } else if (event.status === 'Cancelled') {
                statusIcon = `<i data-lucide="x-circle" class="status-icon w-3 h-3 text-red-500 mr-0 md:mr-1 hidden md:block"></i>`;
            }

            // Resolve Name dynamically to avoid empty pills
            const client = store.clients.find(c => c.id === event.clientId);
            const displayName = client ? client.name : (event.clientName || event.title || event.type || 'Event');

            // Format: Responsive via CSS
            // Mobile: [Icon] Name (Clipped, no ellipsis to show more text)
            // Desktop: [Icon] Time • Name • Status

            eventPill.innerHTML = `
                ${statusIcon}
                <div class="truncate flex items-center gap-0 md:gap-1 w-full pl-0.5 md:pl-0">
                    <span class="hidden md:inline text-[10px] opacity-80 whitespace-nowrap">${event.time} •</span>
                    <span class="text-[9px] md:text-xs font-medium whitespace-nowrap overflow-hidden leading-tight" style="text-overflow: clip;">${displayName}</span>
                    <span class="hidden md:inline text-[10px] opacity-80 whitespace-nowrap">• ${event.status}</span>
                </div>
            `;

            const colors = getEventTypeColors(event.type, event.status);
            // apply dynamic colors
            eventPill.className += ` ${colors.bg} ${colors.text}`;

            // --- HIGHLIGHT FILTER LOGIC ---
            if (store.activeCategoryFilter) {
                const filter = store.activeCategoryFilter;
                let match = false;
                if (filter === 'Paid') {
                    match = event.paymentStatus === 'Paid';
                } else if (filter === 'Completed') {
                    match = event.status === 'Completed';
                } else if (filter === 'Filter Change') {
                    match = event.type === 'Filter Change';
                } else {
                    // Match type exactly (Installation, Maintenance, General)
                    match = event.type === filter;
                }

                if (!match) {
                    eventPill.style.opacity = '0.1'; // Dim others
                } else {
                    eventPill.style.opacity = '1';
                    eventPill.style.boxShadow = '0 0 4px currentColor'; // Glow effect
                }
            }
            // ------------------------------

            eventPill.addEventListener('click', (e) => {
                // Mobile: Let bubble to cell -> Opens Day View (Easier selection)
                // Desktop: Direct Edit
                if (window.innerWidth >= 768) {
                    e.stopPropagation(); // Stop bubbling on desktop to edit directly
                    openEventModal(event);
                }
                // On mobile, do nothing here. The click hits the cell, which calls openDayViewModal()
            });

            // NEW: Drag Start
            eventPill.addEventListener('dragstart', (e) => {
                draggedEventId = event.id;
                e.dataTransfer.effectAllowed = 'move';
                e.target.style.opacity = '0.5';
            });
            eventPill.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
                draggedEventId = null;
            });

            eventList.appendChild(eventPill);
        });

        cell.appendChild(eventList);

        // Add click listener to day cell
        cell.addEventListener('click', () => {
            // openEventModal(null, dateObj); <-- OLD
            openDayViewModal(dateObj); // NEW
        });

        grid.appendChild(cell);
    }

    // Re-render icons if Lucide is available
    if (window.lucide) {
        lucide.createIcons();
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-blue-50', 'dark:bg-blue-900/30');
}

// Remove highlight on dragleave if functionality added later, but for now simple drop is fine.
// Actually, simple add/remove class is better.
// We can use dragenter/dragleave for visual feedback, but let's stick to basic functionality first.

async function handleDrop(e, newDate) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/30'); // Clean up visual if added

    if (!draggedEventId) return;

    // Find Event
    const eventIndex = store.events.findIndex(ev => ev.id === draggedEventId);
    if (eventIndex === -1) return;

    const event = store.events[eventIndex];

    // Don't update if same date
    if (event.date === newDate) return;

    // Update Date
    event.date = newDate;

    // Optimistic Update
    renderCalendar();

    // Save to Firebase
    try {
        await saveEvents();
        // Optional: Show toast?
        console.log(`Event ${event.id} moved to ${newDate}`);
    } catch (err) {
        console.error("Failed to save move:", err);
        // Revert? For now, assume success or error alerts generic handler.
    }
}

/**
 * Generates all ghost events from client profiles.
 */
export function generateGhostEvents(clients) {
    const ghosts = [];
    clients.forEach(c => {
        // 1. Next Service
        if (c.nextFilterDate) {
            ghosts.push({
                id: `ghost-next-${c.id}`,
                clientId: c.id,
                clientName: c.name,
                title: 'Planned Service',
                date: c.nextFilterDate,
                time: '09:00',
                type: 'Maintenance',
                status: 'Planned',
                notes: 'Manually scheduled via Client Card',
                isGhost: true
            });
        }
        // 2. First Installation
        if (c.installDate) {
            ghosts.push({
                id: `ghost-install-${c.id}`,
                clientId: c.id,
                clientName: c.name,
                title: 'First Installation',
                date: c.installDate,
                time: '09:00',
                type: 'Installation',
                status: 'Completed',
                notes: 'Recorded via Client Card',
                isGhost: true
            });
        }

        // 3. Secondary Filters (Additional Filters)
        if (c.secondaryFilters && Array.isArray(c.secondaryFilters)) {
            c.secondaryFilters.forEach(filter => {
                if (filter.nextDate) {
                    ghosts.push({
                        id: `ghost-filter-${c.id}-${filter.id || filter.type}`, // Ensure unique ID
                        clientId: c.id,
                        clientName: c.name,
                        title: `${filter.type} Change`, // e.g. "RO Membrane Change"
                        date: filter.nextDate,
                        time: '09:00',
                        type: 'Filter Change', // Keep generic type for color coding, or use specific if you have specific colors
                        status: 'Planned',
                        notes: `Secondary Filter: ${filter.type}`,
                        isGhost: true,
                        filterId: filter.id // Useful for quick complete if needed
                    });
                }
            });
        }
    });
    return ghosts;
}

/**
 * Gets sorted, filtered events for a specific date string.
 */
export function getEventsForDay(dateStr) {
    // 1. Regular Events
    const regularEvents = store.events.filter(event => event.date === dateStr);

    // 2. Ghost Events (Optimized)
    const allGhosts = generateGhostEvents(store.clients);
    const dayGhosts = allGhosts.filter(g => g.date === dateStr);

    // Merge
    let allEvents = [...regularEvents, ...dayGhosts];

    // Filter
    return allEvents
        .filter(event => {
            if (!store.searchFilter) return true;
            const title = (event.title || '').toLowerCase();
            const client = (event.clientName || '').toLowerCase();
            return title.includes(store.searchFilter) || client.includes(store.searchFilter);
        })
        .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Changes the current month and re-renders the calendar.
 */
export function changeMonth(offset) {
    store.currentDate.setMonth(store.currentDate.getMonth() + offset);
    renderCalendar();
}
