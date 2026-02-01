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
        // 1. Prepare Data (Custom "Rapport" Structure)
        const exportData = store.events.map(e => {
            const client = store.clients.find(c => c.id === e.clientId);
            let ville = "CASABLANCA"; // Default
            let address = "";
            let clientName = e.clientName || (client ? client.name : "Inconnu");
            let formattedDate = "";

            // Format Date (YYYY-MM-DD -> DD/MM/YYYY)
            if (e.date) {
                const parts = e.date.split('-');
                if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            // Address & City Logic
            if (client && client.address) {
                address = client.address.replace(/\n/g, ", ");
                const addrUpper = address.toUpperCase();

                // Simple City Heurisitc
                if (addrUpper.includes("BOUSKOURA")) ville = "BOUSKOURA";
                else if (addrUpper.includes("DAR BOUAAZA")) ville = "DAR BOUAAZA";
                else if (addrUpper.includes("MOHAMMEDIA")) ville = "MOHAMMEDIA";
                else if (addrUpper.includes("BERRECHID")) ville = "BERRECHID";
                else if (addrUpper.includes("TIT MELLIL")) ville = "TIT MELLIL";
                else if (addrUpper.includes("NOUACEUR")) ville = "NOUACEUR";
                else if (addrUpper.includes("SIDI RAHAL")) ville = "SIDI RAHAL";
                // Add more as needed or rely on address splitting
            }

            return {
                "NOM DE CLIENT": clientName.toUpperCase(),
                "ADRESSE": address.toUpperCase(),
                "DATE DE CHANGEMENT": formattedDate,
                "PRIX": e.cost ? `${e.cost} MAD` : "",
                "VILLE": ville,
                "TYPE DE FILTRE": (e.filterUsed || e.type || "").toUpperCase()
            };
        });

        // 2. Create Workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Column Widths
        ws['!cols'] = [
            { wch: 30 }, // Name
            { wch: 40 }, // Address
            { wch: 20 }, // Date
            { wch: 15 }, // Prix
            { wch: 20 }, // Ville
            { wch: 25 }  // Type
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Rapport Speedyex");

        // 3. Generate File Name
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Rapport_Speedyex_${dateStr}.xlsx`;

        // 4. Download
        XLSX.writeFile(wb, fileName);

        if (window.showToast) {
            showToast(getText('msg.export_success'), "success");
        } else {
            alert(getText('msg.export_success'));
        }

        closeModal(document.getElementById('settings-modal'));

    } catch (error) {
        console.error("Export failed:", error);
        if (window.showToast) {
            showToast("Erreur lors de l'export: " + error.message, "error");
        } else {
            alert("Export failed: " + error.message);
        }
    }
}
