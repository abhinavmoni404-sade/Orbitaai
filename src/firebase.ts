import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCwmayx38d4OJyMJ1FfKBuCR6KndKOFyvw',
  authDomain: 'orbita-609d7.firebaseapp.com',
  projectId: 'orbita-609d7',
  storageBucket: 'orbita-609d7.firebasestorage.app',
  messagingSenderId: '513025702639',
  appId: '1:513025702639:web:10a89547812b144305b91a',
  measurementId: 'G-KH2YCPX3QG',
};

// Initialize Firebase Authentication (and Analytics when supported in browser)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {});
}
