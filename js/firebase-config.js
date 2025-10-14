// firebase-config.js
console.log('🔥 Initializing Firebase...');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAXvjL_U0g_U5hF8XcIWLpkwyh1PWMx03o",
    authDomain: "virtual-queue-manager.firebaseapp.com",
    projectId: "virtual-queue-manager",
    storageBucket: "virtual-queue-manager.firebasestorage.app",
    messagingSenderId: "50053786489",
    appId: "1:50053786489:web:3dff3072decd2f174fdda8"
};

// Initialize Firebase
try {
    if (!firebase.apps.length) {
        const app = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized successfully');
    } else {
        console.log('✅ Firebase already initialized');
    }
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

// Initialize Firebase Authentication and get a reference to the service
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in other files
window.auth = auth;
window.db = db;