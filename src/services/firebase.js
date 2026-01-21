import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Sign in with Google popup
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Get the ID token
        const idToken = await user.getIdToken();

        return {
            success: true,
            token: idToken,
            displayName: user.displayName || user.email,
            email: user.email,
            photoURL: user.photoURL
        };
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        return {
            success: false,
            error: error.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
        };
    }
};

// Sign out
export const signOutFirebase = async () => {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Sign Out Error:', error);
        return { success: false, error: error.message };
    }
};

export { auth, googleProvider };
