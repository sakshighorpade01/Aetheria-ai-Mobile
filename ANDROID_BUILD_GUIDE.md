# Android Build Guide for Aetheria AI

This guide explains how to build the Android version of Aetheria AI.

**Note:** You currently do not have the necessary environment (Java/Android SDK) to build the app. You must follow the "Prerequisites" section first.

## Prerequisites

To build Android apps, you need the **Android SDK** and **Java Development Kit (JDK)**.

### Option A: Install Android Studio (Recommended)
This is the easiest way as it installs everything you need.
1.  Download and install [Android Studio](https://developer.android.com/studio).
2.  During installation, ensure **Android SDK** and **Android Virtual Device** are selected.
3.  Open Android Studio and let it finish setting up the SDK.

### Option B: Command Line Tools (Advanced)
If you don't want the full IDE:
1.  Install **OpenJDK 17** (e.g., from [Adoptium](https://adoptium.net/)).
    *   Set `JAVA_HOME` environment variable to your JDK installation path.
2.  Download **Android Command Line Tools**.
    *   Set `ANDROID_HOME` environment variable.
    *   Install platform tools: `sdkmanager "platform-tools" "platforms;android-33"`.

## Building the APK

Once prerequisites are met:

1.  **Open Terminal** in the project folder.
2.  **Navigate to Android folder**:
    ```powershell
    cd android
    ```
3.  **Build Debug APK** (for testing):
    ```powershell
    .\gradlew assembleDebug
    ```
    *   The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`
    *   You can transfer this file to your phone and install it.

4.  **Build Release Bundle** (for Play Store):
    ```powershell
    .\gradlew bundleRelease
    ```
    *   The AAB file will be at: `android/app/build/outputs/bundle/release/app-release.aab`

## Running on Device

If you have Android Studio:
1.  Connect your phone via USB (enable USB Debugging in Developer Options).
2.  Run:
    ```powershell
    npx cap open android
    ```
3.  Click the **Run** (Play) button in Android Studio.

## Troubleshooting

*   **"JAVA_HOME is not set"**: You need to install Java (JDK) and set the environment variable.
*   **SDK Location not found**: Create a `local.properties` file in the `android` folder with:
    ```
    sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
    ```
