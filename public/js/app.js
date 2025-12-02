// Piggy Habit - Global Utilities (Phase 1)
// Spec coverage: toast (3s auto-hide), localStorage helpers, auth check

const app = (() => {
    const STORAGE_KEY = 'piggy-habit-user';

    const showToast = (message) => {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const saveUser = ({ userId, nickname }) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, nickname }));
    };

    const getUser = () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('Failed to parse user data', e);
            return null;
        }
    };

    const clearUser = () => localStorage.removeItem(STORAGE_KEY);

    const requireUser = () => {
        const user = getUser();
        if (!user) {
            window.location.href = 'index.html';
        }
        return user;
    };

    const getActiveRoom = () => {
        const raw = localStorage.getItem('piggy-habit-room');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const generateId = () => `user_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;

    return {
        showToast,
        saveUser,
        getUser,
        clearUser,
        requireUser,
        getActiveRoom,
        generateId,
    };
})();
