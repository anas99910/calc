/**
 * Speedex Authentication Module
 */

const USERNAME_ALLOWED = "Speedex";
const PASSWORD_ALLOWED = "speedexfilter00@";

const LOGIN_KEY = "speedex_logged_in";

/**
 * Checks if the user is currently authenticated.
 * @returns {boolean}
 */
export function checkLoginState() {
    return localStorage.getItem(LOGIN_KEY) === 'true' || 
           sessionStorage.getItem(LOGIN_KEY) === 'true';
}

/**
 * Initializes the login interface and attaches event listeners.
 * @param {Function} onSuccessCallback Callback triggered when user logs in successfully.
 */
export function initAuth(onSuccessCallback) {
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const rememberMeCheckbox = document.getElementById('login-remember-me');
    const errorMsg = document.getElementById('login-error-msg');
    const errorText = document.getElementById('login-error-text');
    const btnTogglePassword = document.getElementById('btn-toggle-password-visibility');
    const passwordEyeIcon = document.getElementById('password-eye-icon');

    if (!loginOverlay) {
        console.error("Login overlay element not found.");
        return;
    }

    // Toggle Password Visibility
    if (btnTogglePassword && passwordInput) {
        btnTogglePassword.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            
            if (passwordEyeIcon && window.lucide) {
                passwordEyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                lucide.createIcons();
            }
        });
    }

    // Handle Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (username === USERNAME_ALLOWED && password === PASSWORD_ALLOWED) {
                // Hide error message
                errorMsg.classList.add('hidden');

                // Determine persistence type
                if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                    localStorage.setItem(LOGIN_KEY, 'true');
                } else {
                    sessionStorage.setItem(LOGIN_KEY, 'true');
                }

                // Hide login screen
                loginOverlay.classList.add('hidden');
                
                // Show loading spinner for database initialization
                const loader = document.getElementById('loading-overlay');
                if (loader) {
                    loader.style.display = 'flex';
                }

                // Trigger main app loading
                if (onSuccessCallback) {
                    onSuccessCallback();
                }
            } else {
                // Show error feedback
                if (errorMsg && errorText) {
                    if (username !== USERNAME_ALLOWED && password !== PASSWORD_ALLOWED) {
                        errorText.textContent = "Identifiant et mot de passe incorrects.";
                    } else if (username !== USERNAME_ALLOWED) {
                        errorText.textContent = "Identifiant incorrect.";
                    } else {
                        errorText.textContent = "Mot de passe incorrect.";
                    }
                    errorMsg.classList.remove('hidden');
                    
                    // Shake effect on card for extra wow-factor feedback
                    const card = loginForm.parentElement;
                    card.classList.add('animate-shake');
                    setTimeout(() => card.classList.remove('animate-shake'), 500);
                }
            }
        });
    }
}

/**
 * Log the user out of the application.
 */
export function logout() {
    localStorage.removeItem(LOGIN_KEY);
    sessionStorage.removeItem(LOGIN_KEY);
    window.location.reload();
}
