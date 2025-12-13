
// --- App State ---
let appId;
let currentDate = new Date();
let events = [];
let clients = [];
let inventory = [];
let selectedEventId = null;
let selectedClientId = null;
let searchFilter = '';
let toastTimer = null;
let confirmCallback = null;

// Firestore Imports
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Collection Document IDs (We store everything in single docs for simplicity to match localStorage behavior)
const EVENTS_DOC = 'events_list';
const CLIENTS_DOC = 'clients_list';
const INVENTORY_DOC = 'inventory_list';
const DATA_COLLECTION = 'app_data';

// --- App Initialization ---
try {
    // Get appId from global scope or set a default
    appId = typeof __app_id !== 'undefined' ? __app_id : 'speedyex-filtre-app-local';
    console.log("App Initializing locally for appId:", appId);

    // Immediately initialize the app
    await initApp();

} catch (error) {
    console.error("Failed to initialize app:", error);
    showLoadingError("Failed to initialize application. Check console for details: " + error.message);
}

/**
 * Shows an error message on the loading screen.
 */
/**
 * Shows an error message on the loading screen.
 */
function showLoadingError(message, retryCallback = null) {
    const overlay = document.getElementById('loading-overlay');

    let actionButtons = '';
    if (retryCallback) {
        actionButtons = `
            <button id="btn-retry-connection" class="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors">
                Retry Connection
            </button>
        `;
    }

    overlay.innerHTML = `
        <div class="flex flex-col items-center max-w-md text-center px-4">
            <i data-lucide="alert-triangle" class="w-16 h-16 text-red-500 mb-4"></i>
            <h2 class="text-xl font-bold text-white mb-2">Connection Error</h2>
            <p class="text-gray-300 mb-4">${message}</p>
            ${actionButtons}
        </div>
    `;
    lucide.createIcons();

    if (retryCallback) {
        document.getElementById('btn-retry-connection').addEventListener('click', () => {
            // Reset UI
            overlay.innerHTML = `
                <div class="spinner"></div>
                <p class="text-lg text-gray-300 mt-4">Retrying connection...</p>
             `;
            retryCallback();
        });
    }
}

/**
 * Main application initialization function.
 */
/**
 * Main application initialization function.
 */
async function initApp() {
    console.log(`Initializing app locally for appId ${appId}`);

    // Setup all UI event listeners
    setupEventListeners();

    // Load data from Firebase
    await loadDataFromFirebase();

    // Add sample data if empty (checks internal state after load)
    await addSampleDataIfNeeded();

    // Hide loading overlay
    document.getElementById('loading-overlay').style.display = 'none';

    // Render icons
    lucide.createIcons();
}

// --- Firestore Data Functions ---

/**
 * Loads all data from Firestore and triggers a full UI render.
 */
async function loadDataFromFirebase() {
    try {
        console.log("Loading data from Firestore...");

        const eventsSnap = await getDoc(doc(db, DATA_COLLECTION, EVENTS_DOC));
        const clientsSnap = await getDoc(doc(db, DATA_COLLECTION, CLIENTS_DOC));
        const inventorySnap = await getDoc(doc(db, DATA_COLLECTION, INVENTORY_DOC));

        if (eventsSnap.exists()) {
            events = eventsSnap.data().items || [];
        } else {
            console.log("No events doc found.");
            events = [];
        }

        if (clientsSnap.exists()) {
            clients = clientsSnap.data().items || [];
        } else {
            console.log("No clients doc found.");
            clients = [];
        }

        if (inventorySnap.exists()) {
            inventory = inventorySnap.data().items || [];
        } else {
            console.log("No inventory doc found.");
            inventory = [];
        }

        clients.sort((a, b) => a.name.localeCompare(b.name));
        inventory.sort((a, b) => a.name.localeCompare(b.name));

        console.log(`Loaded ${events.length} events, ${clients.length} clients, ${inventory.length} inventory items.`);

        // Trigger all UI updates
        renderCalendar();
        populateRemindersModal();
        populateClientDropdowns();
        renderClientList();
        renderInventoryList();
        populateInventoryDropdowns();

    } catch (error) {
        console.error("Error loading data:", error);

        let msg = "Error loading data from server: " + error.message;

        // Check for common permission error
        if (error.message.includes("Missing or insufficient permissions")) {
            msg = `
                <strong>Access Denied</strong><br><br>
                Your Firestore Database Security Rules are blocking access.<br>
                Please go to the 
                <a href="https://console.firebase.google.com/" target="_blank" class="text-blue-400 hover:underline">Firebase Console</a> 
                > Build > Firestore Database > Rules, and change them to allow read/write (Test Mode).
            `;
        }

        showLoadingError(msg, async () => {
            await initApp();
        });
    }
}

