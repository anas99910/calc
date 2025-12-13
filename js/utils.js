/**
 * Returns Tailwind color classes for an event type. (Adaptive)
 */
export function getEventTypeColors(type, status = 'Scheduled') {
    // If cancelled, always return grey
    if (status === 'Cancelled') {
        return { bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400 line-through' };
    }
    // If completed, return a slightly faded version
    if (status === 'Completed') {
        switch (type) {
            case 'Installation':
                return { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-200' };
            case 'Maintenance':
                return { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-200' };
            case 'Filter Change':
                return { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-200' };
            case 'General':
                return { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-200' };
            default:
                return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300' };
        }
    }

    // Default active colors
    switch (type) {
        case 'Installation':
            return { bg: 'bg-blue-500 dark:bg-blue-600', text: 'text-white' };
        case 'Maintenance':
            return { bg: 'bg-green-500 dark:bg-green-600', text: 'text-white' };
        case 'Filter Change':
            return { bg: 'bg-yellow-400 dark:bg-yellow-500', text: 'text-gray-900' }; // Keep text dark for yellow
        case 'General':
            return { bg: 'bg-purple-500 dark:bg-purple-600', text: 'text-white' };
        default:
            return { bg: 'bg-gray-500 dark:bg-gray-600', text: 'text-white' };
    }
}
