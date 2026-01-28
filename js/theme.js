export function initTheme() {
    // Default to 'dark' if no preference is saved (or if old preference key 'theme' exists, we ignore it to force reset if desired, or migrate. Let's just use a new key 'app_theme')
    const savedTheme = localStorage.getItem('app_theme');

    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
        if (savedTheme !== 'dark') {
            localStorage.setItem('app_theme', 'dark');
        }
    }
}

export function toggleDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('app_theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('app_theme', 'dark');
    }
}