/**
 * Saves the events array to Firestore and re-renders.
 */
async function saveEvents() {
    try {
        await setDoc(doc(db, DATA_COLLECTION, EVENTS_DOC), { items: events });
        // After saving, re-render what's necessary
        renderCalendar();
        populateRemindersModal();
    } catch (e) {
        console.error("Error saving events:", e);
        // Optional: show toast error
    }
}

/**
 * Saves the clients array to Firestore and re-renders.
 */
async function saveClients() {
    try {
        // Re-sort before saving
        clients.sort((a, b) => a.name.localeCompare(b.name));

        await setDoc(doc(db, DATA_COLLECTION, CLIENTS_DOC), { items: clients });

        populateClientDropdowns();
        renderClientList();
    } catch (e) {
        console.error("Error saving clients:", e);
    }
}

/**
 * Saves the inventory array to Firestore and re-renders.
 */
async function saveInventory() {
    try {
        // Re-sort
        inventory.sort((a, b) => a.name.localeCompare(b.name));

        await setDoc(doc(db, DATA_COLLECTION, INVENTORY_DOC), { items: inventory });

        renderInventoryList();
        populateInventoryDropdowns();
    } catch (e) {
        console.error("Error saving inventory:", e);
    }
}

/**
 * Adds sample data if localStorage is empty.
 */
/**
 * Adds sample data if Firestore is empty.
 */
async function addSampleDataIfNeeded() {
    // Check if data already exists
    if (events.length > 0 || clients.length > 0 || inventory.length > 0) {
        console.log("Data already exists.");
        return;
    }

    console.log("No data found. Adding sample data...");

    // 1. Add sample inventory
    const sampleInv = {
        id: crypto.randomUUID(), // Generate ID
        name: "RO-5",
        quantity: 50
    };
    inventory.push(sampleInv);

    // 2. Add sample client
    const sampleClient = {
        id: crypto.randomUUID(), // Generate ID
        name: "John Sample",
        phone: "555-0101",
        address: "123 Sample St, Testville",
        defaultFilterType: sampleInv.name,
        filterLifespanDays: 180,
        notes: "First sample client.",
        createdAt: new Date().toISOString() // Use ISO string
    };
    clients.push(sampleClient);

    // 3. Add sample events
    const today = new Date();
    const eventData1 = {
        id: crypto.randomUUID(), // Generate ID
        clientId: sampleClient.id,
        clientName: sampleClient.name,
        date: today.toISOString().split('T')[0],
        time: "10:00",
        type: "Installation",
        technician: "Mike",
        cost: 250,
        notes: "Initial installation.",
        status: "Scheduled",
        paymentStatus: "Not Invoiced",
        filterUsed: null,
        createdAt: new Date().toISOString()
    };
    events.push(eventData1);

    const nextWeek = new Date(today.setDate(today.getDate() + 7));
    const eventData2 = {
        id: crypto.randomUUID(), // Generate ID
        title: "Team Debrief",
        clientId: null,
        clientName: null,
        date: nextWeek.toISOString().split('T')[0],
        time: "09:00",
        type: "General",
        technician: "All",
        cost: 0,
        notes: "Discuss Q3 goals.",
        status: "Scheduled",
        paymentStatus: "Not Invoiced",
        filterUsed: null,
        createdAt: new Date().toISOString()
    };
    events.push(eventData2);

    // 4. Save all new data to Firestore
    await saveEvents();
    await saveClients();
    await saveInventory();
}


/**
 * Sets up all global event listeners for buttons, forms, etc.
 */
