// js/auth.js
async function verifySession() {
    const token = localStorage.getItem('p2v_token');
    if (!token) return null;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.ok ? await response.json() : null;
    } catch (e) {
        return null;
    }
}

function logout() {
    localStorage.removeItem('p2v_token');
    window.location.href = 'index.html';
}