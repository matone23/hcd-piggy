// Piggy Habit - Global Utilities with Firebase Realtime Database
// Spec coverage: toast, Firebase auth, Realtime Database integration

const app = (() => {
    const STORAGE_KEY = 'piggy-habit-user';
    const ROOM_KEY = 'piggy-habit-room';
    let isFirebaseReady = false;
    let currentUser = null;
    let database = null;
    let auth = null;

    const showToast = (message) => {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    // Firebase initialization
    const initializeFirebase = async () => {
        try {
            // Wait for Firebase to be available from the global scope
            if (typeof window.firebaseAuth !== 'undefined' && typeof window.firebaseApp !== 'undefined') {
                auth = window.firebaseAuth;
                
                console.log('Firebase app initialized with config:', window.firebaseApp.options);
                
                // Import and initialize Realtime Database with explicit region check
                const { getDatabase, ref, set, get, push, onValue, off } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                
                // Ensure we're using the correct database URL
                const expectedDbUrl = "https://hcd-piggy-default-rtdb.europe-west1.firebasedatabase.app";
                console.log('Expected database URL:', expectedDbUrl);
                console.log('Firebase app database URL:', window.firebaseApp.options.databaseURL);
                
                if (window.firebaseApp.options.databaseURL !== expectedDbUrl) {
                    console.error('❌ Database URL mismatch!');
                    console.error('Expected:', expectedDbUrl);
                    console.error('Actual:', window.firebaseApp.options.databaseURL);
                    throw new Error('Database URL region mismatch');
                }
                
                database = getDatabase(window.firebaseApp);
                console.log('✅ Database initialized with URL:', window.firebaseApp.options.databaseURL);
                
                // Set up auth state listener
                const { onAuthStateChanged, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                
                onAuthStateChanged(auth, (user) => {
                    currentUser = user;
                    if (user) {
                        console.log('User signed in:', user.uid);
                    } else {
                        console.log('User signed out');
                    }
                });
                
                isFirebaseReady = true;
                console.log('Firebase Realtime Database initialized successfully');
                
            } else {
                console.warn('Firebase not available, using localStorage mode');
                isFirebaseReady = false;
            }
        } catch (error) {
            console.warn('Firebase initialization failed:', error);
            isFirebaseReady = false;
        }
    };

    // User management with Firebase integration
    const saveUser = async ({ userId, nickname, pin }) => {
        console.log('saveUser called with:', { userId, nickname, pin });
        
        // Always save to localStorage first for immediate access
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, nickname, pin }));
        console.log('User saved to localStorage');
        
        if (isFirebaseReady && database) {
            try {
                console.log('Attempting Firebase save...');
                
                // Sign in anonymously if not authenticated
                if (!currentUser) {
                    console.log('No current user, signing in anonymously...');
                    const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                    const result = await signInAnonymously(auth);
                    currentUser = result.user;
                    console.log('Signed in anonymously:', currentUser.uid);
                }
                
                // Save user to Realtime Database
                console.log('Importing database functions...');
                const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                
                console.log('Creating user reference...');
                const userRef = ref(database, `users/${currentUser.uid}`);
                
                const userData = {
                    uid: currentUser.uid,
                    nickname: nickname,
                    pin: pin,
                    createdAt: Date.now(),
                    lastSeen: Date.now()
                };
                
                console.log('Saving user data to Firebase:', userData);
                await set(userRef, userData);
                console.log('✅ User saved to Firebase successfully!');
                
                // Update localStorage with Firebase UID
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                    userId: currentUser.uid, 
                    nickname, 
                    pin 
                }));
                
                console.log('✅ saveUser completed successfully');
                return { userId: currentUser.uid, nickname };
            } catch (error) {
                console.error('❌ Error saving user to Firebase:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                showToast('Account created locally (offline mode)');
                // Don't throw - return the localStorage version
            }
        } else {
            console.log('Firebase not ready, using localStorage only');
        }
        
        console.log('Returning fallback user data');
        return { userId, nickname };
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

    const clearUser = async () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ROOM_KEY);
        
        // Sign out from Firebase if authenticated
        if (isFirebaseReady && currentUser) {
            try {
                const { signOut } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                await signOut(auth);
                console.log('Signed out from Firebase');
            } catch (error) {
                console.error('Error signing out:', error);
            }
        }
        
        currentUser = null;
    };

    const requireUser = () => {
        const user = getUser();
        if (!user) {
            window.location.href = 'index.html';
        }
        return user;
    };

    // Room management with Firebase integration
    const getActiveRoom = () => {
        const raw = localStorage.getItem(ROOM_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const saveActiveRoom = (roomData) => {
        localStorage.setItem(ROOM_KEY, JSON.stringify(roomData));
    };

    const clearActiveRoom = () => {
        localStorage.removeItem(ROOM_KEY);
    };

    const createRoom = async (roomData) => {
        const user = getUser();
        if (!user) throw new Error('No user logged in');

        // Generate unique 6-digit room code
        const roomCode = await generateUniqueRoomCode();
        console.log('Generated room code:', roomCode);

        if (isFirebaseReady && database && currentUser) {
            try {
                // Create room in Firebase with 6-digit code as key
                const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const roomRef = ref(database, `rooms/${roomCode}`);
                
                const room = {
                    id: roomCode,
                    code: roomCode,
                    ...roomData,
                    createdBy: currentUser.uid,
                    createdAt: Date.now(),
                    members: [currentUser.uid],
                    isActive: true
                };
                
                await set(roomRef, room);
                console.log('Room created in Firebase with code:', roomCode);
                
                saveActiveRoom(room);
                return room;
            } catch (error) {
                console.error('Error creating room in Firebase:', error);
                showToast('Room created locally (offline mode)');
            }
        }
        
        // Fallback to local creation
        const room = { 
            id: roomCode,
            code: roomCode, 
            ...roomData, 
            createdAt: Date.now(),
            members: [user.userId]
        };
        saveActiveRoom(room);
        return room;
    };

    const getRooms = async () => {
        if (isFirebaseReady && database) {
            try {
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const roomsRef = ref(database, 'rooms');
                
                const snapshot = await get(roomsRef);
                if (snapshot.exists()) {
                    const roomsData = snapshot.val();
                    // Filter for active rooms on the client side to avoid indexing requirement
                    return Object.keys(roomsData)
                        .map(roomId => ({
                            id: roomId,
                            code: roomId,
                            ...roomsData[roomId]
                        }))
                        .filter(room => room.isActive !== false); // Include rooms where isActive is true or undefined
                }
            } catch (error) {
                console.error('Error fetching rooms from Firebase:', error);
                throw error;
            }
        }
        return [];
    };

    const getRoom = async (roomId) => {
        if (!isFirebaseReady || !database) {
            throw new Error('Firebase not ready');
        }

        try {
            const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const roomRef = ref(database, `rooms/${roomId}`);
            const snapshot = await get(roomRef);
            
            if (snapshot.exists()) {
                return {
                    id: roomId,
                    code: roomId,
                    ...snapshot.val()
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching room from Firebase:', error);
            throw error;
        }
    };

    const joinRoom = async (roomCode) => {
        console.log('🔍 JOIN ROOM CALLED with code:', roomCode);
        const user = getUser();
        if (!user) throw new Error('No user logged in');

        // Validate room code format (6 digits)
        if (!/^\d{6}$/.test(roomCode)) {
            throw new Error('Room code must be 6 digits');
        }

        console.log('🔍 Attempting to join room:', roomCode);
        console.log('🔍 Firebase ready:', isFirebaseReady);
        console.log('🔍 Database available:', !!database);
        console.log('🔍 Current user:', !!currentUser);

        if (!isFirebaseReady || !database) {
            console.log('🔍 Firebase not ready, throwing error');
            throw new Error('Cannot join rooms - Firebase not ready');
        }

        try {
            // Ensure we have an authenticated user
            if (!currentUser) {
                console.log('🔍 No Firebase user, signing in anonymously...');
                const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                const result = await signInAnonymously(auth);
                currentUser = result.user;
                console.log('🔍 Signed in anonymously for room joining:', currentUser.uid);
            }
            
            const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const roomRef = ref(database, `rooms/${roomCode}`);
            console.log('🔍 Checking if room exists at path:', `rooms/${roomCode}`);
            
            const snapshot = await get(roomRef);
            console.log('🔍 Room snapshot exists:', snapshot.exists());
            console.log('🔍 Room snapshot data:', snapshot.val());
            
            if (!snapshot.exists()) {
                console.log('🔍 Room does not exist:', roomCode);
                throw new Error(`Room ${roomCode} does not exist`);
            }
            
            const roomData = snapshot.val();
            console.log('🔍 Room data found:', roomData);
            
            // Check if room is active
            if (roomData.isActive === false) {
                throw new Error(`Room ${roomCode} is no longer active`);
            }
            
            // ONLY read the room data, don't update anything
            // The room creator will manage the member list
            const room = { id: roomCode, code: roomCode, ...roomData };
            saveActiveRoom(room);
            console.log('🔍 Successfully validated and joined room:', roomCode);
            return room;
        } catch (error) {
            console.error('🔍 Error joining room:', error);
            // Re-throw our custom errors as-is
            if (error.message.includes('does not exist') || error.message.includes('not ready') || error.message.includes('no longer active')) {
                throw error;
            }
            throw new Error('Failed to join room: ' + error.message);
        }
    };

    // Real-time room updates
    const subscribeToRoom = (roomId, callback) => {
        if (isFirebaseReady && database) {
            import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js').then(({ ref, onValue, off }) => {
                const roomRef = ref(database, `rooms/${roomId}`);
                
                const unsubscribe = onValue(roomRef, (snapshot) => {
                    if (snapshot.exists()) {
                        const roomData = { id: roomId, ...snapshot.val() };
                        callback(roomData);
                    } else {
                        callback(null);
                    }
                });
                
                return unsubscribe;
            });
        }
        return () => {}; // Empty unsubscribe function for fallback
    };

    // Generate 6-digit room code
    const generateRoomCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    // Check if room code exists
    const checkRoomCodeExists = async (code) => {
        if (isFirebaseReady && database) {
            try {
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const roomRef = ref(database, `rooms/${code}`);
                const snapshot = await get(roomRef);
                return snapshot.exists();
            } catch (error) {
                console.warn('Error checking room code:', error);
                return false;
            }
        }
        return false;
    };

    // Generate unique 6-digit room code
    const generateUniqueRoomCode = async () => {
        let attempts = 0;
        let code;
        
        do {
            code = generateRoomCode();
            attempts++;
            
            // Safety check to prevent infinite loop
            if (attempts > 10) {
                console.warn('Too many attempts to generate unique code, using fallback');
                return generateRoomCode(); // Return any code as fallback
            }
        } while (await checkRoomCodeExists(code));
        
        return code;
    };

    const generateId = () => `user_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;

    return {
        showToast,
        generateId,
        generateRoomCode,
        generateUniqueRoomCode,
        saveUser,
        getUser,
        clearUser,
        requireUser,
        getActiveRoom,
        saveActiveRoom,
        clearActiveRoom,
        createRoom,
        getRooms,
        getRoom,
        joinRoom,
        subscribeToRoom,
        initializeFirebase,
        isFirebaseReady: () => isFirebaseReady,
        getCurrentUser: () => currentUser
    };
})();

export default app;