function setupEventListeners() {
    // Calendar navigation
    document.getElementById('btn-prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => changeMonth(1));
    document.getElementById('btn-today').addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });

    // Header actions
    document.getElementById('btn-new-event').addEventListener('click', () => openEventModal(null, new Date()));
    document.getElementById('btn-new-client').addEventListener('click', () => openClientModal(null));
    document.getElementById('btn-view-reminders').addEventListener('click', openRemindersModal);
    document.getElementById('btn-view-inventory').addEventListener('click', openInventoryModal);
    document.getElementById('btn-view-clients').addEventListener('click', openClientListModal);
    document.getElementById('btn-toggle-dark-mode').addEventListener('click', toggleDarkMode);

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchFilter = e.target.value.toLowerCase();
        renderCalendar(); // Re-render to apply filter
    });

    // Modal close buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            closeModal(modal);
        });
    });

    // Event Modal
    document.getElementById('event-form').addEventListener('submit', handleEventFormSubmit);
    document.getElementById('btn-delete-event').addEventListener('click', deleteSelectedEvent);
    document.getElementById('event-type').addEventListener('change', toggleEventFormFields);
    document.getElementById('event-status').addEventListener('change', toggleEventFormFields); // Trigger on status change too
    document.getElementById('event-client-id').addEventListener('change', (e) => {
        // Pre-fill tech and lifespan from selected client
        const clientId = e.target.value;
        const client = clients.find(c => c.id === clientId);
        if (client) {
            const techInput = document.getElementById('event-technician');
            if (!techInput.value && client.assignedTechnician) {
                techInput.value = client.assignedTechnician;
            }
            document.getElementById('filter-lifespan').value = client.filterLifespanDays || 180;

            // Pre-fill filter used from client's default
            if (client.defaultFilterType) {
                document.getElementById('event-filter-used').value = client.defaultFilterType;
            }
        }
    });

    // Client Modal
    document.getElementById('client-form').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('btn-delete-client').addEventListener('click', deleteSelectedClient);
    document.getElementById('btn-create-new-client-inline').addEventListener('click', () => {
        closeModal(document.getElementById('event-modal'));
        openClientModal(null, true); // `true` indicates it was opened from event modal
    });

    // Client List Modal
    document.getElementById('client-list-search').addEventListener('input', renderClientList);
    document.getElementById('btn-new-client-from-list').addEventListener('click', () => {
        closeModal(document.getElementById('client-list-modal'));
        openClientModal(null); // Open new client modal
    });

    // Inventory Modal
    document.getElementById('new-filter-form').addEventListener('submit', handleNewFilterForm);

    // Confirmation Modal
    document.getElementById('btn-cancel-confirm').addEventListener('click', () => {
        closeModal(document.getElementById('confirmation-modal'));
    });
    document.getElementById('btn-confirm-action').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeModal(document.getElementById('confirmation-modal'));
    });
}

// --- Calendar Logic ---

