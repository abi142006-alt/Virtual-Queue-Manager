// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXvjL_U0g_U5hF8XcIWLpkwyh1PWMx03o",
  authDomain: "virtual-queue-manager.firebaseapp.com",
  projectId: "virtual-queue-manager",
  storageBucket: "virtual-queue-manager.firebasestorage.app",
  messagingSenderId: "50053786489",
  appId: "1:50053786489:web:3dff3072decd2f174fdda8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize Firebase Messaging only if it's available (optional feature)
let messaging = null;
try {
  if (firebase.messaging && firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (error) {
  console.log('Firebase Messaging not available:', error);
}

// Export for use in other files
window.auth = auth;
window.db = db;
window.messaging = messaging;

// Auth state listener for global use
auth.onAuthStateChanged((user) => {
  // Global auth state handling can be added here if needed
  if (user) {
    console.log('User logged in:', user.email);
  } else {
    console.log('User logged out');
  }
});
