# iOS Build Guide for Aetheria AI

This guide explains how to build the iOS version of Aetheria AI.

**Prerequisites:**
*   A Mac computer running macOS.
*   Xcode installed (available from the Mac App Store).
*   CocoaPods installed (`sudo gem install cocoapods`).

## Steps

1.  **Transfer Project**: Copy the entire project folder to your Mac.
2.  **Install Dependencies**:
    Open a terminal in the project directory and run:
    ```bash
    npm install
    ```
3.  **Build Web Assets**:
    Generate the `dist` folder with the latest web assets:
    ```bash
    npm run build
    ```
4.  **Sync Capacitor**:
    Update the iOS native project with your web assets and plugins:
    ```bash
    npx cap sync ios
    ```
5.  **Open in Xcode**:
    Open the iOS project in Xcode:
    ```bash
    npx cap open ios
    ```
6.  **Configure Signing**:
    *   In Xcode, click on the **App** project in the left navigator.
    *   Select the **App** target.
    *   Go to the **Signing & Capabilities** tab.
    *   Select your **Team** (you may need to log in with your Apple ID).
    *   Ensure the **Bundle Identifier** is unique (e.g., `com.aetheria.ai`).
7.  **Build and Run**:
    *   Connect your iPhone or select a Simulator.
    *   Click the **Play** button (Run) in the top-left corner.

## Troubleshooting
*   **CocoaPods Errors**: If you encounter issues with pods, try running `cd ios/App && pod install && cd ../..`.
*   **Signing Issues**: Ensure you have a valid Apple Developer account (free or paid) and have selected it in the Signing settings.
