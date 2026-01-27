// Unified Index Page - Django-like is_authenticated functionality
let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize authentication state
    const authResult = await authManager.initPageAuth(false);
    currentUser = authResult.user;
    
    // Render UI based on authentication state (Django-like)
    authManager.renderAuthState();
    
    // Load places for all users
    await loadPlaces();
    
    // Setup navigation
    setupNavigation();
});

// Load places for all users (authenticated and anonymous)
async function loadPlaces() {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const placesGrid = document.getElementById('placesGrid');

    try {
        let response;
        
        if (authManager.isAuthenticated()) {
            // Authenticated user - use auth manager for API calls
            response = await authManager.apiRequest('/all/place');
        } else {
            // Anonymous user - direct API call
            response = await fetch('http://127.0.0.1:8000/api/all/place');
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch places');
        }

        const places = await response.json();
        
        // Hide loading state
        loadingState.style.display = 'none';
        
        if (places.length === 0) {
            errorState.innerHTML = '<p>No places found. Be the first to share a place!</p>';
            errorState.style.display = 'block';
            return;
        }

        // Show places grid
        placesGrid.style.display = 'grid';
        
        // Render places based on authentication state
        renderPlaces(places);
        
        // Load vote states for authenticated users
        if (authManager.isAuthenticated()) {
            await loadVoteStates(places);
        }
        
    } catch (error) {
        console.error('Error loading places:', error);
        loadingState.style.display = 'none';
        
        if (error.message === 'Not authenticated') {
            // Auth error for authenticated users - re-render as anonymous
            authManager.clearAuth();
            authManager.renderAuthState();
            await loadPlaces(); // Retry as anonymous user
            return;
        }
        
        errorState.style.display = 'block';
    }
}

// Render places with Django-like conditional logic
function renderPlaces(places) {
    const placesGrid = document.getElementById('placesGrid');
    const isAuthenticated = authManager.isAuthenticated();
    
    placesGrid.innerHTML = places.map(place => {
        // Conditional rendering based on authentication state
        const cardContent = `
            <div class="place-card-container">
                ${isAuthenticated ? 
                    `<a href="place-details.html?id=${place.id}" class="place-card">` :
                    `<div class="place-card">`
                }
                    <div class="card-header">
                        <div class="location-icon">📍</div>
                        <div class="card-location">
                            <div class="place-name" title="${escapeHtml(place.place_name)}">${escapeHtml(truncateText(place.place_name, 30))}</div>
                            <div class="place-address" title="${escapeHtml(place.place_address)}">${escapeHtml(truncateText(place.place_address, 40))}</div>
                        </div>
                    </div>
                    
                    <div class="card-content">
                        <p class="place-description" title="${escapeHtml(place.about_place)}">${escapeHtml(truncateText(place.about_place, 120))}</p>
                    </div>
                ${isAuthenticated ? `</a>` : `</div>`}
                
                <div class="card-footer">
                    <div class="place-info">
                        <span class="place-pincode">📍 ${place.pincode}</span>
                    </div>
                    <div class="place-actions">
                        ${renderPlaceActions(place, isAuthenticated)}
                    </div>
                </div>
            </div>
        `;
        return cardContent;
    }).join('');
}

// Render place actions based on authentication state (Django-like conditional rendering)
function renderPlaceActions(place, isAuthenticated) {
    if (isAuthenticated) {
        // Authenticated user - interactive buttons
        return `
            <button class="action-btn" onclick="votePlace(${place.id}, true, this)" data-place-id="${place.id}" data-vote="like">
                ❤️ <span>Like</span>
            </button>
            <button class="action-btn" onclick="votePlace(${place.id}, false, this)" data-place-id="${place.id}" data-vote="dislike">
                👎 <span>Dislike</span>
            </button>
            <button class="action-btn" onclick="sharePlace(${place.id}, '${escapeHtml(place.place_name)}')" title="Share place">
                📤 <span>Share</span>
            </button>
        `;
    } else {
        // Anonymous user - login prompts
        return `
            <button class="action-btn" onclick="showLoginPrompt()" title="Sign in to like">
                ❤️ <span>Like</span>
            </button>
            <button class="action-btn" onclick="showLoginPrompt()" title="Sign in to dislike">
                👎 <span>Dislike</span>
            </button>
            <button class="action-btn" onclick="sharePlace(${place.id}, '${escapeHtml(place.place_name)}')" title="Share place">
                📤 <span>Share</span>
            </button>
        `;
    }
}