/**
 * Renders the main calendar grid for the `currentDate`.
 */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; // Clear existing grid

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    // Update header
    document.getElementById('month-year-header').textContent =
        `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;

    // Get calendar days
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // 42 cells for 6 weeks
    for (let i = 0; i < 42; i++) {
        const cell = document.createElement('div');
        // Dark theme cell
        cell.className = 'calendar-day-cell bg-gray-900 border-t border-l border-gray-700 p-2 overflow-hidden';

        let dayNum, dateObj, dateStr;

        if (i < firstDayOfMonth) {
            // Previous month
            dayNum = prevMonthDays - firstDayOfMonth + 1 + i;
            dateObj = new Date(year, month - 1, dayNum);
            cell.classList.add('other-month');
        } else if (i >= firstDayOfMonth && i < firstDayOfMonth + daysInMonth) {
            // Current month
            dayNum = i - firstDayOfMonth + 1;
            dateObj = new Date(year, month, dayNum);
            if (dateObj.toISOString().split('T')[0] === todayStr) {
                cell.classList.add('today');
            }
        } else {
            // Next month
            dayNum = i - firstDayOfMonth - daysInMonth + 1;
            dateObj = new Date(year, month + 1, dayNum);
            cell.classList.add('other-month');
        }

        dateStr = dateObj.toISOString().split('T')[0];
        cell.dataset.date = dateStr;

        // Add day number
        cell.innerHTML = `<span class="day-number text-sm">${dayNum}</span>`;

        // Find and render events for this day
        const dayEvents = getEventsForDay(dateStr);
        const eventList = document.createElement('div');
        eventList.className = 'mt-1 space-y-1 overflow-y-auto max-h-[80px]';

        dayEvents.forEach(event => {
            const eventPill = document.createElement('div');
            eventPill.className = 'event-pill text-xs font-medium px-2 py-0.5 rounded-md cursor-pointer truncate flex items-center';

            // NEW: Add status icons
            let statusIcon = '';
            if (event.paymentStatus === 'Paid') {
                statusIcon = `<i data-lucide="dollar-sign" class="status-icon text-green-500"></i>`;
            } else if (event.status === 'Completed') {
                statusIcon = `<i data-lucide="check-circle" class="status-icon text-green-500"></i>`;
            } else if (event.status === 'Cancelled') {
                statusIcon = `<i data-lucide="x-circle" class="status-icon text-red-400"></i>`;
            }

            eventPill.innerHTML = `${statusIcon}<span>${event.clientName || event.title}</span>`;

            const colors = getEventTypeColors(event.type, event.status);
            eventPill.classList.add(colors.bg, colors.text);

            eventPill.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent day click
                openEventModal(event);
            });
            eventList.appendChild(eventPill);
        });

        cell.appendChild(eventList);

        // Add click listener to day cell (for adding new event)
        cell.addEventListener('click', () => {
            openEventModal(null, dateObj);
        });

        grid.appendChild(cell);
    }

    // Re-render icons for any new elements
    lucide.createIcons();
}

/**
 * Gets sorted, filtered events for a specific date string (YYYY-MM-DD).
 */
function getEventsForDay(dateStr) {
    return events
        .filter(event => event.date === dateStr)
        .filter(event => {
            if (!searchFilter) return true;
            const title = (event.title || '').toLowerCase();
            const client = (event.clientName || '').toLowerCase();
            return title.includes(searchFilter) || client.includes(searchFilter);
        })
        .sort((a, b) => a.time.localeCompare(b.time)); // Sort by time
}

/**
 * Changes the current month and re-renders the calendar.
 */
function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

/**
 * Returns Tailwind color classes for an event type. (Dark theme)
 */
function getEventTypeColors(type, status = 'Scheduled') {
    // If cancelled, always return grey
    if (status === 'Cancelled') {
        return { bg: 'bg-gray-700', text: 'text-gray-400 line-through' };
    }
    // If completed, return a slightly faded version
    if (status === 'Completed') {
        switch (type) {
            case 'Installation':
                return { bg: 'bg-blue-900', text: 'text-blue-200' };
            case 'Maintenance':
                return { bg: 'bg-green-900', text: 'text-green-200' };
            case 'Filter Change':
                return { bg: 'bg-yellow-900', text: 'text-yellow-200' };
            case 'General':
                return { bg: 'bg-purple-900', text: 'text-purple-200' };
            default:
                return { bg: 'bg-gray-800', text: 'text-gray-300' };
        }
    }

    // Default active colors
    switch (type) {
        case 'Installation':
            return { bg: 'bg-blue-600', text: 'text-white' };
        case 'Maintenance':
            return { bg: 'bg-green-600', text: 'text-white' };
        case 'Filter Change':
            return { bg: 'bg-yellow-500', text: 'text-gray-900' }; // Keep text dark for yellow
        case 'General':
            return { bg: 'bg-purple-600', text: 'text-white' };
        default:
            return { bg: 'bg-gray-600', text: 'text-white' };
    }
}

// --- Modal Logic ---

/**
 * Opens the Confirmation Modal.
 */
function openConfirmationModal(message, onConfirm) {
    document.getElementById('confirmation-message').textContent = message;
    confirmCallback = onConfirm;
    openModal(document.getElementById('confirmation-modal'));
}

/**
 * Opens a modal.
 */
function openModal(modal) {
    modal.classList.add('visible');
}

/**
 * Closes a modal.
 */
function closeModal(modal) {
    modal.classList.remove('visible');
}

/**
 * Opens the Event Modal to add or edit an event.
 * @param {object|null} event - The event object to edit, or null for new.
 * @param {Date|null} date - The date to pre-fill for a new event.
 */
function openEventModal(event = null, date = null) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    form.reset();

    selectedEventId = null; // Reset

    if (event) {
        // Edit existing event
        document.getElementById('event-modal-title').textContent = 'Edit Appointment';
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-type').value = event.type;
        document.getElementById('event-client-id').value = event.clientId || "";
        document.getElementById('event-title').value = event.title || "";
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time;
        document.getElementById('event-technician').value = event.technician || "";
        document.getElementById('event-cost').value = event.cost || "";
        document.getElementById('event-notes').value = event.notes || "";

        // NEW: Set status fields
        document.getElementById('event-status').value = event.status || "Scheduled";
        document.getElementById('event-payment-status').value = event.paymentStatus || "Not Invoiced";
        document.getElementById('event-filter-used').value = event.filterUsed || "";

        // Store old values for inventory logic
        document.getElementById('event-old-status').value = event.status || "Scheduled";
        document.getElementById('event-old-filter-used').value = event.filterUsed || "";

        selectedEventId = event.id;
        document.getElementById('btn-delete-event').style.display = 'block';

    } else {
        // New event
        document.getElementById('event-modal-title').textContent = 'New Appointment';
        document.getElementById('event-id').value = '';
        if (date) {
            document.getElementById('event-date').value = date.toISOString().split('T')[0];
        }
        // Set defaults for new event
        document.getElementById('event-status').value = "Scheduled";
        document.getElementById('event-payment-status').value = "Not Invoiced";
        document.getElementById('event-old-status').value = "Scheduled";

        document.getElementById('btn-delete-event').style.display = 'none';
    }

    toggleEventFormFields(); // Show/hide fields based on type
    openModal(modal);
}

/**
 * Adjusts the event form fields based on the selected event type.
 */
function toggleEventFormFields() {
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

        // Show filter used dropdown for install/change
        if (eventType === 'Installation' || eventType === 'Filter Change') {
            filterUsedSection.style.display = 'block';
        } else {
            filterUsedSection.style.display = 'none';
        }

        // Show smart reminder only for new installations
        const isNewEvent = !document.getElementById('event-id').value;
        if (eventType === 'Installation' && isNewEvent) {
            smartReminderSection.style.display = 'block';
            // Pre-fill lifespan from client if one is selected
            const clientId = document.getElementById('event-client-id').value;
            const client = clients.find(c => c.id === clientId);
            if (client) {
                document.getElementById('filter-lifespan').value = client.filterLifespanDays || 180;
            }
        } else {
            smartReminderSection.style.display = 'none';
        }
    }

    // Show billing section only if status is Completed
    if (eventStatus === 'Completed') {
        billingSection.style.display = 'block';
    } else {
        billingSection.style.display = 'none';
        // Reset payment status if job is not complete
        document.getElementById('event-payment-status').value = 'Not Invoiced';
    }
}

/**
 * Opens the Client Modal to add or edit a client.
 * @param {object|null} client - The client object to edit, or null for new.
 * @param {boolean} fromEventModal - Flag if opened from event modal.
 */
function openClientModal(client = null, fromEventModal = false) {
    const modal = document.getElementById('client-modal');
    const form = document.getElementById('client-form');
    form.reset();

    const historySection = document.getElementById('client-history-section');
    const historyList = document.getElementById('client-history-list');
    historyList.innerHTML = '<p class="text-sm text-gray-400">No history found for this client.</p>';

    selectedClientId = null;

    // Make sure filter dropdown is populated
    populateInventoryDropdowns();

    if (client) {
        // Edit existing client
        document.getElementById('client-modal-title').textContent = 'Edit Client';
        document.getElementById('client-id').value = client.id;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-phone').value = client.phone || "";
        document.getElementById('client-address').value = client.address || "";
        document.getElementById('client-filter-type').value = client.defaultFilterType || ""; // Now a select
        document.getElementById('client-filter-lifespan').value = client.filterLifespanDays || 180;
        document.getElementById('client-notes').value = client.notes || "";

        selectedClientId = client.id;
        document.getElementById('btn-delete-client').style.display = 'block';
        historySection.style.display = 'block';

        // Load client history
        renderClientHistory(client.id);

    } else {
        // New client
        document.getElementById('client-modal-title').textContent = 'New Client';
        document.getElementById('client-id').value = '';
        document.getElementById('client-filter-lifespan').value = 180; // Default
        document.getElementById('btn-delete-client').style.display = 'none';
        historySection.style.display = 'none';
    }

    // Store flag to know if we should re-open event modal
    modal.dataset.fromEventModal = fromEventModal ? 'true' : 'false';

    openModal(modal);
}

/**
 * Fetches and renders the maintenance history for a client from the global `events` array.
 */
function renderClientHistory(clientId) {
    const historyList = document.getElementById('client-history-list');
    historyList.innerHTML = '<p class="text-sm text-gray-400">Loading history...</p>';

    const historyEvents = events
        .filter(event => event.clientId === clientId)
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort descending

    if (historyEvents.length === 0) {
        historyList.innerHTML = '<p class="text-sm text-gray-400">No history found for this client.</p>';
        return;
    }

    historyList.innerHTML = ''; // Clear

    historyEvents.forEach(event => {
        const colors = getEventTypeColors(event.type, event.status);

        let statusText = event.status || 'Scheduled';
        if (event.paymentStatus === 'Paid') {
            statusText = 'Paid';
        } else if (event.paymentStatus === 'Invoiced') {
            statusText = 'Invoiced';
        }

        const item = document.createElement('div');
        // Dark theme history item
        item.className = 'p-3 bg-gray-900/50 border border-gray-700 rounded-lg';
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-white">${event.date} @ ${event.time}</span>
                <span class="text-xs font-medium px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}">${event.type}</span>
            </div>
            <p class="text-sm text-gray-300 mt-1">${event.notes || 'No notes.'}</p>
            <p class="text-xs text-gray-400 mt-1">Status: ${statusText}</p>
        `;
        historyList.appendChild(item);
    });
}

