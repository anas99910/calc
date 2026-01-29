/**
 * Simple Toast Notification System
 */

// Ensure the container exists
function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, type = 'success') {
    const container = getToastContainer();

    // Create toast element
    const toast = document.createElement('div');

    // Base styles
    const baseClasses = "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border transform transition-all duration-300 translate-x-full opacity-0";

    // Type specific styles
    let typeClasses = "";
    let icon = "";

    if (type === 'success') {
        typeClasses = "bg-white dark:bg-gray-800 border-green-500 text-green-700 dark:text-green-400";
        icon = `<div class="p-1 rounded-full bg-green-100 dark:bg-green-900/30"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
    } else if (type === 'error') {
        typeClasses = "bg-white dark:bg-gray-800 border-red-500 text-red-700 dark:text-red-400";
        icon = `<div class="p-1 rounded-full bg-red-100 dark:bg-red-900/30"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>`;
    } else {
        typeClasses = "bg-white dark:bg-gray-800 border-gray-500 text-gray-700 dark:text-gray-400";
        icon = `<div class="p-1 rounded-full bg-gray-100 dark:bg-gray-800"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></div>`;
    }

    toast.className = `${baseClasses} ${typeClasses}`;
    toast.innerHTML = `
        ${icon}
        <p class="text-sm font-medium pr-2">${message}</p>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // Auto dismiss
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300); // Wait for transition
    }, 3000);
}

// Make it global for easy access just in case
window.showToast = showToast;
