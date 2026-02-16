const fallbackFirebaseConfig = {
  apiKey: "AIzaSyBdN6WOgHXZnE5KFDDpwcAEQIADzUxSVuE",
  authDomain: "quiz-app-dd06b.firebaseapp.com",
  projectId: "quiz-app-dd06b",
  storageBucket: "quiz-app-dd06b.firebasestorage.app",
  messagingSenderId: "527345379941",
  appId: "1:527345379941:web:a0ed5fa9cf937f2d28f48c",
  measurementId: "G-1BDBZ0HEVG",
};

const loadFirebaseConfig = async () => {
  try {
    const response = await fetch("/api/config/firebase", { cache: "no-store" });
    let config = {};
    try {
      config = await response.json();
    } catch (err) {
      config = {};
    }
    if (response.ok && config && config.apiKey && config.authDomain && config.projectId && config.appId) {
      return config;
    }
  } catch (err) {
    // fallback below
  }
  return fallbackFirebaseConfig;
};

window.firebaseReadyPromise = (async () => {
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK not loaded. Check script includes in index.html.");
    window.firebaseAuth = null;
    return null;
  }

  try {
    const config = await loadFirebaseConfig();

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    window.firebaseAuth = firebase.auth();
    return window.firebaseAuth;
  } catch (err) {
    console.error("Firebase initialization error:", err);
    window.firebaseAuth = null;
    return null;
  }
})();
