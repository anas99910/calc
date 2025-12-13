export const store = {
    appId: typeof __app_id !== 'undefined' ? __app_id : 'speedyex-filtre-app-local',
    currentDate: new Date(),
    events: [],
    clients: [],
    inventory: [],
    selectedEventId: null,
    selectedClientId: null,
    searchFilter: '',
    toastTimer: null,
    confirmCallback: null,

    // Methods to manipulate state (optional, can stay direct for now)
    setEvents(newEvents) { this.events = newEvents || []; },
    setClients(newClients) { this.clients = newClients || []; },
    setInventory(newInventory) { this.inventory = newInventory || []; }
};
