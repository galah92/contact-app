import "https://www.gstatic.com/firebasejs/10.1.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth-compat.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
};
const app = firebase.initializeApp(firebaseConfig);
const auth = app.auth();

// As httpOnly cookies are to be used, do not persist any state client side.
// explained here: https://firebase.google.com/docs/auth/admin/manage-cookies#sign_in
auth.setPersistence(firebase.auth.Auth.Persistence.NONE);

const ui = new firebaseui.auth.AuthUI(firebase.auth());

const uiConfig = {
  callbacks: {
    signInSuccessWithAuthResult: async (authResult, redirectUrl) => {
      // User successfully signed in.
      // Return type determines whether we continue the redirect automatically
      // or whether we leave that to developer to handle.
      // return true;

      const user = authResult.user;
      const idToken = await user.getIdToken();
      function getCookie(name) {
        const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
        return v ? v[2] : null;
      }
      const csrfToken = getCookie('csrfToken');
      const params = new URLSearchParams({ idToken, csrfToken });
      const res = await fetch('/sessionLogin?' + params, {
        method: 'POST',
        redirect: 'follow',
      });
      if (res.redirected) {
        window.location.assign(res.url);
      }
      return false;
    },
    uiShown: function () {
      // The widget is rendered.
      // Hide the loader.
      document.getElementById('loader').style.display = 'none';
    }
  },
  signInFlow: 'popup',
  signInOptions: [
    // Leave the lines as is for the providers you want to offer your users.
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ]
};

ui.start('#firebaseui-auth-container', uiConfig);
