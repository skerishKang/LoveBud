/**
 * LoveBud - Firebase Configuration & Initialization
 * 
 * Config sourced from 133-relovetree (shared-utils.js).
 * This is the SINGLE source of truth for Firebase config in LoveBud.
 * All pages that need Firebase must load this file AFTER the Firebase SDK scripts.
 */

var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDQNR8bNIp4LG4EGNwl1ew8B7Har-KJC90",
    authDomain: "relovetree.firebaseapp.com",
    projectId: "relovetree",
    storageBucket: "relovetree.firebasestorage.app",
    messagingSenderId: "1091063063536",
    appId: "1:1091063063536:web:065a746e2578c47dd7b335",
    measurementId: "G-D4R5XMGFK5"
};

var FIREBASE_INIT_FLAG = '__lovebudFirebaseInitialized';

/**
 * Initialize Firebase app (idempotent).
 * Call AFTER firebase-app.js and firebase-auth.js are loaded.
 * @returns {boolean} true if initialized successfully
 */
function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded.');
        return false;
    }

    if (firebase.apps && firebase.apps.length) {
        return true; // Already initialized
    }

    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        if (typeof window !== 'undefined') {
            window[FIREBASE_INIT_FLAG] = true;
        }
        return true;
    } catch (error) {
        if (error.code === 'app/duplicate-app') {
            return true;
        }
        console.error('Firebase initialization failed:', error);
        return false;
    }
}
