export const tailwindConfig = {
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                // Add custom font for logo
                logo: ['Pacifico', 'cursive'],
            },
            colors: {
                'gray-950': '#0A0A0A',
                'gray-900': '#121212',
                'gray-800': '#1E1E1E',
                'gray-700': '#2C2C2C',
                'gray-600': '#3A3A3A',
            },
            borderRadius: {
                'xl': '0.75rem',
                '2xl': '1.0rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                'hard': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.05)',
            }
        }
    }
};

// Initialize Tailwind
if (window.tailwind) {
    tailwind.config = tailwindConfig;
} else {
    console.warn("Tailwind CSS not loaded.");
}
