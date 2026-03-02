const API_AUTH_URL = 'http://127.0.0.1:8000/api/auth/google';

// 1. Password Visibility Toggle
const togglePassword = document.querySelector('#togglePassword');
const passwordInput = document.querySelector('#passwordInput');
const eyeIcon = document.querySelector('#eyeIcon');

togglePassword.addEventListener('click', function () {
const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
passwordInput.setAttribute('type', type);

// Toggle icon classes
eyeIcon.classList.toggle('fa-eye');
eyeIcon.classList.toggle('fa-eye-slash');
});

// 2. Google Authentication Handler
// 2. Google Authentication Handler
async function handleCredentialResponse(response) {
    if (!response || !response.credential) {
        console.error("No credential received from Google");
        return;
    }

    try {
        const backendResponse = await fetch('http://127.0.0.1:8000/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential }) // Matches your BaseModel
        });

        if (backendResponse.ok) {
            const data = await backendResponse.json();
            localStorage.setItem('p2v_token', data.access_token);
            window.location.href = 'index.html';
        } else {
            // Log the actual error from FastAPI to the console
            const errorText = await backendResponse.text();
            console.error("Backend Error Response:", errorText);
        }
    } catch (error) {
        console.error("Network or Fetch Error:", error);
    }
}

// 3. Form Handling (Optional)
document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    // If you haven't built email login yet, keep this alert
    alert('Email login is currently disabled. Please use the Google Sign-In button above.');
};