export function initTheme() {
    // Default to 'dark' if no preference is saved
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
        // Ensure we save 'dark' as default so future visits are consistent
        if (!localStorage.getItem('theme')) {
            localStorage.setItem('theme', 'dark');
        }
    }
}

export function toggleDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}
