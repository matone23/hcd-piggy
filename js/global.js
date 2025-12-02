/**
 * Global utilities for Piggy Bank Competition (localStorage, navigation, toasts, auth)
 */
const app = {
    db: {
        save: (key, value) => {
            localStorage.setItem(key, JSON.stringify(value));
        },
        load: (key) => {
            const stored = localStorage.getItem(key);
            try {
                return stored ? JSON.parse(stored) : null;
            } catch (e) {
                console.error('Failed to parse localStorage item:', key, e);
                return null;
            }
        },
        init: () => {
            if (!localStorage.getItem('rooms')) {
                localStorage.setItem('rooms', JSON.stringify([]));
            }
        }
    },

    goTo: (filename) => {
        window.location.href = filename;
    },

    checkAuth: () => {
        const user = app.db.load('user');
        const current = window.location.pathname.split('/').pop() || 'index.html';
        if (!user && current !== 'index.html') {
            window.location.href = 'index.html';
            return null;
        }
        return user;
    },

    toast: (msg) => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        container.textContent = msg;
        container.classList.remove('hidden');
        container.style.opacity = '1';

        setTimeout(() => {
            container.style.opacity = '0';
            setTimeout(() => container && container.remove(), 300);
        }, 2000);
    },

    getQueryParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }
};

// Legacy helper
const requireAuth = () => app.checkAuth();

app.db.init();
