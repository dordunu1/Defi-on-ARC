# Version Update System

This app includes an automatic version check system that forces users to refresh when a new version is deployed.

## How It Works

1. **Version Files**: 
   - `src/config/version.ts` - Contains the current app version (used by the app)
   - `public/version.json` - Contains the current version (polled by running apps)

2. **Version Check Hook**: 
   - Polls `/version.json` every 30 seconds
   - Compares with the current app version
   - Shows a modal when a new version is detected
   - Auto-refreshes after 10 seconds

3. **User Experience**:
   - Users with old versions will see a modal: "New Version Available"
   - They can click "Refresh Now" or wait 10 seconds for auto-refresh
   - The page reloads to get the latest version

## Updating Version

### Option 1: Use the script (Recommended)
```bash
npm run version:update 2.3.0
```

### Option 2: Manual update
1. Update `src/config/version.ts`:
   ```typescript
   export const APP_VERSION = '2.3.0';
   export const BUILD_TIME = '2025-11-16T12:00:00.000Z';
   ```

2. Update `public/version.json`:
   ```json
   {
     "version": "2.3.0",
     "buildTime": "2025-11-16T12:00:00.000Z"
   }
   ```

## Important Notes

- **Always update both files** when releasing a new version
- The version in `version.json` should match `version.ts`
- After updating, rebuild and deploy
- Users with old versions will be automatically prompted to refresh

## Deployment Checklist

- [ ] Update version in both files (or run `npm run version:update`)
- [ ] Test that version check works locally
- [ ] Build the app (`npm run build`)
- [ ] Deploy
- [ ] Verify that old sessions get the update prompt

