# DeDe Account

Application template for Vue based on the [create-vue](https://github.com/vuejs/create-vue), the recommended way to start a Vite-powered Vue projects.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Build

```bash
# Build for production
npm run build
```

## Firebase Hosting Deployment

This project is deployed to Firebase Hosting.

### Live URL
- **Production**: [https://dede-account-dev.web.app](https://dede-account-dev.web.app)

### Deploy to Firebase

```bash
# Build and deploy
npm run build && firebase deploy --only hosting:dede-account-dev
```

### Firebase Configuration
- **Project**: dedepos
- **Hosting Site**: dede-account-dev
- **Account**: bos.catdog@gmail.com

### First Time Setup

If you need to set up Firebase hosting from scratch:

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase (already configured):
```bash
firebase init hosting
```

4. Deploy:
```bash
npm run build
firebase deploy --only hosting:dede-account-dev
```

## Documentation

Visit the [documentation](https://sakai.primevue.org/documentation) to get started with the template.
