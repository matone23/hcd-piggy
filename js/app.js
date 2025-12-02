/**
 * Global Logic for Piggy Bank App
 * Handles: LocalStorage, Navigation, Toast Notifications
 */

const app = {
    // --- 1. Database Wrapper (LocalStorage) ---
    db: {
        /**
         * Save data to localStorage
         * @param {string} key 
         * @param {any} value - Automatically stringified
         */
        save: (key, value) => {
            localStorage.setItem(key, JSON.stringify(value));
        },

        /**
         * Load data from localStorage
         * @param {string} key 
         * @returns {any} Parsed data or null
         */
        load: (key) => {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        },

        /**
         * Initialize DB with default empty arrays if not present
         */
        init: () => {
            if (!localStorage.getItem('rooms')) {
                localStorage.setItem('rooms', JSON.stringify([]));
            }
        }
    },

    // --- 2. Navigation Helper ---
    
    /**
     * Navigate to another HTML page
     * @param {string} filename - e.g., 'dashboard.html'
     */
    goTo: (filename) => {
        window.location.href = filename;
    },

    /**
     * Check if user is logged in. 
     * If not, redirect to index.html (unless already there).
     * @returns {string|null} The username
     */
    checkAuth: () => {
        const user = app.db.load('user');
        const currentPage = window.location.pathname.split('/').pop();

        // If no user and not on login page, redirect to login
        if (!user && currentPage !== 'index.html' && currentPage !== '') {
            window.location.href = 'index.html';
        }
        return user;
    },

    // --- 3. UI Helper (Toast) ---

    /**
     * Show a floating toast message
     * @param {string} msg - Message to display
     */
    toast: (msg) => {
        // Create container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        // Show message
        container.textContent = msg;
        container.classList.remove('hidden');
        container.style.opacity = '1';

        // Hide after 2 seconds
        setTimeout(() => {
            container.style.opacity = '0';
            setTimeout(() => {
                if(container) container.remove(); // Clean up DOM
            }, 300);
        }, 2000);
    },

    // --- 4. Utility ---
    
    /**
     * Get URL Parameters (e.g., ?id=123)
     */
    getQueryParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }
};

// Initialize DB on script load
app.db.init();