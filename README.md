# Smart AgriTech Platform

**Smart Agriculture Technology Platform** — IoT monitoring, AI crop advisory, weather analytics, and marketplace for modern farming.

## 🚀 Live Demo
Deployed on [Vercel](https://vercel.com)

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript
- **Auth**: Firebase Authentication (Email + Google)
- **Database**: Cloud Firestore
- **Deployment**: Vercel

## 📦 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase
```bash
cp .env .env.local
# Edit .env.local with your Firebase credentials from console.firebase.google.com
```

### 3. Local development
```bash
npm run dev
```

### 4. Deploy to Vercel
```bash
npx vercel
# Add Firebase env vars in Vercel Dashboard → Settings → Environment Variables
```

## 📁 Project Structure
```
├── index.html      # Single-page app (landing + auth + dashboard)
├── style.css       # Light professional theme
├── app.js          # Firebase Auth + Firestore + Dashboard logic
├── build.js        # Build script (env var injection)
├── package.json    # Project config
├── vercel.json     # Vercel deployment config
├── .env            # Env var template (committed)
├── .env.local      # Real env vars (NOT committed)
└── .gitignore      # Git ignore rules
```

## 🌾 Features
- **Landing Page**: Hero, Features, How it Works, Solutions, Tech Stack, Testimonials
- **Authentication**: Email/Password + Google Sign-in
- **3-Step Onboarding**: Account → Personal → Farm Setup
- **Dashboard**: Crop Monitor, Weather, Marketplace, Disease Detection, Reports, Settings
