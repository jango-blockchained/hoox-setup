# Hoox Dashboard Zero Trust Setup

While the Hoox dashboard currently uses custom cookie-based authentication, Cloudflare Zero Trust (Access) provides a more robust, enterprise-grade security layer for accessing your trading command center. 

By placing your dashboard behind Cloudflare Access, you can enforce Multi-Factor Authentication (MFA), require Single Sign-On (SSO) via providers like GitHub or Google, and even check device posture before granting access.

## Prerequisites

1. Your Hoox Dashboard must be deployed to a Custom Domain (e.g., `hoox.yourdomain.com`). Cloudflare Access policies cannot be reliably enforced on raw `pages.dev` URLs.
2. A Cloudflare account with Zero Trust enabled (the free tier includes up to 50 users, which is more than enough for a personal trading setup).

## Setup Guide

### Step 1: Enable Zero Trust
1. Log in to the Cloudflare dashboard.
2. Navigate to **Zero Trust** from the sidebar.
3. If this is your first time, follow the onboarding prompts to set up your team name.

### Step 2: Create an Access Application
1. In the Zero Trust dashboard, go to **Access > Applications**.
2. Click **Add an application** and select **Self-hosted**.
3. **Application Name:** `Hoox Dashboard` (or any name you prefer).
4. **Session Duration:** Set to your preference (e.g., 24 hours).
5. **Application Domain:** Enter the custom domain where your Next.js dashboard is hosted (e.g., `hoox.yourdomain.com`).

### Step 3: Define Access Policies
1. Click **Next** to proceed to the Policies tab.
2. **Policy Name:** `Allow Admin`
3. **Action:** `Allow`
4. **Create a Rule:**
   - For a single user setup, the easiest rule is **Include > Emails** and enter your personal email address.
   - Alternatively, you can require a specific Identity Provider (like GitHub) under the **Include** options.
5. (Optional) In the **Require** block, you can enforce MFA or specific device posture checks (e.g., requiring a managed corporate device, though overkill for most personal setups).

### Step 4: Configure Authentication Methods
1. Click **Next** to go to the Setup tab.
2. Under **Identity providers**, select the login methods you want to allow (e.g., Email OTP, GitHub, Google). You can configure these in the main **Settings > Authentication** section of the Zero Trust dashboard.

### Step 5: Save and Test
1. Click **Add application**.
2. Navigate to your custom domain (`https://hoox.yourdomain.com`).
3. You should now be intercepted by a Cloudflare Access login screen. Once authenticated, you will be passed through to the standard Hoox dashboard.

## Optional: Removing Dashboard Auth
If you are strictly using Cloudflare Access and want to remove the redundant custom cookie authentication built into the Next.js dashboard, you can modify the `middleware.ts` file in the `dashboard` worker to bypass the login check, as Cloudflare Access already guarantees the user is authorized.
