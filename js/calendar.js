import { store } from './store.js';
import { getEventTypeColors } from './utils.js';
import { openEventModal } from './modals.js';
import { saveEvents } from './api.js';

let draggedEventId = null;

/**
 * Renders the main calendar grid for the `currentDate`.
 */
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
        header.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;
    }

    // Get calendar days
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // 42 cells for 6 weeks
    for (let i = 0; i < 42; i++) {
        const cell = document.createElement('div');
        // Adaptive Dark/Light class
        cell.className = 'calendar-day-cell bg-white dark:bg-gray-900 border-t border-l border-gray-200 dark:border-gray-700 p-2 overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors drop-zone';

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
            if (dateObj.toISOString().split('T')[0] === todayStr) {
                cell.classList.add('today', 'bg-blue-50', 'dark:bg-blue-900/20');
            }
        } else {
            // Next month
            dayNum = i - firstDayOfMonth - daysInMonth + 1;
            dateObj = new Date(year, month + 1, dayNum);
            cell.classList.add('other-month', 'text-gray-400', 'dark:text-gray-600', 'bg-gray-50', 'dark:bg-gray-800/50');
        }

        dateStr = dateObj.toISOString().split('T')[0];
        cell.dataset.date = dateStr;

        // NEW: Drop Listeners
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', (e) => handleDrop(e, dateStr));

        // Add day number
        cell.innerHTML = `<span class="day-number text-sm font-medium pointer-events-none">${dayNum}</span>`;

        // Find and render events for this day
        const dayEvents = getEventsForDay(dateStr);
        const eventList = document.createElement('div');
        eventList.className = 'mt-1 space-y-1 overflow-y-auto max-h-[80px]';

        dayEvents.forEach(event => {
            const eventPill = document.createElement('div');
            // Add Draggable
            eventPill.draggable = true;
            eventPill.className = 'event-pill text-xs font-medium px-2 py-0.5 rounded-md cursor-pointer truncate flex items-center shadow-sm hover:opacity-80 transition-opacity';

            // Status icons
            let statusIcon = '';
            if (event.paymentStatus === 'Paid') {
                statusIcon = `<i data-lucide="dollar-sign" class="status-icon w-3 h-3 text-green-600 dark:text-green-400 mr-1"></i>`;
            } else if (event.status === 'Completed') {
                statusIcon = `<i data-lucide="check-circle" class="status-icon w-3 h-3 text-green-600 dark:text-green-400 mr-1"></i>`;
            } else if (event.status === 'Cancelled') {
                statusIcon = `<i data-lucide="x-circle" class="status-icon w-3 h-3 text-red-500 mr-1"></i>`;
            }

            eventPill.innerHTML = `${statusIcon}<span>${event.clientName || event.title}</span>`;

            const colors = getEventTypeColors(event.type, event.status);
            // apply dynamic colors
            eventPill.className += ` ${colors.bg} ${colors.text}`;

            eventPill.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent day click
                openEventModal(event);
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
            openEventModal(null, dateObj);
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
 * Gets sorted, filtered events for a specific date string.
 */
function getEventsForDay(dateStr) {
    return store.events
        .filter(event => event.date === dateStr)
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
