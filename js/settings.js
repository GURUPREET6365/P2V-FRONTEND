document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('p2v_token');
    
    // Ensure this URL is exactly what's in your @router.get("/me")
    const API_USER_URL = 'http://127.0.0.1:8000/api/me'; 

    const loadingState = document.getElementById('loadingState');
    const authState = document.getElementById('authenticatedState');
    const errorState = document.getElementById('errorState');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(API_USER_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("User data received:", userData);

            // 1. Map your Pydantic model to the HTML IDs
            // Combining first_name and last_name since your model has them separate
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'P2V Explorer';
            
            document.getElementById('userName').innerText = fullName;
            document.getElementById('userEmail').innerText = userData.email;

            // 2. Handle Profile Picture (if you have an <img> tag for it)
            const profileImg = document.querySelector('.bg-primary i'); // Target the icon
            if (userData.profile_url && profileImg) {
                // Replace the icon with an actual image if profile_url exists
                const avatarContainer = profileImg.parentElement;
                avatarContainer.innerHTML = `<img src="${userData.profile_url}" class="rounded-circle w-100 h-100" style="object-fit: cover;">`;
            }

            // 3. Toggle Visibility
            loadingState.style.display = 'none';
            authState.style.display = 'block';

        } else {
            // If server returns 401 (Unauthorized), the token is likely dead
            console.error("Session invalid. Status:", response.status);
            throw new Error('Unauthorized');
        }
    } catch (error) {
        console.error("Auth Error:", error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
    }
});

function logout() {
    localStorage.removeItem('p2v_token');
    window.location.href = 'index.html';
}