// Load vote states for authenticated users
async function loadVoteStates(places) {
    if (!authManager.isAuthenticated()) return;
    
    const user = authManager.getCurrentUser();
    
    for (const place of places) {
        try {
            const response = await authManager.apiRequest(`/place/${place.id}`);
            if (response.ok) {
                const data = await response.json();
                updateVoteUI(place.id, data.vote);
            }
        } catch (error) {
            console.error(`Error loading vote for place ${place.id}:`, error);
        }
    }
}

// Vote on a place (authenticated users only)
async function votePlace(placeId, isLike, buttonElement) {
    if (!authManager.isAuthenticated()) {
        showLoginPrompt();
        return;
    }
    
    const user = authManager.getCurrentUser();
    
    try {
        // Disable button during request
        buttonElement.disabled = true;
        
        // Check current vote state
        const currentVote = getCurrentVoteState(placeId);
        let voteValue;
        
        // Toggle logic: if clicking the same vote, send null to remove vote
        if (currentVote === isLike) {
            voteValue = null; // Remove vote
        } else {
            voteValue = isLike; // Set new vote
        }
        
        const response = await authManager.apiRequest(`/add/vote/${user.id}/${placeId}`, {
            method: 'POST',
            body: JSON.stringify({
                vote: voteValue
            })
        });
        
        if (response.ok) {
            // Update UI to reflect the vote
            updateVoteUI(placeId, voteValue);
        } else {
            throw new Error('Failed to vote');
        }
    } catch (error) {
        console.error('Error voting:', error);
        alert('Failed to vote. Please try again.');
    } finally {
        buttonElement.disabled = false;
    }
}

// Get current vote state for a place
function getCurrentVoteState(placeId) {
    const likeBtn = document.querySelector(`[data-place-id="${placeId}"][data-vote="like"]`);
    const dislikeBtn = document.querySelector(`[data-place-id="${placeId}"][data-vote="dislike"]`);
    
    if (likeBtn && likeBtn.classList.contains('liked')) {
        return true;
    } else if (dislikeBtn && dislikeBtn.classList.contains('disliked')) {
        return false;
    }
    return null;
}

// Update vote UI
function updateVoteUI(placeId, vote) {
    const likeBtn = document.querySelector(`[data-place-id="${placeId}"][data-vote="like"]`);
    const dislikeBtn = document.querySelector(`[data-place-id="${placeId}"][data-vote="dislike"]`);
    
    if (likeBtn && dislikeBtn) {
        // Reset both buttons
        likeBtn.classList.remove('liked');
        dislikeBtn.classList.remove('disliked');
        
        // Set active state based on vote
        if (vote === true) {
            likeBtn.classList.add('liked');
        } else if (vote === false) {
            dislikeBtn.classList.add('disliked');
        }
    }
}

// Show login prompt for anonymous users
function showLoginPrompt() {
    if (confirm('Please sign in to like or dislike places. Would you like to sign in now?')) {
        window.location.href = './login.html';
    }
}

// Share place functionality (available to all users)
function sharePlace(placeId, placeName) {
    const url = `${window.location.origin}/place-details.html?id=${placeId}`;
    
    if (navigator.share) {
        navigator.share({
            title: `Check out ${placeName}`,
            text: `I found this amazing place: ${placeName}`,
            url: url
        }).catch(console.error);
    } else {
        // Fallback for browsers that don't support Web Share API
        navigator.clipboard.writeText(url).then(() => {
            alert('Place link copied to clipboard!');
        }).catch(() => {
            // Fallback if clipboard API fails
            prompt('Copy this link to share:', url);
        });
    }
}

// Setup navigation
function setupNavigation() {
    // Handle navigation clicks
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

// Global function to handle authentication state changes
window.onAuthStateChange = function() {
    // Re-render UI when auth state changes (e.g., after login)
    authManager.renderAuthState();
    loadPlaces(); // Reload places with new auth state
};