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

    // Bind Sync Calendar Button
    const btnSync = document.getElementById('btn-sync-calendar');
    if (btnSync) btnSync.onclick = exportToICS;

    // Bind Logout Button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = async () => {
            const { logout } = await import('./auth.js');
            logout();
        };
    }

    // --- PWA Install Logic ---
    const installContainer = document.getElementById('install-container');
    const installBtn = document.getElementById('btn-install-app');

    // 1. Check if event was already captured in index.html
    if (window.deferredPrompt) {
        console.log("PWA: Found existing deferredPrompt from index.html");
    }

    // 2. Handle Click
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            const promptEvent = window.deferredPrompt;
            if (!promptEvent) {
                // Fallback instructions
                if (window.showToast) {
                    showToast("To install: Click the 'Share' icon (iOS) or 'Menu' (Android/PC) > 'Add to Home Screen'.", "info");
                } else {
                    alert("To install: Click the browser menu (three dots) -> 'Install App' or 'Add to Home Screen'.");
                }
                return;
            }

            // Show prompt
            promptEvent.prompt();

            // Wait for choice
            const { outcome } = await promptEvent.userChoice;
            console.log(`User response to install prompt: ${outcome}`);

            window.deferredPrompt = null;
        });
    }

    // 3. Check if already installed (optional clean up)
    window.addEventListener('appinstalled', () => {
        if (installContainer) installContainer.classList.add('hidden');
        console.log('App installed successfully');
    });
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

/**
 * Helper to get translated string by key.
 * Falls back to English if key/lang missing.
 */
export function getText(key) {
    const t = translations[currentLang] || translations['en'];
    return t[key] || translations['en'][key] || key;
}

export function getCurrentLang() {
    return currentLang;
}