/**
 * Opens the modal showing upcoming events/reminders.
 */
function populateRemindersModal() {
    const list = document.getElementById('reminders-list');
    list.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0];

    const upcomingEvents = events
        .filter(event => event.date >= todayStr && event.status !== 'Cancelled') // Hide cancelled
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    if (upcomingEvents.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-400">No upcoming events found.</p>';
        return;
    }

    upcomingEvents.forEach(event => {
        const colors = getEventTypeColors(event.type, event.status);
        const item = document.createElement('div');
        // Dark theme reminder item
        item.className = 'p-3 bg-gray-900/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors';
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-white">${event.date} @ ${event.time}</span>
                <span class="text-xs font-medium px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}">${event.type}</span>
            </div>
            <p class="text-sm text-gray-300 mt-1 font-medium">${event.clientName || event.title}</p>
            <p class="text-sm text-gray-400 mt-1 truncate">${event.notes || 'No notes.'}</p>
        `;

        // Add click to open and edit the event
        item.addEventListener('click', () => {
            closeModal(document.getElementById('reminders-modal'));
            openEventModal(event);
        });

        list.appendChild(item);
    });
}

function openRemindersModal() {
    populateRemindersModal();
    openModal(document.getElementById('reminders-modal'));
}

// --- Inventory Modal Logic ---
function openInventoryModal() {
    renderInventoryList();
    openModal(document.getElementById('inventory-modal'));
}

/**
 * Renders the list of filter types in the inventory modal.
 */
function renderInventoryList() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = ''; // Clear

    if (inventory.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-400">No inventory items found. Add one above.</p>';
        return;
    }

    inventory.forEach(item => {
        const el = document.createElement('div');
        // Dark theme inventory item
        el.className = 'flex items-center justify-between p-3 bg-gray-900/50 border border-gray-700 rounded-lg';
        el.innerHTML = `
            <div>
                <span class="font-semibold text-white">${item.name}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-lg font-bold text-white w-12 text-center">${item.quantity}</span>
                <button type="button" class="btn-update-stock p-2 bg-gray-700 hover:bg-gray-600 rounded-lg" data-id="${item.id}" data-amount="-1">
                    <i data-lucide="minus" class="w-4 h-4"></i>
                </button>
                <button type="button" class="btn-update-stock p-2 bg-gray-700 hover:bg-gray-600 rounded-lg" data-id="${item.id}" data-amount="1">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        list.appendChild(el);
    });

    // Add listeners to new buttons
    list.querySelectorAll('.btn-update-stock').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const amount = parseInt(e.currentTarget.dataset.amount);
            updateInventoryQuantity(id, amount);
        });
    });

    lucide.createIcons();
}

