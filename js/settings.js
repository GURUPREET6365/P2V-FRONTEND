// Settings page JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    const authResult = await authManager.initPageAuth(true);
    
    if (!authResult.authenticated) {
        // Will be redirected by initPageAuth
        return;
    }

    // User is authenticated, load settings
    await loadUserSettings(authResult.user);
});

// Load user settings and display
async function loadUserSettings(user) {
    const loadingState = document.getElementById('loadingState');
    const unauthenticatedState = document.getElementById('unauthenticatedState');
    const authenticatedState = document.getElementById('authenticatedState');
    
    try {
        // Hide loading, show authenticated state
        loadingState.style.display = 'none';
        authenticatedState.style.display = 'block';
        
        // Render user profile
        renderUserProfile(user);
        
        // Update navigation profile
        updateNavProfile(user);
        
        // Load user statistics
        await loadUserStats(user.id);
        
    } catch (error) {
        console.error('Error loading settings:', error);
        loadingState.style.display = 'none';
        unauthenticatedState.style.display = 'block';
    }
}

// Render user profile section
function renderUserProfile(user) {
    const authenticatedState = document.getElementById('authenticatedState');
    
    authenticatedState.innerHTML = `
        <div class="user-profile-section">
            ${user.profile_url ? 
                `<img src="${user.profile_url}" alt="Profile" class="profile-image">` : 
                `<div class="profile-image" style="display: flex; align-items: center; justify-content: center; background-color: #262626; font-size: 32px;">
                    ${user.first_name ? user.first_name.charAt(0).toUpperCase() : '👤'}
                </div>`
            }
            <h2 class="user-name">${user.first_name || ''} ${user.last_name || ''}</h2>
            <p class="user-email">${user.email}</p>
            <span class="user-role">${user.role}</span>
        </div>

        <div class="settings-actions">
            <a href="index.html" class="action-button primary">Go to Home</a>
            <a href="index.html" class="action-button secondary">Explore Places</a>
            <button onclick="logout()" class="action-button danger">Sign Out</button>
        </div>
    `;
    
    // Set joined date
    const joinedDate = new Date(user.created_at);
    document.getElementById('joinedDate').textContent = joinedDate.getFullYear();
}

// Update navigation profile
function updateNavProfile(user) {
    const userProfile = document.getElementById('userProfile');
    if (user.profile_url) {
        userProfile.innerHTML = `<img src="${user.profile_url}" alt="Profile">`;
    } else {
        userProfile.textContent = user.first_name ? user.first_name.charAt(0).toUpperCase() : '👤';
    }
}

// Load user statistics using auth manager
async function loadUserStats(userId) {
    try {
        // Try to get user-specific data
        const response = await authManager.apiRequest(`/get/user/${userId}`);

        if (response.ok) {
            const userData = await response.json();
            console.log('User data:', userData);
        }
        
        // Get places count from all places endpoint and filter by user_id
        const placesResponse = await fetch('http://127.0.0.1:8000/api/all/place');
        if (placesResponse.ok) {
            const allPlaces = await placesResponse.json();
            const userPlaces = allPlaces.filter(place => place.user_id === userId);
            document.getElementById('placesCount').textContent = userPlaces.length;
        }
        
    } catch (error) {
        console.error('Error loading user stats:', error);
        // Keep default values
    }
}

// Logout function using auth manager
function logout() {
    authManager.logout();
}