// Place Details page JavaScript
let currentPlace = null;
let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Get place ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const placeId = urlParams.get('id');
    
    if (!placeId) {
        showError('No place ID provided');
        return;
    }

    // Check authentication
    const authResult = await authManager.initPageAuth(false);
    currentUser = authResult.user;
    
    // Update navigation
    if (currentUser) {
        updateNavProfile(currentUser);
    } else {
        // For non-authenticated users, show sign in button
        const userProfile = document.getElementById('userProfile');
        userProfile.href = 'login.html';
        userProfile.textContent = 'Sign In';
        userProfile.className = 'btn-secondary';
        userProfile.style.padding = '8px 16px';
        userProfile.style.fontSize = '14px';
    }

    // Load place details
    await loadPlaceDetails(placeId);
});

// Load place details
async function loadPlaceDetails(placeId) {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const placeDetailsContainer = document.getElementById('placeDetailsContainer');

    try {
        let placeData, userVote = null;
        
        if (currentUser) {
            // Authenticated user - get place with vote info
            const response = await authManager.apiRequest(`/place/${placeId}`);
            if (response.ok) {
                const data = await response.json();
                placeData = Array.isArray(data.place) ? data.place[0] : data.place;
                userVote = data.vote;
            } else {
                throw new Error('Failed to fetch place details');
            }
        } else {
            // Anonymous user - get place from all places endpoint
            const allPlacesResponse = await fetch('http://127.0.0.1:8000/api/all/place');
            if (allPlacesResponse.ok) {
                const allPlaces = await allPlacesResponse.json();
                placeData = allPlaces.find(p => p.id == placeId);
                if (!placeData) {
                    throw new Error('Place not found');
                }
                userVote = null; // Anonymous users have no vote
            } else {
                throw new Error('Failed to fetch places');
            }
        }

        currentPlace = placeData;
        
        // Hide loading state
        loadingState.style.display = 'none';
        
        if (!currentPlace) {
            throw new Error('Place not found');
        }

        // Show place details
        placeDetailsContainer.style.display = 'block';
        
        // Render place details
        renderPlaceDetails(currentPlace, userVote);
        
    } catch (error) {
        console.error('Error loading place details:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
    }
}

// Render place details
function renderPlaceDetails(place, userVote) {
    // Update title and meta
    document.title = `${place.place_name} - P2V`;
    
    // Update place info
    document.getElementById('placeTitle').textContent = place.place_name;
    document.getElementById('placeAddress').textContent = place.place_address;
    document.getElementById('placeDescription').textContent = place.about_place;
    document.getElementById('placePincode').textContent = place.pincode;
    
    // Update vote buttons
    updateVoteButtons(userVote);
    
    // Update share button
    const shareBtn = document.getElementById('shareBtn');
    if (!currentUser) {
        shareBtn.onclick = () => shareCurrentPlace();
    }
}

// Update vote buttons based on user's vote
function updateVoteButtons(userVote) {
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    
    // Reset buttons
    likeBtn.classList.remove('active');
    dislikeBtn.classList.remove('active');
    
    if (!currentUser) {
        // Non-authenticated users
        likeBtn.onclick = () => promptLogin();
        dislikeBtn.onclick = () => promptLogin();
        likeBtn.title = 'Sign in to like';
        dislikeBtn.title = 'Sign in to dislike';
        return;
    }
    
    // Set active state based on user's vote
    if (userVote === true) {
        likeBtn.classList.add('active');
    } else if (userVote === false) {
        dislikeBtn.classList.add('active');
    }
}

// Vote on place
async function votePlace(isLike) {
    if (!currentUser) {
        promptLogin();
        return;
    }
    
    if (!currentPlace) {
        alert('Place data not loaded');
        return;
    }
    
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    
    try {
        // Disable buttons during request
        likeBtn.disabled = true;
        dislikeBtn.disabled = true;
        
        // Get current vote state
        const currentVote = getCurrentVoteState();
        let voteValue;
        
        // Toggle logic: if clicking the same vote, send null to remove vote
        if (currentVote === isLike) {
            voteValue = null; // Remove vote
        } else {
            voteValue = isLike; // Set new vote
        }
        
        const response = await authManager.apiRequest(`/add/vote/${currentUser.id}/${currentPlace.id}`, {
            method: 'POST',
            body: JSON.stringify({
                vote: voteValue
            })
        });
        
        if (response.ok) {
            // Update UI to reflect the vote
            updateVoteButtons(voteValue);
        } else {
            throw new Error('Failed to vote');
        }
    } catch (error) {
        console.error('Error voting:', error);
        alert('Failed to vote. Please try again.');
    } finally {
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
    }
}

// Get current vote state
function getCurrentVoteState() {
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    
    if (likeBtn.classList.contains('active')) {
        return true;
    } else if (dislikeBtn.classList.contains('active')) {
        return false;
    }
    return null;
}

// Share current place
function shareCurrentPlace() {
    if (!currentPlace) {
        alert('Place data not loaded');
        return;
    }
    
    const url = window.location.href;
    const title = `Check out ${currentPlace.place_name}`;
    const text = `I found this amazing place: ${currentPlace.place_name}`;
    
    if (navigator.share) {
        navigator.share({
            title: title,
            text: text,
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

// Prompt login for non-authenticated users
function promptLogin() {
    if (confirm('Please sign in to like or dislike places. Would you like to sign in now?')) {
        window.location.href = './login.html';
    }
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

// Show error state
function showError(message) {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    errorState.querySelector('p').textContent = message;
}

// Format date utility
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}