import { store } from './store.js';
import { translations } from './translations.js';
import { openModal, closeModal } from './modals.js';

// --- Language Logic ---

let currentLang = localStorage.getItem('app_language') || 'en';

export function initSettings() {
    // Set initial language
    setLanguage(currentLang);

    // Bind Settings Button
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
        settingsBtn.onclick = () => openModal(document.getElementById('settings-modal'));
    }

    // Bind Language Buttons
    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');

    if (btnEn) btnEn.onclick = () => setLanguage('en');
    if (btnFr) btnFr.onclick = () => setLanguage('fr');

    // Bind Export Button
    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) btnExport.onclick = exportToExcel;
}

export function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('app_language', lang);

    const t = translations[lang];
    if (!t) return;

    // Update Text Content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    // Update Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (t[key]) {
            el.placeholder = t[key];
        }
    });

    // Update active button state in modal
    updateLangButtonState();
}

function updateLangButtonState() {
    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');
    if (!btnEn || !btnFr) return;

    if (currentLang === 'en') {
        btnEn.classList.add('bg-blue-600', 'text-white');
        btnEn.classList.remove('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');

        btnFr.classList.remove('bg-blue-600', 'text-white');
        btnFr.classList.add('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');
    } else {
        btnFr.classList.add('bg-blue-600', 'text-white');
        btnFr.classList.remove('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');

        btnEn.classList.remove('bg-blue-600', 'text-white');
        btnEn.classList.add('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');
    }
}

// --- Excel Export Logic ---

function exportToExcel() {
    try {
        // 1. Prepare Data
        const clientsData = store.clients.map(c => ({
            ID: c.id,
            Name: c.name,
            Phone: c.phone,
            Address: c.address,
            DefaultClient: c.defaultFilterType,
            Notes: c.notes
        }));

        const eventsData = store.events.map(e => ({
            ID: e.id,
            Date: e.date,
            Time: e.time,
            Client: e.clientName || 'N/A',
            Type: e.type,
            Status: e.status,
            Technician: e.technician,
            Cost: e.cost,
            Payment: e.paymentStatus,
            FilterUsed: e.filterUsed,
            Notes: e.notes
        }));

        const inventoryData = store.inventory.map(i => ({
            Item: i.name,
            Quantity: i.quantity,
            MinQuantity: i.minQuantity
        }));

        // 2. Create Workbook
        const wb = XLSX.utils.book_new();

        const wsClients = XLSX.utils.json_to_sheet(clientsData);
        XLSX.utils.book_append_sheet(wb, wsClients, "Clients");

        const wsEvents = XLSX.utils.json_to_sheet(eventsData);
        XLSX.utils.book_append_sheet(wb, wsEvents, "Events");

        const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
        XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory");

        // 3. Generate File Name
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Speedyex_Backup_${dateStr}.xlsx`;

        // 4. Download
        XLSX.writeFile(wb, fileName);

        closeModal(document.getElementById('settings-modal'));
        alert("Backup downloaded successfully!");

    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export data. See console for details.");
    }
}
