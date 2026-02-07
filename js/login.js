// Replace with your actual Google Client ID
const GOOGLE_CLIENT_ID = "788471062927-m9k1jhqtp4j1gr2be8fg4bga08mi4knd.apps.googleusercontent.com";

// Check if user is already authenticated
document.addEventListener('DOMContentLoaded', async function() {
    const authResult = await authManager.initPageAuth(false);
    
    if (authResult.authenticated) {
        // User is already authenticated, redirect to index (unified page)
        window.location.href = "./index.html";
        return;
    }

    // Initialize Google Sign-In
    initializeGoogleSignIn();
});

// Initialize Google Sign-In
function initializeGoogleSignIn() {
    if (typeof google === 'undefined') {
        // Wait for Google API to load
        setTimeout(() => {
            if (typeof google !== 'undefined') {
                initializeGoogleSignIn();
            } else {
                showError('Failed to load Google Sign-In. Please refresh the page.');
            }
        }, 1000);
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: false
    });

    // Render the Google Sign-In button
    google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        {
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            width: 300
        }
    );
}

// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
    showLoading(true);
    hideError();
    
    console.log('Google token received');
    
    try {
        const result = await authManager.loginWithGoogle(response.credential);
        
        if (result.success) {
            console.log('Login successful:', result.user);
            // Redirect to index page (unified page)
            window.location.href = "./index.html";
        } else {
            throw new Error(result.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed. Please try again.');
        showLoading(false);
    }
}

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.style.display = 'none';
}

function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    const signInBtn = document.getElementById('google-signin-btn');
    
    if (show) {
        loadingDiv.style.display = 'block';
        signInBtn.style.display = 'none';
    } else {
        loadingDiv.style.display = 'none';
        signInBtn.style.display = 'block';
    }
}