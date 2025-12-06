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

    // Expose Firebase readiness status
    const getFirebaseReadiness = () => {
        return {
            isReady: isFirebaseReady,
            hasDatabase: !!database,
            hasAuth: !!auth,
            hasUser: !!currentUser
        };
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
    const authenticateUser = async ({ nickname, pin }) => {
        console.log('🔐 authenticateUser called with:', { nickname, pin: '****' });
        
        if (isFirebaseReady && database) {
            try {
                console.log('🔍 Checking for existing user in Firebase...');
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                const usersRef = ref(database, 'users');
                const snapshot = await get(usersRef);
                
                if (snapshot.exists()) {
                    const existingUsers = snapshot.val();
                    console.log('📊 Found existing users in database:', Object.keys(existingUsers).length);
                    
                    // Look for user with matching nickname first
                    let userWithNickname = null;
                    let correctUid = null;
                    
                    for (const [uid, user] of Object.entries(existingUsers)) {
                        if (user && user.nickname && user.nickname.toLowerCase() === nickname.toLowerCase()) {
                            userWithNickname = user;
                            correctUid = uid;
                            break;
                        }
                    }
                    
                    if (userWithNickname) {
                        console.log('🔍 Found existing user with nickname:', nickname);
                        
                        // Check if PIN matches
                        if (userWithNickname.pin === pin) {
                            console.log('✅ PERFECT MATCH - nickname and PIN correct');
                            console.log('🔐 Existing user Firebase UID:', correctUid);
                            
                            // Set the current user to the existing Firebase UID (don't create new auth)
                            currentUser = { uid: correctUid };
                            
                            // Update localStorage with existing user (using correct Firebase UID)
                            localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                                userId: correctUid, // Use the existing Firebase UID
                                nickname: userWithNickname.nickname, 
                                pin: userWithNickname.pin 
                            }));
                            
                            console.log('✅ Set currentUser to existing Firebase UID:', correctUid);
                            
                            // Check for existing room membership and load room data
                            console.log('🔍 Checking for existing room membership for user:', correctUid);
                            try {
                                const { ref: roomsRef, get: getRooms } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                                
                                console.log('📡 Attempting to read rooms from Firebase...');
                                const allRoomsRef = roomsRef(database, 'rooms');
                                const roomsSnapshot = await getRooms(allRoomsRef);
                                
                                console.log('📊 Rooms snapshot exists:', roomsSnapshot.exists());
                                
                                if (roomsSnapshot.exists()) {
                                    const allRooms = roomsSnapshot.val();
                                    const roomCount = Object.keys(allRooms).length;
                                    console.log(`📋 Found ${roomCount} total rooms in database`);
                                    
                                    // Find room where this user is a participant
                                    let userRoom = null;
                                    let roomsChecked = 0;
                                    
                                    for (const [roomId, room] of Object.entries(allRooms)) {
                                        roomsChecked++;
                                        console.log(`🔍 Checking room ${roomsChecked}/${roomCount}: ${roomId}`, {
                                            hasRoom: !!room,
                                            hasParticipants: !!(room && room.participants),
                                            participantCount: room && room.participants ? Object.keys(room.participants).length : 0,
                                            participantIds: room && room.participants ? Object.keys(room.participants) : [],
                                            lookingForUserId: correctUid
                                        });
                                        
                                        if (room && room.participants && room.participants[correctUid]) {
                                            console.log('🏠 ✅ FOUND existing room for user:', roomId, room.name);
                                            userRoom = {
                                                id: roomId,
                                                name: room.name,
                                                mode: room.mode,
                                                participants: room.participants,
                                                createdAt: room.createdAt,
                                                code: roomId // Room ID is the code
                                            };
                                            break;
                                        }
                                    }
                                    
                                    if (userRoom) {
                                        console.log('✅ Loading existing room data into localStorage:', userRoom.name);
                                        localStorage.setItem(ROOM_KEY, JSON.stringify(userRoom));
                                        console.log('✅ Room data saved successfully');
                                    } else {
                                        console.log('📝 No existing room found for user after checking all rooms');
                                        // Clear any stale room data
                                        localStorage.removeItem(ROOM_KEY);
                                    }
                                } else {
                                    console.log('📝 No rooms exist in database');
                                    localStorage.removeItem(ROOM_KEY);
                                }
                                
                                console.log('✅ Room loading process completed successfully');
                                
                            } catch (roomError) {
                                console.error('❌ Error during room loading process:', roomError);
                                console.error('Error details:', {
                                    message: roomError.message,
                                    code: roomError.code,
                                    stack: roomError.stack
                                });
                                
                                // Don't throw the error, just log it and continue
                                console.warn('Continuing authentication without room data due to error');
                            }
                            
                            // Update last seen
                            try {
                                const { ref: updateRef, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
                                const userRef = updateRef(database, `users/${correctUid}`);
                                await update(userRef, { lastSeen: Date.now() });
                                console.log('📅 Updated last seen for existing user');
                            } catch (updateError) {
                                console.warn('Could not update last seen:', updateError);
                            }
                            
                            currentUser = { uid: correctUid };
                            return { userId: correctUid, nickname: userWithNickname.nickname, isExisting: true };
                        } else {
                            console.log('❌ WRONG PIN for existing nickname:', nickname);
                            throw new Error(`Username "${nickname}" already exists. Please enter the correct PIN or choose a different username.`);
                        }
                    }
                } else {
                    console.log('📂 No users found in Firebase database (empty)');
                }
                
                console.log('🆕 No existing user found with that nickname - can create new account');
                return null; // No existing user found, safe to create new one
                
            } catch (error) {
                // If it's our custom error about wrong PIN, re-throw it
                if (error.message.includes('already exists')) {
                    throw error;
                }
                console.error('❌ Error checking for existing users:', error);
                return null; // Continue to create new user on other errors
            }
        } else {
            console.warn('⚠️ Firebase not ready or database not available');
        }
        
        return null; // Firebase not ready, continue to create new user
    };

    const saveUser = async ({ userId, nickname, pin }) => {
        console.log('saveUser called with:', { userId, nickname, pin });
        console.log('Firebase ready status:', { isReady: isFirebaseReady, hasDatabase: !!database });
        
        // At this point, authenticateUser should have already verified no conflicts exist
        console.log('✅ Creating new user account (nickname conflict check passed)');
        
        // Firebase is REQUIRED - but handle network issues gracefully
        if (!isFirebaseReady || !database) {
            throw new Error('Firebase is required but not available. Please check your internet connection and try again.');
        }
        
        try {
            console.log('Attempting Firebase authentication and save...');
            
            // MANDATORY: Sign in anonymously if not authenticated
            if (!currentUser) {
                console.log('No current user, signing in anonymously...');
                try {
                    const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                    const result = await signInAnonymously(auth);
                    currentUser = result.user;
                    console.log('✅ Signed in anonymously with UID:', currentUser.uid);
                } catch (authError) {
                    console.error('❌ Anonymous authentication failed:', authError);
                    
                    // Handle network-specific errors with temporary fallback
                    if (authError.code === 'auth/network-request-failed') {
                        console.warn('🌐 Network error detected - creating temporary offline user');
                        
                        // Create a temporary user with offline flag
                        const tempUserId = `temp_${userId}_${Date.now()}`;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                            userId: tempUserId, 
                            nickname, 
                            pin,
                            isTemporary: true,
                            createdAt: Date.now()
                        }));
                        
                        console.log('⚠️ Created temporary offline user - will sync with Firebase when connection is restored');
                        return { userId: tempUserId, nickname, isTemporary: true };
                    } else {
                        throw authError; // Re-throw other auth errors
                    }
                }
            }
            
            // Save user to Realtime Database (PRIMARY operation)
            console.log('Importing database functions...');
            const { ref, set, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            
            console.log('Creating user reference for Firebase UID:', currentUser.uid);
            const userRef = ref(database, `users/${currentUser.uid}`);
            
            const userData = {
                uid: currentUser.uid,
                nickname: nickname,
                pin: pin,
                createdAt: Date.now(),
                lastSeen: Date.now()
            };
            
            console.log('Saving user data to Firebase (PRIMARY):', {
                uid: userData.uid,
                nickname: userData.nickname,
                hasPin: !!userData.pin,
                createdAt: new Date(userData.createdAt).toISOString()
            });
            
            await set(userRef, userData);
            console.log('✅ User saved to Firebase successfully!');
            
            // Verify the save worked
            const verifySnapshot = await get(userRef);
            if (!verifySnapshot.exists()) {
                throw new Error('Firebase save verification failed - user not found after save');
            }
            console.log('✅ Firebase save verified successfully');
            
            // ONLY update localStorage AFTER successful Firebase save
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                userId: currentUser.uid, 
                nickname, 
                pin 
            }));
            console.log('✅ localStorage updated after Firebase success');
            
            console.log('✅ saveUser completed successfully with Firebase UID as primary');
            return { userId: currentUser.uid, nickname };
            
        } catch (error) {
            console.error('❌ Error in Firebase user creation:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                name: error.name
            });
            
            // Handle network errors with temporary fallback
            if (error.code === 'auth/network-request-failed' || error.message?.includes('network')) {
                console.warn('🌐 Network error - creating temporary offline user');
                
                const tempUserId = `temp_${userId}_${Date.now()}`;
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                    userId: tempUserId, 
                    nickname, 
                    pin,
                    isTemporary: true,
                    createdAt: Date.now()
                }));
                
                showToast('Account created offline - will sync when connection is restored');
                return { userId: tempUserId, nickname, isTemporary: true };
            }
            
            // For other Firebase errors, don't create fallback
            throw new Error(`Failed to create user account: ${error.message}. Please check your internet connection and try again.`);
        }
    };

    const getUser = () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        console.log('🔍 getUser called, localStorage raw data:', raw);
        if (!raw) {
            console.log('❌ No user data found in localStorage');
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            console.log('✅ User data parsed successfully:', {
                userId: parsed.userId,
                nickname: parsed.nickname,
                hasPin: !!parsed.pin
            });
            return parsed;
        } catch (e) {
            console.error('❌ Failed to parse user data', e);
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

    const getCurrentUser = () => {
        return currentUser; // Firebase auth user
    };
    
    // Function to sync temporary users with Firebase when connection is restored
    const syncTemporaryUser = async () => {
        const user = getUser();
        if (!user || !user.isTemporary) return false;
        
        console.log('🔄 Attempting to sync temporary user with Firebase...');
        
        try {
            if (!isFirebaseReady || !database) {
                console.log('⚠️ Firebase not ready for sync, will retry later');
                return false;
            }
            
            // Try to authenticate with Firebase
            if (!currentUser) {
                const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                const result = await signInAnonymously(auth);
                currentUser = result.user;
                console.log('✅ Authenticated for sync with UID:', currentUser.uid);
            }
            
            // Save user to Firebase
            const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const userRef = ref(database, `users/${currentUser.uid}`);
            
            const userData = {
                uid: currentUser.uid,
                nickname: user.nickname,
                pin: user.pin,
                createdAt: user.createdAt || Date.now(),
                lastSeen: Date.now(),
                syncedAt: Date.now()
            };
            
            await set(userRef, userData);
            console.log('✅ Temporary user synced to Firebase successfully!');
            
            // Update localStorage to remove temporary flag
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                userId: currentUser.uid, 
                nickname: user.nickname, 
                pin: user.pin 
            }));
            
            showToast('Account synced with cloud!');
            return true;
        } catch (error) {
            console.warn('⚠️ Could not sync temporary user:', error.message);
            return false;
        }
    };
    
    const requireUser = () => {
        // Check localStorage for user data first
        const user = getUser();
        if (!user) {
            console.error('❌ No user data found in localStorage - redirecting to login');
            window.location.href = 'index.html';
            return null;
        }
        
        console.log('✅ User found in localStorage:', {
            userId: user.userId,
            nickname: user.nickname,
            isTemporary: !!user.isTemporary
        });
        
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

    const getUserRooms = async (userId) => {
        // Instead of reading all rooms (which may be permission denied), 
        // check the user's stored data for room membership
        console.log('🔍 Getting user rooms for:', userId);
        
        if (!isFirebaseReady || !database) {
            console.warn('Firebase not ready for getUserRooms');
            return [];
        }

        try {
            // Try to read from the user's own data first (more likely to have permission)
            const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const userRef = ref(database, `users/${userId}`);
            const userSnapshot = await get(userRef);
            
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                console.log('👤 User data from Firebase:', userData);
                
                // Check if user data contains room information
                if (userData.activeRoomId) {
                    console.log('🏠 Found activeRoomId in user data:', userData.activeRoomId);
                    
                    // Try to get the specific room data
                    const roomRef = ref(database, `rooms/${userData.activeRoomId}`);
                    const roomSnapshot = await get(roomRef);
                    
                    if (roomSnapshot.exists()) {
                        const room = roomSnapshot.val();
                        return [{
                            id: userData.activeRoomId,
                            name: room.name,
                            mode: room.mode,
                            participants: room.participants,
                            createdAt: room.createdAt,
                            code: userData.activeRoomId
                        }];
                    }
                }
            }
            
            // Fallback: Return empty array if no room found
            console.log('📝 No active room found in user data');
            return [];
            
        } catch (error) {
            console.error('Error getting user rooms:', error);
            // If we get permission denied, just return empty array
            if (error.message && error.message.includes('Permission denied')) {
                console.warn('Permission denied reading Firebase data - continuing without room check');
                return [];
            }
            return [];
        }
    };

    const saveActiveRoom = (roomData) => {
        localStorage.setItem(ROOM_KEY, JSON.stringify(roomData));
    };

    const clearActiveRoom = () => {
        localStorage.removeItem(ROOM_KEY);
    };

    const createRoom = async (roomData) => {
        console.log('🏭 createRoom called with:', roomData);
        const user = getUser();
        if (!user) {
            console.error('❌ No user logged in');
            throw new Error('No user logged in');
        }

        // Ensure Firebase is ready
        if (!isFirebaseReady || !database) {
            console.error('❌ Firebase not ready for room creation');
            throw new Error('Firebase not ready. Please refresh the page and try again.');
        }

        // Generate unique 6-digit room code
        console.log('🔢 Generating room code...');
        const roomCode = await generateUniqueRoomCode();
        console.log('✅ Generated room code:', roomCode);

        console.log('🔍 Firebase status:', {
            isReady: isFirebaseReady,
            hasDatabase: !!database,
            hasCurrentUser: !!currentUser
        });

        // Ensure we have an authenticated user - use existing UID if available
        if (!currentUser) {
            // Check if we have an existing user in localStorage with Firebase UID
            const existingUser = getUser();
            if (existingUser && existingUser.userId) {
                console.log('🔐 Using existing user UID for room creation:', existingUser.userId);
                currentUser = { uid: existingUser.userId };
            } else {
                console.log('🔐 No existing user, signing in anonymously...');
                const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                const result = await signInAnonymously(auth);
                currentUser = result.user;
                console.log('✅ Signed in anonymously:', currentUser.uid);
            }
        }
        
        console.log('🔥 Creating room in Firebase...');
        
        // Create room in Firebase with 6-digit code as key
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const roomRef = ref(database, `rooms/${roomCode}`);
        console.log('💾 Creating room at path:', `rooms/${roomCode}`);
        
        const room = {
            id: roomCode,
            code: roomCode,
            ...roomData,
            createdBy: currentUser.uid,
            createdAt: Date.now(),
            participants: {
                [currentUser.uid]: {
                    userId: currentUser.uid,
                    nickname: user.nickname,
                    score: 0,
                    rate: 0,
                    joinedAt: Date.now(),
                    isCreator: true
                }
            },
            isActive: true
        };
        
        console.log('💾 Room object to save:', room);
        
        try {
            await set(roomRef, room);
            console.log('✅ Room successfully created in Firebase with code:', roomCode);
            
            // Save to localStorage only after Firebase succeeds
            saveActiveRoom(room);
            return room;
        } catch (error) {
            console.error('❌ Firebase save failed:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            // Throw specific error based on Firebase error code
            if (error.code === 'PERMISSION_DENIED') {
                throw new Error('Permission denied. Check Firebase security rules.');
            } else if (error.code === 'NETWORK_ERROR') {
                throw new Error('Network error. Check your internet connection.');
            } else {
                throw new Error(`Firebase error: ${error.message}`);
            }
        }
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

    const updateRoom = async (roomId, updates) => {
        if (!isFirebaseReady || !database) {
            throw new Error('Firebase not ready');
        }

        try {
            const { ref, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const roomRef = ref(database, `rooms/${roomId}`);
            await update(roomRef, updates);
            console.log('Room updated in Firebase:', roomId, updates);
            return true;
        } catch (error) {
            console.error('Error updating room in Firebase:', error);
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
            // Ensure we have an authenticated user - use existing UID if available
            if (!currentUser) {
                // Check if we have an existing user in localStorage with Firebase UID
                const existingUser = getUser();
                if (existingUser && existingUser.userId) {
                    console.log('🔐 Using existing user UID for room join:', existingUser.userId);
                    currentUser = { uid: existingUser.userId };
                } else {
                    console.log('🔍 No existing user, signing in anonymously...');
                    const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
                    const result = await signInAnonymously(auth);
                    currentUser = result.user;
                    console.log('✅ Signed in anonymously for room join:', currentUser.uid);
                }
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
            
            // Add user to room participants if not already there
            const currentParticipants = roomData.participants || {};
            if (!currentParticipants[currentUser.uid]) {
                console.log('\ud83d\udd0d Adding user to room participants:', currentUser.uid);
                await update(roomRef, {
                    [`participants/${currentUser.uid}`]: {
                        userId: currentUser.uid,
                        nickname: user.nickname,
                        color: null, // Will be set during onboarding
                        score: 0,
                        rate: 0,
                        joinedAt: Date.now()
                    }
                });
                console.log('\ud83d\udd0d Successfully added user to room in Firebase');
            }
            
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

    // Check if a competition has ended
    const isCompetitionEnded = (roomData) => {
        if (!roomData) return false;
        
        // Check if manually ended
        if (roomData.manuallyEnded) {
            return true;
        }
        
        // Check by mode
        if (roomData.mode === 'routine') {
            // Competition ends when duration is exceeded
            const startDate = new Date(roomData.createdAt || Date.now());
            const today = new Date();
            const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const duration = roomData.duration || 30;
            return daysSinceStart > duration;
        } else if (roomData.mode === 'oneday') {
            // Competition ends when deadline passes
            const deadline = roomData.dday;
            if (deadline) {
                const deadlineDate = new Date(deadline);
                const today = new Date();
                deadlineDate.setHours(23, 59, 59, 999);
                return today > deadlineDate;
            }
            return false;
        }
        
        return false;
    };

    return {
        showToast,
        generateId,
        generateRoomCode,
        generateUniqueRoomCode,
        authenticateUser,
        saveUser,
        syncTemporaryUser,
        getUser,
        clearUser,
        requireUser,
        getActiveRoom,
        getUserRooms,
        saveActiveRoom,
        clearActiveRoom,
        createRoom,
        updateRoom,
        getRooms,
        getRoom,
        joinRoom,
        subscribeToRoom,
        isCompetitionEnded,
        initializeFirebase,
        isFirebaseReady: () => ({
            isReady: isFirebaseReady,
            hasDatabase: !!database,
            hasAuth: !!auth,
            hasUser: !!currentUser
        }),
        getCurrentUser: () => currentUser
    };
})();

export default app;