// Global exposure for legacy scripts/HTML oneliners if needed
window.getText = getText;

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
        // --- Sheet 1: Clients (Detailed) ---
        const clientsData = store.clients.map(c => {
            // Stats
            const clientEvents = store.events.filter(e => e.clientId === c.id);
            const totalRevenue = clientEvents.reduce((sum, e) => sum + (e.cost || 0), 0);
            const completedJobs = clientEvents.filter(e => e.status === 'Completed').length;

            // Format Secondary Filters
            let secFiltersStr = "";
            if (c.secondaryFilters && c.secondaryFilters.length > 0) {
                secFiltersStr = c.secondaryFilters.map(sf => `${sf.type} (${sf.nextDate})`).join("; ");
            }

            return {
                "ID": c.id,
                "Nom Complet": c.name,
                "Téléphone": c.phone || "",
                "Adresse": c.address ? c.address.replace(/\n/g, ", ") : "",
                "Ville": c.ville || inferCity(c.address),
                "Installé Le": c.installDate || "N/A",
                "Premier Changement": c.firstFilterChangeDate || "N/A", // NEW
                "Prochain Service": c.nextFilterDate || "N/A",
                "Prix Service (MAD)": c.nextServicePrice || 0, // NEW
                "Type Filtre": c.defaultFilterType || "",
                "Filtres Secondaires": secFiltersStr, // NEW
                "Durée (Jours)": c.filterLifespanDays || 180,
                "Notes": c.notes || "",
                "Total Revenu (MAD)": totalRevenue,
                "Interventions": completedJobs
            };
        });

        // --- Sheet 2: Events (Enriched) ---
        const eventsData = store.events.map(e => {
            const client = store.clients.find(c => c.id === e.clientId);
            let clientName = e.clientName || (client ? client.name : "Inconnu");

            // Format Date
            let formattedDate = e.date;
            if (e.date) {
                const parts = e.date.split('-');
                if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            return {
                "Date": formattedDate,
                "Heure": e.time || "",
                "Titre": e.title || "", // NEW
                "Client": clientName,
                "Téléphone": client ? client.phone : "",
                "Type": e.type,
                "Statut": e.status,
                "Statut Paiement": e.paymentStatus || "Not Invoiced", // NEW
                "Coût (MAD)": e.cost || 0,
                "Filtre Utilisé": e.filterUsed || "", // NEW
                "Technicien": e.assignedTechnician || "",
                "Notes": e.notes || "",
                "Ville": client ? (client.ville || inferCity(client.address)) : ""
            };
        });

        // --- Sheet 3: Inventory ---
        const inventoryData = store.inventory.map(i => ({
            "Article": i.name,
            "Quantité en Stock": i.quantity
        }));

        // Create Workbook
        const wb = XLSX.utils.book_new();

        // Add Sheets
        if (clientsData.length > 0) {
            const wsClients = XLSX.utils.json_to_sheet(clientsData);
            // Auto-width (basic)
            wsClients['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, wsClients, "Clients");
        }

        if (eventsData.length > 0) {
            const wsEvents = XLSX.utils.json_to_sheet(eventsData);
            wsEvents['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsEvents, "Historique");
        }

        if (inventoryData.length > 0) {
            const wsInv = XLSX.utils.json_to_sheet(inventoryData);
            wsInv['!cols'] = [{ wch: 40 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsInv, "Stock");
        }

        // Generate File Name
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Export_Complet_Speedyex_${dateStr}.xlsx`;

        // Download
        XLSX.writeFile(wb, fileName);

        if (window.showToast) {
            showToast(getText('msg.export_success'), "success");
        } else {
            alert(getText('msg.export_success'));
        }

        const modal = document.getElementById('settings-modal');
        if (modal) closeModal(modal);

    } catch (error) {
        console.error("Export failed:", error);
        alert("Export failed: " + error.message);
    }
}

function inferCity(address) {
    if (!address) return "CASABLANCA"; // Default
    const addrUpper = address.toUpperCase();
    if (addrUpper.includes("BOUSKOURA")) return "BOUSKOURA";
    if (addrUpper.includes("DAR BOUAAZA")) return "DAR BOUAAZA";
    if (addrUpper.includes("MOHAMMEDIA")) return "MOHAMMEDIA";
    if (addrUpper.includes("BERRECHID")) return "BERRECHID";
    if (addrUpper.includes("TIT MELLIL")) return "TIT MELLIL";
    if (addrUpper.includes("NOUACEUR")) return "NOUACEUR";
    if (addrUpper.includes("SIDI RAHAL")) return "SIDI RAHAL";
    if (addrUpper.includes("FÈS") || addrUpper.includes("FES")) return "FÈS";
    return "CASABLANCA";
}

// --- ICS Calendar Export ---
export function exportToICS() {
    // 1. Filter Future Events
    const today = new Date().toISOString().split('T')[0];
    const futureEvents = store.events.filter(e => e.date >= today);

    if (futureEvents.length === 0) {
        if (window.showToast) showToast(getText('msg.no_future_events'), 'info');
        else alert(getText('msg.no_future_events'));
        return;
    }

    // 2. Build ICS Content
    let icsContent = "BEGIN:VCALENDAR\nversion:2.0\nPRODID:-//Speedyex//Filtre Manager//EN\n";

    futureEvents.forEach(event => {
        const client = store.clients.find(c => c.id === event.clientId);
        const clientName = client ? client.name : (event.clientName || "Client Inconnu");

        // Date formatting for ICS (YYYYMMDD)
        const dateStr = event.date.replace(/-/g, '');

        icsContent += "BEGIN:VEVENT\n";
        icsContent += `DTSTART;VALUE=DATE:${dateStr}\n`;
        // All day event, so no DTEND needed or DTEND=next day
        // Let's just set DTSTART. Some calendars prefer DTEND.
        // DTEND is next day
        const nextDay = new Date(event.date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0].replace(/-/g, '');
        icsContent += `DTEND;VALUE=DATE:${nextDayStr}\n`;

        icsContent += `SUMMARY:SpeedyEx: ${event.type} - ${clientName}\n`;
        icsContent += `DESCRIPTION:Type: ${event.type}\\nStatus: ${event.status}\\nNotes: ${event.notes || ''}\n`;
        icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    // 3. Download File
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speedyex_calendar_${today}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    if (window.showToast) showToast(getText('msg.sync_success'), 'success');
}
