// Centralized Authentication Management System
// Similar to how big websites handle JWT tokens

class AuthManager {
    constructor() {
        this.token = null;
        this.user = null;
        this.tokenExpiry = null;
        this.refreshTimer = null;
        this.apiBaseUrl = 'http://127.0.0.1:8000/api';
        
        // Initialize from storage
        this.loadFromStorage();
    }

    // Load token and user data from localStorage
    loadFromStorage() {
        try {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            const storedExpiry = localStorage.getItem('tokenExpiry');

            if (storedToken && storedUser && storedExpiry) {
                this.token = storedToken;
                this.user = JSON.parse(storedUser);
                this.tokenExpiry = new Date(storedExpiry);

                // Check if token is still valid
                if (this.isTokenValid()) {
                    this.scheduleTokenRefresh();
                } else {
                    this.clearAuth();
                }
            }
        } catch (error) {
            console.error('Error loading auth from storage:', error);
            this.clearAuth();
        }
    }

    // Save token and user data to localStorage
    saveToStorage() {
        try {
            if (this.token && this.user) {
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                localStorage.setItem('tokenExpiry', this.tokenExpiry.toISOString());
            }
        } catch (error) {
            console.error('Error saving auth to storage:', error);
        }
    }

    // Set authentication data
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        
        // JWT tokens typically expire in 12 hours (720 minutes as per your backend)
        // Set expiry to 11 hours to refresh before actual expiry
        this.tokenExpiry = new Date(Date.now() + (11 * 60 * 60 * 1000));
        
        this.saveToStorage();
        this.scheduleTokenRefresh();
    }

    // Clear authentication data
    clearAuth() {
        this.token = null;
        this.user = null;
        this.tokenExpiry = null;
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tokenExpiry');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // Check if token is valid (not expired)
    isTokenValid() {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }
        
        // Add 5 minute buffer
        const bufferTime = 5 * 60 * 1000;
        return new Date() < new Date(this.tokenExpiry.getTime() - bufferTime);
    }

    // Check if user is authenticated (Django-like is_authenticated)
    isAuthenticated() {
        return this.token && this.user && this.isTokenValid();
    }

    // Get current user (Django-like request.user)
    getCurrentUser() {
        return this.isAuthenticated() ? this.user : null;
    }

    // Check if user is anonymous (Django-like user.is_anonymous)
    isAnonymous() {
        return !this.isAuthenticated();
    }

    // Render UI based on authentication state
    renderAuthState() {
        if (this.isAuthenticated()) {
            this.renderAuthenticatedUI();
        } else {
            this.renderAnonymousUI();
        }
    }

    // Render UI for authenticated users
    renderAuthenticatedUI() {
        this.updateNavigation(true);
        this.updateHeroSection(true);
        this.updatePlaceActions(true);
    }

    // Render UI for anonymous users
    renderAnonymousUI() {
        this.updateNavigation(false);
        this.updateHeroSection(false);
        this.updatePlaceActions(false);
    }

    // Update navigation based on auth state
    updateNavigation(isAuthenticated) {
        const userProfile = document.getElementById('userProfile');
        if (!userProfile) return;

        if (isAuthenticated && this.user) {
            userProfile.href = 'settings.html';
            if (this.user.profile_url) {
                userProfile.innerHTML = `<img src="${this.user.profile_url}" alt="Profile">`;
            } else {
                userProfile.textContent = this.user.first_name ? this.user.first_name.charAt(0).toUpperCase() : '👤';
            }
            userProfile.className = 'user-profile';
        } else {
            userProfile.href = 'login.html';
            userProfile.textContent = 'Sign In';
            userProfile.className = 'btn-secondary';
            userProfile.style.padding = '8px 16px';
            userProfile.style.fontSize = '14px';
        }
    }

    // Update hero section based on auth state
    updateHeroSection(isAuthenticated) {
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        const ctaButton = document.getElementById('ctaButton');

        if (!heroTitle || !heroSubtitle || !ctaButton) return;

        if (isAuthenticated && this.user) {
            heroTitle.textContent = `Welcome back, ${this.user.first_name || 'User'}!`;
            heroSubtitle.textContent = 'Discover and share amazing places with the community';
            ctaButton.textContent = 'Explore Places';
            ctaButton.href = '#places';
            ctaButton.onclick = (e) => {
                e.preventDefault();
                document.getElementById('places').scrollIntoView({ behavior: 'smooth' });
            };
        } else {
            heroTitle.textContent = 'Discover Amazing Places';
            heroSubtitle.textContent = 'Share your favorite places and discover new ones recommended by the community';
            ctaButton.textContent = 'Sign In to Share';
            ctaButton.href = 'login.html';
            ctaButton.onclick = null;
        }
    }

    // Update place actions based on auth state
    updatePlaceActions(isAuthenticated) {
        // This will be called after places are rendered
        // to update the action buttons based on auth state
    }

    // Get authorization header
    getAuthHeader() {
        if (this.isAuthenticated()) {
            return { 'Authorization': `Bearer ${this.token}` };
        }
        return {};
    }

    // Make authenticated API request
    async apiRequest(endpoint, options = {}) {
        // Ensure we have a valid token
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint}`;
        
        const requestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeader(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, requestOptions);
            
            // Handle authentication errors
            if (response.status === 401) {
                console.log('Token expired or invalid, clearing auth');
                this.clearAuth();
                throw new Error('Authentication failed');
            }
            
            return response;
        } catch (error) {
            // Network errors or other issues
            if (error.message === 'Authentication failed') {
                throw error;
            }
            
            console.error('API request failed:', error);
            throw new Error('Network error');
        }
    }

    // Verify token with server and refresh user data
    async verifyAndRefreshUser() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/me`, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (response.ok) {
                const userData = await response.json();
                this.user = userData;
                this.saveToStorage();
                return true;
            } else {
                console.log('Token verification failed');
                this.clearAuth();
                return false;
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.clearAuth();
            return false;
        }
    }

    // Schedule token refresh (like big websites do)
    scheduleTokenRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        if (!this.tokenExpiry) {
            return;
        }

        // Refresh 30 minutes before expiry
        const refreshTime = this.tokenExpiry.getTime() - Date.now() - (30 * 60 * 1000);
        
        if (refreshTime > 0) {
            this.refreshTimer = setTimeout(() => {
                this.verifyAndRefreshUser();
            }, refreshTime);
        }
    }

    // Login with Google token
    async loginWithGoogle(googleToken) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: googleToken
                })
            });

            if (!response.ok) {
                throw new Error('Google authentication failed');
            }

            const data = await response.json();
            
            // Get user data
            const userResponse = await fetch(`${this.apiBaseUrl}/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${data.access_token}`
                }
            });

            if (!userResponse.ok) {
                throw new Error('Failed to get user data');
            }

            const userData = await userResponse.json();
            
            // Set authentication
            this.setAuth(data.access_token, userData);
            
            return { success: true, user: userData };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    // Logout
    logout() {
        this.clearAuth();
        // Redirect to index page
        window.location.href = './index.html';
    }

    // Initialize authentication check for pages
    async initPageAuth(requireAuth = false) {
        // If we have stored auth data, verify it
        if (this.token && this.user) {
            const isValid = await this.verifyAndRefreshUser();
            
            if (isValid) {
                return { authenticated: true, user: this.user };
            }
        }

        // Not authenticated
        if (requireAuth) {
            // Redirect to index for pages that require auth
            window.location.href = './index.html';
            return { authenticated: false };
        }

        return { authenticated: false };
    }
}

// Create global auth manager instance
window.authManager = new AuthManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}