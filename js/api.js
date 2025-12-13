import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { store } from './store.js';

// Collection Document IDs (Using single docs to match legacy localStorage structure)
const EVENTS_DOC = 'events_list';
const CLIENTS_DOC = 'clients_list';
const INVENTORY_DOC = 'inventory_list';
const DATA_COLLECTION = 'app_data';

/**
 * Loads all data from Firestore and updates the store.
 * @returns {Promise<void>}
 */
export async function loadDataFromFirebase() {
    console.log("Loading data from Firestore...");

    const eventsSnap = await getDoc(doc(db, DATA_COLLECTION, EVENTS_DOC));
    const clientsSnap = await getDoc(doc(db, DATA_COLLECTION, CLIENTS_DOC));
    const inventorySnap = await getDoc(doc(db, DATA_COLLECTION, INVENTORY_DOC));

    if (eventsSnap.exists()) {
        store.setEvents(eventsSnap.data().items || []);
    } else {
        console.log("No events doc found.");
        store.setEvents([]);
    }

    if (clientsSnap.exists()) {
        store.setClients(clientsSnap.data().items || []);
    } else {
        console.log("No clients doc found.");
        store.setClients([]);
    }

    if (inventorySnap.exists()) {
        store.setInventory(inventorySnap.data().items || []);
    } else {
        console.log("No inventory doc found.");
        store.setInventory([]);
    }

    // Sort data
    store.clients.sort((a, b) => a.name.localeCompare(b.name));
    store.inventory.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Loaded ${store.events.length} events, ${store.clients.length} clients, ${store.inventory.length} inventory items.`);
}

/**
 * Saves events to Firestore.
 */
export async function saveEvents() {
    try {
        await setDoc(doc(db, DATA_COLLECTION, EVENTS_DOC), { items: store.events });
    } catch (e) {
        console.error("Error saving events:", e);
        throw e;
    }
}

/**
 * Saves clients to Firestore.
 */
export async function saveClients() {
    try {
        store.clients.sort((a, b) => a.name.localeCompare(b.name));
        await setDoc(doc(db, DATA_COLLECTION, CLIENTS_DOC), { items: store.clients });
    } catch (e) {
        console.error("Error saving clients:", e);
        throw e;
    }
}

/**
 * Saves inventory to Firestore.
 */
export async function saveInventory() {
    try {
        store.inventory.sort((a, b) => a.name.localeCompare(b.name));
        await setDoc(doc(db, DATA_COLLECTION, INVENTORY_DOC), { items: store.inventory });
    } catch (e) {
        console.error("Error saving inventory:", e);
        throw e;
    }
}
