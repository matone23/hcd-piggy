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

    const createRoom = async (roomData) => {
        const user = getUser();
        if (!user) throw new Error('No user logged in');

        if (isFirebaseReady && database && currentUser) {
            try {
                // Create room in Firebase
                const { ref, push, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const roomsRef = ref(database, 'rooms');
                const newRoomRef = push(roomsRef);
                
                const room = {
                    id: newRoomRef.key,
                    ...roomData,
                    createdBy: currentUser.uid,
                    createdAt: Date.now(),
                    members: [currentUser.uid],
                    isActive: true
                };
                
                await set(newRoomRef, room);
                console.log('Room created in Firebase:', room);
                
                saveActiveRoom(room);
                return room;
            } catch (error) {
                console.error('Error creating room in Firebase:', error);
                showToast('Room created locally (offline mode)');
            }
        }
        
        // Fallback to local creation
        const room = { 
            id: generateId(), 
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
                const { ref, get, query, orderByChild, equalTo } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const roomsRef = ref(database, 'rooms');
                const activeRoomsQuery = query(roomsRef, orderByChild('isActive'), equalTo(true));
                
                const snapshot = await get(activeRoomsQuery);
                if (snapshot.exists()) {
                    const rooms = [];
                    snapshot.forEach((childSnapshot) => {
                        rooms.push({
                            id: childSnapshot.key,
                            ...childSnapshot.val()
                        });
                    });
                    return rooms;
                }
            } catch (error) {
                console.error('Error fetching rooms from Firebase:', error);
            }
        }
        return [];
    };

    const joinRoom = async (roomId) => {
        const user = getUser();
        if (!user) throw new Error('No user logged in');

        if (isFirebaseReady && database && currentUser) {
            try {
                const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const roomRef = ref(database, `rooms/${roomId}`);
                const snapshot = await get(roomRef);
                
                if (snapshot.exists()) {
                    const roomData = snapshot.val();
                    const members = roomData.members || [];
                    
                    if (!members.includes(currentUser.uid)) {
                        members.push(currentUser.uid);
                        await update(roomRef, { members });
                    }
                    
                    const room = { id: roomId, ...roomData, members };
                    saveActiveRoom(room);
                    return room;
                }
            } catch (error) {
                console.error('Error joining room in Firebase:', error);
                showToast('Failed to join room');
            }
        }
        
        // Fallback
        const room = { 
            id: roomId, 
            name: 'Joined Room',
            createdAt: Date.now(),
            members: [user.userId]
        };
        saveActiveRoom(room);
        return room;
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

    const generateId = () => `user_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;

    return {
        showToast,
        generateId,
        saveUser,
        getUser,
        clearUser,
        requireUser,
        getActiveRoom,
        saveActiveRoom,
        createRoom,
        getRooms,
        joinRoom,
        subscribeToRoom,
        initializeFirebase,
        isFirebaseReady: () => isFirebaseReady,
        getCurrentUser: () => currentUser
    };
})();

export default app;