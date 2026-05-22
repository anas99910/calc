import { store } from './store.js';
import { getText } from './settings.js';
import { saveEvents, saveClients, saveInventory } from './api.js'; // Imports purely for dependency, though actions happen in app.js mainly? Or should we move actions here?
// Ideally, event handlers should be separate or imported. For now, let's keep modal OPENING logic here, and maybe form handling logic.
// To avoid circular dependencies, we might need a separate 'actions.js' or keep core logic in `app.js` passing callbacks?
// Let's try to make `modals.js` manage the UI state of modals.

import { getEventsForDay } from './calendar.js';
import { getEventTypeColors } from './utils.js';

/**
 * Opens a modal.
 */
export function openModal(modal) {
    if (!modal) return;
    modal.classList.add('visible');
}

/**
 * Closes a modal.
 */
export function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('visible');
}

/**
 * Opens the Confirmation Modal.
 */
export function openConfirmationModal(message, onConfirm) {
    document.getElementById('confirmation-message').textContent = message;
    store.confirmCallback = onConfirm;
    openModal(document.getElementById('confirmation-modal'));
}

/**
 * Opens the Event Modal (UI Logic).
 */
export function openDayViewModal(dateObj) {
    const modal = document.getElementById('day-view-modal');
    if (!modal) return;

    // Set Date Title
    const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('day-view-date').textContent = dateStr;

    // Filter Events (Use Local Date String to match Calendar)
    const isoDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const dayEvents = getEventsForDay(isoDate);

    // Render List
    const list = document.getElementById('day-view-list');
    list.innerHTML = '';

    if (dayEvents.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-center py-4">No events for this day.</p>';
    } else {
        dayEvents.forEach(event => {
            const div = document.createElement('div');
            const colors = getEventTypeColors(event.type, event.status);
            div.className = `p-3 rounded-lg border flex items-center justify-between ${colors.bg} ${colors.text} border-gray-700/50`;

            div.innerHTML = `
                <div class="flex-1 cursor-pointer">
                    <div class="font-bold text-sm">${event.clientName || event.title}</div>
                    <div class="text-xs opacity-80">${event.time} • ${event.type} • ${event.status}</div>
                </div>
                <button class="btn-delete-event-day p-2 hover:bg-black/20 rounded-full text-red-400 hover:text-red-300 transition-colors ${event.isGhost ? 'hidden' : ''}" title="Delete Event">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;

            // Click to Edit
            div.querySelector('div').onclick = () => {
                closeModal(modal);
                openEventModal(event);
            };

            // Click to Delete
            div.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                openConfirmationModal("Are you sure you want to delete this event?", async () => {
                    store.events = store.events.filter(ev => ev.id !== event.id);
                    await import('./api.js').then(m => m.saveEvents()); // Dynamic import to avoid circular dep if needed, or ensuring api is imported
                    renderDayViewList(dateObj); // Refresh list
                    const { renderCalendar } = await import('./calendar.js');
                    renderCalendar();
                });
            };

            list.appendChild(div);
        });
    }

    // Bind "Add New" button
    const btnAdd = document.getElementById('btn-add-event-day-view');
    btnAdd.onclick = () => {
        closeModal(modal);
        openEventModal(null, dateObj); // Pass date to new event
    };

    if (window.lucide) lucide.createIcons();
    openModal(modal);
}

// Helper to refresh list after delete
function renderDayViewList(dateObj) {
    // Re-run logic (or separate render function, simplified here by calling open essentially again or refactoring)
    // For simplicity, just re-call open logic effectively
    openDayViewModal(dateObj);
}

/**
 * Opens the Event Modal (UI Logic).
 */
export function openEventModal(event = null, date = null) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    form.reset();

    store.selectedEventId = null;

    // Populate Client Dropdown efficiently
    const clientSelect = document.getElementById('event-client-id');
    if (clientSelect) {
        // Use map/join for performance with large lists
        const optionsHtml = store.clients.map(client =>
            `<option value="${client.id}">${client.name}</option>`
        ).join('');
        clientSelect.innerHTML = '<option value="">Select an existing client</option>' + optionsHtml;
    }

    if (event) {
        // Edit existing
        document.getElementById('event-modal-title').textContent = getText('modal.edit_event.title');
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-type').value = event.type;
        document.getElementById('event-client-id').value = event.clientId || "";
        document.getElementById('event-title').value = event.title || "";
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time;
        document.getElementById('event-technician').value = event.technician || "";
        document.getElementById('event-cost').value = event.cost || "";
        document.getElementById('event-notes').value = event.notes || "";

        // Status fields
        document.getElementById('event-status').value = event.status || "Scheduled";
        document.getElementById('event-payment-status').value = event.paymentStatus || "Not Invoiced";
        document.getElementById('event-filter-used').value = event.filterUsed || "";

        // Store old values
        document.getElementById('event-old-status').value = event.status || "Scheduled";
        document.getElementById('event-old-filter-used').value = event.filterUsed || "";

        store.selectedEventId = event.id;
        store.selectedEventId = event.id;
        document.getElementById('btn-delete-event').classList.remove('hidden');
        document.getElementById('btn-duplicate-event').classList.remove('hidden');
        document.getElementById('btn-generate-invoice').classList.remove('hidden');

    } else {
        // New event
        document.getElementById('event-modal-title').textContent = getText('modal.new_event.title');
        document.getElementById('event-id').value = '';
        if (date) {
            document.getElementById('event-date').value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        document.getElementById('event-status').value = "Scheduled";
        document.getElementById('event-payment-status').value = "Not Invoiced";
        document.getElementById('event-old-status').value = "Scheduled";

        document.getElementById('event-client-id').value = ""; // Reset select
        document.getElementById('event-client-id').value = ""; // Reset select
        document.getElementById('btn-delete-event').classList.add('hidden');
        document.getElementById('btn-duplicate-event').classList.add('hidden');
        document.getElementById('btn-generate-invoice').classList.add('hidden');
    }

    toggleEventFormFields();
    openModal(modal);
}

/**
 * Adjusts event form fields based on type.
 */
export function toggleEventFormFields() {
    const eventType = document.getElementById('event-type').value;
    const eventStatus = document.getElementById('event-status').value;

    const clientSection = document.getElementById('client-section');
    const titleSection = document.getElementById('title-section');
    const smartReminderSection = document.getElementById('smart-reminder-section');
    const filterUsedSection = document.getElementById('filter-used-section');
    const billingSection = document.getElementById('billing-section');

    if (eventType === 'General') {
        clientSection.style.display = 'none';
        titleSection.style.display = 'block';
        smartReminderSection.style.display = 'none';
        filterUsedSection.style.display = 'none';
    } else {
        clientSection.style.display = 'block';
        titleSection.style.display = 'none';

        if (eventType === 'Installation' || eventType === 'Filter Change') {
            filterUsedSection.style.display = 'block';
        } else {
            filterUsedSection.style.display = 'none';
        }

        const isNewEvent = !document.getElementById('event-id').value;
        if (eventType === 'Installation' && isNewEvent) {
            smartReminderSection.style.display = 'block';
            const clientId = document.getElementById('event-client-id').value;
            const client = store.clients.find(c => c.id === clientId);
            if (client) {
                document.getElementById('filter-lifespan').value = client.filterLifespanDays || 180;
            }
        } else {
            smartReminderSection.style.display = 'none';
        }
    }

    if (eventStatus === 'Completed') {
        billingSection.style.display = 'block';
    } else {
        billingSection.style.display = 'none';
        document.getElementById('event-payment-status').value = 'Not Invoiced';
    }
}



export function addSecondaryFilterRow(filterData = {}) {
    const container = document.getElementById('secondary-filters-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = "grid grid-cols-12 gap-2 items-end bg-gray-700/50 p-2 rounded-lg border border-gray-600 secondary-filter-row";
    div.innerHTML = `
        <div class="col-span-5">
            <label class="text-xs text-gray-400 block mb-1">Type</label>
            <input type="text" class="secondary-filter-type w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white" 
                placeholder="Type" value="${filterData.type || ''}">
        </div>
        <div class="col-span-3">
             <label class="text-xs text-gray-400 block mb-1">Next Date</label>
            <input type="date" class="secondary-filter-date w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white" 
                value="${filterData.nextDate || ''}">
        </div>
        <div class="col-span-3">
             <label class="text-xs text-gray-400 block mb-1">Lifespan</label>
            <input type="number" class="secondary-filter-lifespan w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white" 
                placeholder="180" value="${filterData.lifespan || 180}">
        </div>
        <div class="col-span-1 flex justify-center pb-1">
            <button type="button" class="text-red-400 hover:text-red-300" onclick="this.closest('.grid').remove()">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
    if (window.lucide) lucide.createIcons();
}

/**
 * Opens Client Modal.
 */
export function openClientModal(client = null, fromEventModal = false) {
    const modal = document.getElementById('client-modal');
    const form = document.getElementById('client-form');
    form.reset();

    store.selectedClientId = null;
    const historySection = document.getElementById('client-history-section');
    const secondaryContainer = document.getElementById('secondary-filters-container');
    if (secondaryContainer) secondaryContainer.innerHTML = '';

    if (client) {
        document.getElementById('client-modal-title').textContent = getText('modal.edit_client.title');
        document.getElementById('client-id').value = client.id;
        document.getElementById('client-modal-id-container').classList.remove('hidden');

        const idDisplay = document.getElementById('client-modal-id-display');
        idDisplay.textContent = client.shortId || '';
        idDisplay.onclick = async () => {
            if (client.shortId) {
                try {
                    await navigator.clipboard.writeText(client.shortId);
                    // Temporarily change text to show feedback
                    const originalText = idDisplay.textContent;
                    idDisplay.textContent = "COPIED!";
                    setTimeout(() => { idDisplay.textContent = originalText; }, 1500);
                } catch (err) {
                    console.error("Failed to copy", err);
                }
            }
        };

        document.getElementById('client-name').value = client.name;
        document.getElementById('client-phone').value = client.phone || "";
        document.getElementById('client-address').value = client.address || "";
        document.getElementById('client-ville').value = (client.ville || "").trim();
        document.getElementById('client-filter-type').value = client.defaultFilterType || "";
        document.getElementById('client-filter-lifespan').value = client.filterLifespanDays || 180;
        document.getElementById('client-notes').value = client.notes || "";
        document.getElementById('client-install-date').value = client.installDate || "";
        document.getElementById('client-first-filter-change-date').value = client.firstFilterChangeDate || "";
        document.getElementById('client-next-filter-date').value = client.nextFilterDate || "";
        document.getElementById('client-next-service-price').value = client.nextServicePrice || "";

        // Populate Secondary Filters
        if (client.secondaryFilters && Array.isArray(client.secondaryFilters)) {
            client.secondaryFilters.forEach(filter => addSecondaryFilterRow(filter));
        }

        store.selectedClientId = client.id;
        document.getElementById('btn-delete-client').style.display = 'block';
        historySection.style.display = 'block';

        renderClientHistory(client.id);

    } else {
        document.getElementById('client-modal-title').textContent = getText('modal.new_client.title');
        document.getElementById('client-id').value = '';
        document.getElementById('client-modal-id-container').classList.add('hidden');
        document.getElementById('client-modal-id-display').textContent = '';
        document.getElementById('client-filter-lifespan').value = 180;
        document.getElementById('client-install-date').value = '';
        document.getElementById('client-first-filter-change-date').value = '';
        document.getElementById('client-next-filter-date').value = '';
        document.getElementById('btn-delete-client').style.display = 'none';
        historySection.style.display = 'none';
    }

    modal.dataset.fromEventModal = fromEventModal ? 'true' : 'false';
    openModal(modal);
}

function renderClientHistory(clientId) {
    const historyList = document.getElementById('client-history-list');
    historyList.innerHTML = '<p class="text-sm text-gray-400">Loading history...</p>';

    const historyEvents = store.events
        .filter(event => event.clientId === clientId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (historyEvents.length === 0) {
        historyList.innerHTML = '<p class="text-sm text-gray-400">No history found for this client.</p>';
        return;
    }

    // --- Stats Calculation ---
    // 1. First Installation
    const installEvent = historyEvents.slice().reverse().find(e => e.type === 'Installation');
    const firstInstallDate = installEvent ? installEvent.date : getText('text.not_recorded');

    // 2. Next Service (Filter Change or Maintenance)
    const todayStr = new Date().toISOString().split('T')[0];
    // Find future events of type Filter Change or Maintenance
    // Note: store.events includes all events, but historyEvents is already filtered by client.
    // However, historyEvents is sorted Descending (b - a).
    // We want the *earliest* future event.
    // So we look for events where date >= today.
    // Since it's desc, we can look from end? Or just filter and sort asc.
    const futureEvents = historyEvents
        .filter(e => e.date >= todayStr && (e.type === 'Filter Change' || e.type === 'Maintenance') && e.status !== 'Cancelled')
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // Ascending

    const nextServiceDate = futureEvents.length > 0 ? futureEvents[0].date : getText('text.none_scheduled');

    // --- Render Summary Block ---
    const summaryDiv = document.createElement('div');
    summaryDiv.className = "mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700 grid grid-cols-2 gap-2 text-center";
    summaryDiv.innerHTML = `
        <div>
            <div class="text-xs text-gray-400 uppercase tracking-wide" data-i18n="label.first_install">${getText('label.first_install')}</div>
            <div class="text-sm font-bold text-white mt-1">${firstInstallDate}</div>
        </div>
        <div>
            <div class="text-xs text-gray-400 uppercase tracking-wide" data-i18n="label.next_service">${getText('label.next_service')}</div>
            <div class="text-sm font-bold text-blue-400 mt-1">${nextServiceDate}</div>
        </div>
    `;
    historyList.innerHTML = '';
    historyList.appendChild(summaryDiv);

    if (historyEvents.length === 0) {
        historyList.innerHTML += `<p class="text-sm text-gray-400 text-center mt-2">${getText('text.no_history')}</p>`;
        return;
    }

    // Render List (Appended after summary)
    historyEvents.forEach(event => {
        const colors = getEventTypeColors(event.type, event.status);
        let statusText = event.status || 'Scheduled';
        if (event.paymentStatus === 'Paid') statusText = 'Paid';
        else if (event.paymentStatus === 'Invoiced') statusText = 'Invoiced';

        const item = document.createElement('div');
        // Adaptive class
        item.className = 'p-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg';
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-900 dark:text-white">${event.date} @ ${event.time}</span>
                <span class="text-xs font-medium px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}">${event.type}</span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">${event.notes || 'No notes.'}</p>
            <div class="flex justify-between items-center mt-2">
                 <p class="text-xs text-gray-500 dark:text-gray-400">Status: ${statusText}</p>
                 <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${event.cost ? event.cost + ' MAD' : '-'}</span>
            </div>
        `;
        historyList.appendChild(item);
    });
}
// --- Global Escape Key Listener ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const visibleModals = document.querySelectorAll('.modal-backdrop.visible');
        visibleModals.forEach(modal => closeModal(modal));
    }
});

// --- Click Outside to Close (Disabled by user request) ---
// document.addEventListener('click', (e) => {
//     if (e.target.classList.contains('modal-backdrop')) {
//         closeModal(e.target);
//     }
// });
