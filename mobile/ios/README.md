# Co-Trainer iPhone App

This directory contains all iPhone-specific source code and configuration for the native Co-Trainer client.

## Directory Rules

- Keep all Swift, Xcode project, plist, entitlement, and iOS configuration files in this directory.
- Do not place iPhone-specific files in `frontend/` or `backend/`.
- If Android is added later, create a sibling directory at `mobile/android`.

## Suggested Layout

- `CoTrainerIOS/App` - app entrypoint and bootstrap
- `CoTrainerIOS/Config` - runtime environment config
- `CoTrainerIOS/Models` - API and domain models
- `CoTrainerIOS/Services` - API, auth, and plan services
- `CoTrainerIOS/Persistence` - offline cache storage
- `CoTrainerIOS/ViewModels` - state and business logic for views
- `CoTrainerIOS/Views` - SwiftUI screens and reusable UI

## API Contract

The app uses the existing backend contract:

- `POST /api/auth/login` (OAuth2 form body)
- `GET /api/auth/me`
- `GET /api/plans`
- `GET /api/plans/{id}`

## Next Step

Create an Xcode project/workspace in this directory and include the existing source tree.
