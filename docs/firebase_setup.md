# ABSTRIQ 3.0 — Firebase Setup & Deployment Guide

This document provides complete instructions for setting up Firebase Authentication, Cloud Firestore, and Firebase Storage for production and development.

---

## 1. Firebase Project Initialization

1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project: `abstriq-evaluator` (or select your target Google Cloud project).
3. **Enable Cloud Firestore**:
   - Go to **Build > Firestore Database**.
   - Click **Create Database**.
   - Choose your target region (e.g., `us-central1`).
   - Start in **Production mode** (Security Rules will be deployed from `firestore.rules`).
4. **Enable Firebase Authentication**:
   - Go to **Build > Authentication > Sign-in method**.
   - Enable **Email/Password**.
   - Ensure "Email link (passwordless sign-in)" is disabled.
   - Note: Google / Third-Party OAuth providers are **not required** and kept disabled.
5. **Enable Firebase Storage**:
   - Go to **Build > Storage**.
   - Click **Get Started**.
   - Deploy `storage.rules` to enforce per-user isolation.

---

## 2. Service Account Generation & Backend Configuration

1. In the Firebase Console, open **Project Settings > Service accounts**.
2. Click **Generate new private key**.
3. Save the downloaded JSON file securely in your backend root or credentials directory:
   ```bash
   chmod 600 firebase_service_account.json
   ```
4. Configure environment variables in `.env`:
   ```bash
   FIREBASE_PROJECT_ID="abstriq-evaluator"
   FIREBASE_STORAGE_BUCKET="abstriq-evaluator.appspot.com"
   FIREBASE_CREDENTIALS_PATH="./firebase_service_account.json"
   FIREBASE_USE_EMULATOR="false"
   ```

---

## 3. Frontend Web App Registration

1. In Firebase Console, click **Project Settings > General > Your apps**.
2. Click the **Web** icon (`</>`) to add a web application.
3. Configure `frontend/.env`:
   ```bash
   VITE_FIREBASE_API_KEY="AIzaSy..."
   VITE_FIREBASE_AUTH_DOMAIN="abstriq-evaluator.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="abstriq-evaluator"
   VITE_FIREBASE_STORAGE_BUCKET="abstriq-evaluator.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
   VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef"
   ```

---

## 4. Deploying Security Rules

Install Firebase CLI if needed:
```bash
npm install -g firebase-tools
firebase login
firebase use abstriq-evaluator
```

Deploy Firestore and Storage rules:
```bash
firebase deploy --only firestore:rules,storage
```

---

## 5. Development & CI/CD Mock Mode

When `firebase_service_account.json` is omitted or in offline/testing environments, `services.firebase_service` automatically falls back to an in-memory concurrent mock store adhering strictly to the same schema, token verification, and encryption semantics. Tests (`pytest tests/`) execute without requiring active cloud network egress.
