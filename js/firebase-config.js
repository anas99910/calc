import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9NyVrmam2_1ABkjeCu057trLBlUMN8L8",
    authDomain: "expenso-e317f.firebaseapp.com",
    projectId: "expenso-e317f",
    storageBucket: "expenso-e317f.firebasestorage.app",
    messagingSenderId: "699583670160",
    appId: "1:699583670160:web:9fe66f1c44675b0278f515",
    measurementId: "G-RKEV6XWG7W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable Offline Persistence
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Persistence failed: Multiple tabs open.');
        } else if (err.code == 'unimplemented') {
            console.warn('Persistence failed: Browser not supported.');
        } else {
            console.error("Persistence error:", err);
        }
    });
