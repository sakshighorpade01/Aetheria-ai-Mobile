// js/user-profile-service.js
// Browser-friendly profile utility used by welcome display, AIOS settings, etc.

import { supabase } from './supabase-client.js';

const LOCAL_STORAGE_KEYS = [
  'aios_user_display_name',
  'aios_profile_name',
  'aios:user_display_name',
];

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

class UserProfileService {
  constructor({ cacheExpiry = CACHE_EXPIRY_MS } = {}) {
    this.cachedUserName = null;
    this.cacheTimestamp = null;
    this.cacheExpiry = cacheExpiry;
  }

  async getUserName() {
    if (this.cachedUserName && this.isCacheValid()) {
      return this.formatNameForDisplay(this.cachedUserName);
    }

    const sources = [
      () => this.getNameFromLocalProfile(),
      () => this.getNameFromAiosData(),
      () => this.getNameFromSupabase(),
    ];

    // Execute sources sequentially until one returns a truthy value
    for (const source of sources) {
      try {
        const value = await source();
        if (value) {
          return this.cacheAndReturn(value);
        }
      } catch (error) {
        console.warn('UserProfileService: source lookup failed', error);
      }
    }

    return this.cacheAndReturn('there');
  }

  getNameFromLocalProfile() {
    try {
      for (const key of LOCAL_STORAGE_KEYS) {
        const value = window.localStorage?.getItem(key);
        if (value && value.trim()) {
          return value.trim();
        }
      }
      return null;
    } catch (error) {
      console.warn('UserProfileService: unable to read localStorage', error);
      return null;
    }
  }

  getNameFromAiosData() {
    try {
      const userData = window?.AIOS?.userData;
      const name = userData?.account?.name;
      if (typeof name === 'string' && name.trim() && name.trim() !== 'User Name') {
        return name.trim();
      }
      return null;
    } catch (error) {
      console.warn('UserProfileService: AIOS data unavailable', error);
      return null;
    }
  }

  async getNameFromSupabase() {
    try {
      if (!supabase?.auth) {
        return null;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('UserProfileService: Supabase session error', error);
        return null;
      }
      const user = data?.session?.user;
      if (!user) {
        return null;
      }

      const metadata = user.user_metadata || {};
      const nameCandidates = [
        metadata.name,
        metadata.full_name,
        metadata.display_name,
      ];
      for (const value of nameCandidates) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }

      if (typeof user.email === 'string' && user.email.trim()) {
        const emailName = user.email.split('@')[0];
        if (emailName) {
          return emailName.replace(/[._-]+/g, ' ').trim();
        }
      }

      return null;
    } catch (error) {
      console.warn('UserProfileService: Supabase lookup failed', error);
      return null;
    }
  }

  saveNameToLocalProfile(name) {
    try {
      if (!name || !name.trim()) return;
      window.localStorage?.setItem(LOCAL_STORAGE_KEYS[0], name.trim());
      this.cacheAndReturn(name.trim());
    } catch (error) {
      console.warn('UserProfileService: unable to cache name locally', error);
    }
  }

  cacheAndReturn(name) {
    this.cachedUserName = name;
    this.cacheTimestamp = Date.now();
    return this.formatNameForDisplay(name);
  }

  isCacheValid() {
    if (!this.cacheTimestamp) return false;
    return Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  formatNameForDisplay(name) {
    if (typeof name !== 'string') {
      return 'there';
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return 'there';
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  clearCache() {
    this.cachedUserName = null;
    this.cacheTimestamp = null;
  }
}

export default UserProfileService;