// --- Client List Modal Logic ---
function openClientListModal() {
    renderClientList(); // Render the list with current clients
    openModal(document.getElementById('client-list-modal'));
    // Ensure icons are rendered
    lucide.createIcons();
}

/**
 * Renders the filterable list of all clients.
 */
function renderClientList() {
    const list = document.getElementById('client-list-container');
    const searchInput = document.getElementById('client-list-search');
    const filter = searchInput ? searchInput.value.toLowerCase() : '';

    if (!list) return;
    list.innerHTML = ''; // Clear

    const filteredClients = clients.filter(client => {
        if (!filter) return true;
        const name = (client.name || '').toLowerCase();
        const phone = (client.phone || '').toLowerCase();
        const address = (client.address || '').toLowerCase();
        return name.includes(filter) || phone.includes(filter) || address.includes(filter);
    });

    if (filteredClients.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-400">No clients found.</p>';
        return;
    }

    filteredClients.forEach(client => {
        const el = document.createElement('div');
        // Dark theme client list item
        el.className = 'p-4 bg-gray-900/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors';
        el.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-semibold text-white">${client.name}</span>
                <span class="text-sm text-gray-400">${client.phone || 'No phone'}</span>
            </div>
            <p class="text-sm text-gray-400 mt-1 truncate">${client.address || 'No address'}</p>
        `;

        // Add click listener to open the edit modal
        el.addEventListener('click', () => {
            closeModal(document.getElementById('client-list-modal'));
            openClientModal(client); // Open client modal for *editing*
        });

        list.appendChild(el);
    });
}

/**
 * Handles the form to add a new filter type to inventory.
 */
function handleNewFilterForm(e) {
    e.preventDefault();
    const form = e.target;
    const name = form['new-filter-name'].value;
    const quantity = parseInt(form['new-filter-quantity'].value);

    if (!name || isNaN(quantity)) {
        console.warn("Invalid new filter form submission");
        return;
    }

    const existing = inventory.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        console.warn("Inventory item already exists");
        return;
    }

    const newItem = {
        id: crypto.randomUUID(), // Generate ID
        name: name,
        quantity: quantity
    };
    inventory.push(newItem);
    saveInventory(); // Save and re-render

    form.reset();
}

/**
 * Updates the quantity of an inventory item.
 */
function updateInventoryQuantity(idOrName, amount) {
    let item;
    // Find by ID first
    item = inventory.find(i => i.id === idOrName);
    // If not found, find by name
    if (!item) {
        item = inventory.find(i => i.name === idOrName);
    }

    if (!item) {
        console.error("Inventory item not found:", idOrName);
        return;
    }

    const newQuantity = item.quantity + amount;
    if (newQuantity < 0) {
        console.warn(`Cannot reduce stock for ${item.name}. Only ${item.quantity} left.`);
        return;
    }

    // Modify the item in the array
    item.quantity = newQuantity;
    saveInventory(); // Save the entire inventory array
}

// --- Form Submission & Data Logic ---

/**
 * Handles saving (add/edit) an event.
 */
function handleEventFormSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('event-modal');
    const form = e.target;
    const id = form['event-id'].value;

    const selectedClientId = form['event-client-id'].value;
    const client = clients.find(c => c.id === selectedClientId);

    const eventData = {
        // id, createdAt, updatedAt added below
        type: form['event-type'].value,
        clientId: selectedClientId || null,
        clientName: client ? client.name : null,
        title: form['event-title'].value || null,
        date: form['event-date'].value,
        time: form['event-time'].value || "00:00",
        technician: form['event-technician'].value,
        cost: parseFloat(form['event-cost'].value) || 0,
        notes: form['event-notes'].value,
        status: form['event-status'].value,
        paymentStatus: form['event-payment-status'].value,
        filterUsed: form['event-filter-used'].value || null,
    };

    if (!eventData.date) {
        console.warn("Date is required to save event.");
        return;
    }

    if (id) {
        // Update existing
        const index = events.findIndex(ev => ev.id === id);
        if (index > -1) {
            events[index] = {
                ...events[index], // Preserve old fields like createdAt
                ...eventData,     // Apply new data
                id: id,           // Ensure ID is retained
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Create new
        eventData.id = crypto.randomUUID(); // Add new ID
        eventData.createdAt = new Date().toISOString();
        eventData.updatedAt = new Date().toISOString();
        events.push(eventData);

        // Check for Smart Reminder
        if (eventData.type === 'Installation' && form['create-smart-reminder'].checked) {
            createSmartReminder(eventData, client, form['filter-lifespan'].value);
        }
    }

    saveEvents(); // Save the updated events array

    // Handle inventory changes
    const oldStatus = form['event-old-status'].value;
    const newStatus = eventData.status;
    const oldFilter = form['event-old-filter-used'].value;
    const newFilter = eventData.filterUsed;

    // Case 1: Job marked as "Completed"
    if (newStatus === 'Completed' && oldStatus !== 'Completed') {
        if (newFilter) {
            updateInventoryQuantity(newFilter, -1);
            showToast(`Stock for ${newFilter} reduced by 1.`);
        }
    }
    // Case 2: Job "un-completed" (e.g., set back to Scheduled)
    else if (newStatus !== 'Completed' && oldStatus === 'Completed') {
        if (oldFilter) {
            updateInventoryQuantity(oldFilter, 1); // Restock
            showToast(`Stock for ${oldFilter} restocked by 1.`);
        }
    }
    // Case 3: Job was already "Completed" but filter was changed
    else if (newStatus === 'Completed' && oldStatus === 'Completed' && newFilter !== oldFilter) {
        // Restock old filter, deduct new filter
        if (oldFilter) updateInventoryQuantity(oldFilter, 1);
        if (newFilter) updateInventoryQuantity(newFilter, -1);
        showToast(`Stock updated.`);
    }

    closeModal(modal);
}

/**
 * Creates a future "Filter Change" event based on an installation.
 * This just pushes to the `events` array; parent function must call `saveEvents()`.
 */
function createSmartReminder(installEvent, client, lifespanDays) {
    if (!client || !installEvent.date) return;

    const installDate = new Date(installEvent.date + 'T' + (installEvent.time || '12:00:00'));
    const lifespan = parseInt(lifespanDays) || 180;

    const changeDate = new Date(installDate);
    changeDate.setDate(changeDate.getDate() + lifespan);

    const reminderEventData = {
        id: crypto.randomUUID(), // Generate ID
        type: "Filter Change",
        clientId: client.id,
        clientName: client.name,
        title: `Filter Change for ${client.name}`,
        date: changeDate.toISOString().split('T')[0],
        time: installEvent.time || "10:00", // Default to same time
        technician: installEvent.technician,
        cost: 0, // Placeholder cost
        notes: `Automatic reminder scheduled from installation on ${installEvent.date}. Filter lifespan: ${lifespan} days.`,
        status: "Scheduled",
        paymentStatus: "Not Invoiced",
        filterUsed: null,
        createdAt: new Date().toISOString()
    };

    events.push(reminderEventData);
    console.log("Smart reminder prepared.");
}

/**
 * Handles saving (add/edit) a client.
 */
function handleClientFormSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('client-modal');
    const form = e.target;
    const id = form['client-id'].value;

    const clientData = {
        // id, createdAt, updatedAt added below
        name: form['client-name'].value,
        phone: form['client-phone'].value,
        address: form['client-address'].value,
        defaultFilterType: form['client-filter-type'].value,
        filterLifespanDays: parseInt(form['client-filter-lifespan'].value) || 180,
        notes: form['client-notes'].value,
    };

    if (!clientData.name) {
        console.warn("Client name is required.");
        return;
    }

    let newClientId = id;
    if (id) {
        // Update existing
        const index = clients.findIndex(c => c.id === id);
        if (index > -1) {
            clients[index] = {
                ...clients[index], // Preserve createdAt
                ...clientData,     // Apply new data
                id: id,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Create new
        newClientId = crypto.randomUUID(); // Get new ID
        clientData.id = newClientId;
        clientData.createdAt = new Date().toISOString();
        clientData.updatedAt = new Date().toISOString();
        clients.push(clientData);
    }

    saveClients(); // Save and re-render clients

    if (!id && modal.dataset.fromEventModal === 'true') {
        // If we created a new client from event modal
        setTimeout(() => {
            document.getElementById('event-client-id').value = newClientId; // Use the new ID
            toggleEventFormFields();
        }, 100);
    }

    closeModal(modal);

    if (modal.dataset.fromEventModal === 'true') {
        openModal(document.getElementById('event-modal'));
    }
}

/**
 * Deletes the currently selected event.
 */
function deleteSelectedEvent() {
    if (!selectedEventId) return;

    openConfirmationModal("Are you sure you want to delete this event?", () => {
        const eventToDelete = events.find(e => e.id === selectedEventId);
        if (!eventToDelete) return;

        const index = events.findIndex(e => e.id === selectedEventId);
        if (index > -1) {
            events.splice(index, 1);
            saveEvents();

            // If the deleted event was "Completed", restock inventory
            let didRestock = false;
            if (eventToDelete.status === 'Completed' && eventToDelete.filterUsed) {
                updateInventoryQuantity(eventToDelete.filterUsed, 1);
                didRestock = true;
            }

            const toastMsg = didRestock
                ? `Event deleted. Stock for ${eventToDelete.filterUsed} restocked.`
                : "Event deleted.";

            showToast(toastMsg, () => {
                // Undo action
                events.push(eventToDelete);
                saveEvents();

                // If we restocked, we need to un-restock (deduct) to revert
                if (didRestock) {
                    updateInventoryQuantity(eventToDelete.filterUsed, -1);
                }
            });
        }
        closeModal(document.getElementById('event-modal'));
        selectedEventId = null;
    });
}

/**
 * Deletes the currently selected client.
 */
function deleteSelectedClient() {
    if (!selectedClientId) return;

    openConfirmationModal("Are you sure you want to delete this client? This will remove all their data.", () => {
        const index = clients.findIndex(c => c.id === selectedClientId);
        if (index > -1) {
            const deletedClient = clients[index];
            clients.splice(index, 1);
            saveClients();

            showToast("Client deleted.", () => {
                // Undo action
                clients.push(deletedClient);
                saveClients();
            });
        }
        closeModal(document.getElementById('client-modal'));
        selectedClientId = null;
    });
}

/**
 * Populates all client <select> dropdowns.
 */
function populateClientDropdowns() {
    const select = document.getElementById('event-client-id');
    if (!select) return;
    const currentVal = select.value; // Preserve selection

    select.innerHTML = '<option value="">Select an existing client</option>'; // Clear

    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        select.appendChild(option);
    });

    select.value = currentVal; // Restore selection
}

/**
 * Populates all filter <select> dropdowns from inventory.
 */
function populateInventoryDropdowns() {
    const dropdowns = [
        document.getElementById('event-filter-used'),
        document.getElementById('client-filter-type')
    ];

    dropdowns.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">None</option>'; // Clear

        inventory.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name; // Use name as the value
            option.textContent = `${item.name} (${item.quantity} in stock)`;
            select.appendChild(option);
        });

        select.value = currentVal; // Restore selection
    });
}

/**
 * Shows a toast notification with an optional Undo action.
 */
function showToast(message, undoCallback = null) {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    const undoBtn = document.getElementById('toast-undo-btn');

    // Clear any existing timer
    if (toastTimer) clearTimeout(toastTimer);

    msgEl.textContent = message;

    if (undoCallback) {
        undoBtn.style.display = 'block';
        // Remove previous listener to avoid duplicates
        const newUndoBtn = undoBtn.cloneNode(true);
        undoBtn.parentNode.replaceChild(newUndoBtn, undoBtn);

        newUndoBtn.addEventListener('click', () => {
            undoCallback();
            toast.classList.remove('show');
            if (toastTimer) clearTimeout(toastTimer);
        });
    } else {
        undoBtn.style.display = 'none';
    }

    toast.classList.add('show');

    // Auto-hide after 5 seconds
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

/**
 * Toggles the light/dark theme.
 */
function toggleDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
    } else {
        html.classList.add('dark');
    }
    // Icons are toggled via Tailwind's dark: prefix
    lucide.createIcons(); // Re-render icons to ensure toggle button updates
}

// Final icon render on init
lucide.createIcons();
