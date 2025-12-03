// Firebase utilities for Piggy Habit app
import { 
    signInAnonymously, 
    onAuthStateChanged, 
    signOut 
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const firebaseUtils = (() => {
    let currentUser = null;

    // Authentication
    const initAuth = () => {
        return new Promise((resolve) => {
            onAuthStateChanged(window.firebaseAuth, (user) => {
                currentUser = user;
                resolve(user);
            });
        });
    };

    const signInAnonymous = async () => {
        try {
            const result = await signInAnonymously(window.firebaseAuth);
            return result.user;
        } catch (error) {
            console.error('Error signing in anonymously:', error);
            throw error;
        }
    };

    const signOutUser = async () => {
        try {
            await signOut(window.firebaseAuth);
            currentUser = null;
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    // User management
    const createUser = async (userData) => {
        if (!currentUser) throw new Error('No authenticated user');
        
        try {
            const userDoc = {
                uid: currentUser.uid,
                nickname: userData.nickname,
                pin: userData.pin, // Note: In production, hash this!
                createdAt: new Date(),
                lastSeen: new Date()
            };
            
            await setDoc(doc(window.firebaseDb, 'users', currentUser.uid), userDoc);
            return userDoc;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    };

    const getUser = async (uid = null) => {
        const userId = uid || currentUser?.uid;
        if (!userId) return null;

        try {
            const userDoc = await getDoc(doc(window.firebaseDb, 'users', userId));
            return userDoc.exists() ? userDoc.data() : null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    };

    const updateUser = async (updates) => {
        if (!currentUser) throw new Error('No authenticated user');
        
        try {
            await updateDoc(doc(window.firebaseDb, 'users', currentUser.uid), {
                ...updates,
                lastSeen: new Date()
            });
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    };

    // Room management
    const createRoom = async (roomData) => {
        if (!currentUser) throw new Error('No authenticated user');
        
        try {
            const room = {
                ...roomData,
                createdBy: currentUser.uid,
                createdAt: new Date(),
                members: [currentUser.uid],
                isActive: true
            };
            
            const docRef = await addDoc(collection(window.firebaseDb, 'rooms'), room);
            return { id: docRef.id, ...room };
        } catch (error) {
            console.error('Error creating room:', error);
            throw error;
        }
    };

    const getRooms = async (isActive = true) => {
        try {
            const q = query(
                collection(window.firebaseDb, 'rooms'),
                where('isActive', '==', isActive),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting rooms:', error);
            return [];
        }
    };

    const joinRoom = async (roomId) => {
        if (!currentUser) throw new Error('No authenticated user');
        
        try {
            const roomRef = doc(window.firebaseDb, 'rooms', roomId);
            const roomDoc = await getDoc(roomRef);
            
            if (!roomDoc.exists()) {
                throw new Error('Room not found');
            }
            
            const roomData = roomDoc.data();
            if (!roomData.members.includes(currentUser.uid)) {
                await updateDoc(roomRef, {
                    members: [...roomData.members, currentUser.uid]
                });
            }
            
            return { id: roomId, ...roomData };
        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    };

    // Real-time subscriptions
    const subscribeToRoom = (roomId, callback) => {
        return onSnapshot(doc(window.firebaseDb, 'rooms', roomId), (doc) => {
            if (doc.exists()) {
                callback({ id: doc.id, ...doc.data() });
            } else {
                callback(null);
            }
        });
    };

    const subscribeToRooms = (callback) => {
        const q = query(
            collection(window.firebaseDb, 'rooms'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );
        
        return onSnapshot(q, (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(rooms);
        });
    };

    // Utility functions
    const getCurrentUser = () => currentUser;
    
    const isAuthenticated = () => !!currentUser;

    return {
        // Auth
        initAuth,
        signInAnonymous,
        signOutUser,
        getCurrentUser,
        isAuthenticated,
        
        // Users
        createUser,
        getUser,
        updateUser,
        
        // Rooms
        createRoom,
        getRooms,
        joinRoom,
        subscribeToRoom,
        subscribeToRooms
    };
})();

export default firebaseUtils;