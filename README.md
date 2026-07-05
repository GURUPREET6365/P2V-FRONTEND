# Place2Visit Frontend

Frontend application for Place2Visit, built with vanilla HTML/CSS/JavaScript and Bootstrap.

This project provides:
- Public and authenticated place browsing
- Like/dislike voting
- Category-based place rating (create + update on same endpoint)
- Place details with rating breakdown
- Admin dashboard with model views (places, users, votes, ratings)

## 1. Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Bootstrap 5
- Font Awesome

## 2. Project Structure

```text
Place2Visit-FRONTEND/
├── css/
│   ├── index.css
│   ├── auth.css
│   ├── login.css
│   ├── settings.css
│   ├── place_details.css
│   └── admin.css
├── js/
│   ├── auth.js
│   ├── layout.js
│   ├── index.js
│   ├── login.js
│   ├── places.js
│   ├── place_details.js
│   ├── settings.js
│   ├── admin.js
│   ├── admin_places.js
│   ├── admin_users.js
│   ├── admin_votes.js
│   ├── admin_ratings.js
│   └── admin_data.js
├── index.html
├── login.html
├── places.html
├── place_details.html
├── settings.html
├── admin.html
├── admin_places.html
├── admin_users.html
├── admin_votes.html
├── admin_ratings.html
└── README.md
```

## 3. Prerequisites

- Backend API running (expected base URL: `https://unvigilantly-unvacillating-candance.ngrok-free.dev`)
- Modern browser (Chrome/Edge/Firefox)

## 4. Local Run

Serve this folder with any static server.

Example (Python):

```bash
cd Place2Visit-FRONTEND
python -m http.server 5500
```

Open:
- `http://127.0.0.1:5500/index.html`

## 5. Configuration

API base is defined in:
- `js/auth.js` -> `API_BASE_URL`

Default:
- `https://unvigilantly-unvacillating-candance.ngrok-free.dev`

## 6. Core User Flows

### Authentication
- Session/token handling via `AuthManager` (`js/auth.js`)
- Protected page guards via `requireAuth()`

### Places Listing (`places.html`)
- Fetch all places
- Render cards with:
  - place info
  - like/dislike counts
  - overall rating display
  - total users rated
- Sort cards by highest rating and engagement
- Open rating modal from card
- Prefill modal when `is_user_rated = true`

### Place Details (`place_details.html`)
- Fetch single place details by `id` query param
- Like/dislike with counts
- Show 7 category ratings section at bottom
- Edit rating through modal with prefilled stars (if user already rated)

## 7. Rating Model (Frontend Payload)

Frontend submits rating payload as:

```json
{
  "overall": 5,
  "cleanliness": 4,
  "safety": 5,
  "crowd_behavior": 4,
  "lightning": 4,
  "transport_access": 5,
  "facility_quality": 4
}
```

Endpoint used for both create and update:
- `POST /api/place/rating/{place_id}`

Auth:
- Requires `Authorization: Bearer <token>`

## 8. Admin Module

Admin pages:
- `admin.html` (dashboard)
- `admin_places.html`
- `admin_users.html`
- `admin_votes.html`
- `admin_ratings.html`

Ratings admin endpoint:
- `GET /api/admin/rating`

Access:
- Admin-restricted routes verify role using session user data.

## 9. API Endpoints Used (Current)

- `GET /api/me`
- `GET /api/all/place` (fallback: `GET /api/place`)
- `GET /api/place/{id}`
- `POST /api/vote/{place_id}`
- `POST /api/place/rating/{place_id}`
- `GET /api/admin/votes`
- `GET /api/admin/rating`

## 10. UI Notes

- Rating forms are shown in floating Bootstrap modals
- All 7 rating categories are mandatory
- Rate button is visually highlighted when user already rated
- Stars are fixed to correctly map click value (5 = 5)

## 11. Troubleshooting

- `401/403` responses:
  - Session/token likely expired
  - User is redirected to login on protected actions

- Ratings not visible on cards:
  - Ensure backend returns `total_user_rated` and either category fields or overall-compatible value

- Admin page shows access error:
  - Logged-in role is not `admin`

## 12. Security Notes

- JWT token is stored in browser local storage by current implementation.
- Do not use this setup as-is for high-security production environments without hardening.

## 13. Future Improvements

- Add linting/format tooling and CI checks
- Add integration tests for rating/vote flows
- Add typed API layer for stronger frontend-backend contracts
- Add pagination and filtering for large place datasets

