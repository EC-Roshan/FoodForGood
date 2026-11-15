// Temporary prototype storage — replace with real API + bcrypt when the backend is built.

(function () {
  'use strict';

  /* ─────────────────────────── constants ─────────────────────────── */

  const TABLES = {
    ffg_users:         'user_id',
    ffg_donors:        'donor_id',
    ffg_ngos:          'ngo_id',
    ffg_listings:      'listing_id',
    ffg_requests:      'request_id',
    ffg_handovers:     'handover_id',
    ffg_distributions: 'distribution_id',
  };

  const SESSION_KEY = 'ffg_session';

  /* ─────────────────────────── helpers ───────────────────────────── */

  function _pkField(table) {
    return TABLES[table] || null;
  }

  function _load(table) {
    try {
      return JSON.parse(localStorage.getItem(table)) || [];
    } catch (_) {
      return [];
    }
  }

  function _save(table, arr) {
    localStorage.setItem(table, JSON.stringify(arr));
  }

  function _genId() {
    return Date.now() + Math.random();
  }

  /* ═══════════════════════════ FFGStore ══════════════════════════════ */

  const FFGStore = {

    /* ── basic CRUD ─────────────────────────────────────────────── */

    /**
     * Returns all records in the given table.
     * @param {string} table
     * @returns {Array}
     */
    getAll(table) {
      return _load(table);
    },

    /**
     * Finds a record by its primary-key value.
     * Falls back to scanning every _id field if the PK isn't found.
     * @param {string} table
     * @param {*} id
     * @returns {Object|undefined}
     */
    getById(table, id) {
      const rows = _load(table);
      // Try the canonical PK field first
      const pk = _pkField(table);
      if (pk) {
        const hit = rows.find(r => r[pk] === id || String(r[pk]) === String(id));
        if (hit) return hit;
      }
      // Fallback: search any field ending with '_id'
      return rows.find(r =>
        Object.keys(r).some(k => k.endsWith('_id') &&
          (r[k] === id || String(r[k]) === String(id)))
      );
    },

    /**
     * Returns the first record where field === value.
     * @param {string} table
     * @param {string} field
     * @param {*} value
     * @returns {Object|undefined}
     */
    findBy(table, field, value) {
      return _load(table).find(r => r[field] === value || (r[field] != null && value != null && String(r[field]) === String(value)));
    },

    /**
     * Returns all records where field === value.
     * @param {string} table
     * @param {string} field
     * @param {*} value
     * @returns {Array}
     */
    findAllBy(table, field, value) {
      return _load(table).filter(r => r[field] === value || (r[field] != null && value != null && String(r[field]) === String(value)));
    },

    /**
     * Inserts a new record. Auto-generates the PK and created_at.
     * @param {string} table
     * @param {Object} obj
     * @returns {Object} The saved record.
     */
    insert(table, obj) {
      const rows = _load(table);
      const pk   = _pkField(table);
      const record = Object.assign({}, obj);

      // Auto-generate primary key
      if (pk && !record[pk]) {
        record[pk] = _genId();
      }

      // Auto-set created_at
      if (!record.created_at) {
        record.created_at = new Date().toISOString();
      }

      rows.push(record);
      _save(table, rows);
      return record;
    },

    /**
     * Updates an existing record by its primary key.
     * @param {string} table
     * @param {*} id
     * @param {Object} changes
     * @returns {Object|null} The updated record, or null if not found.
     */
    update(table, id, changes) {
      const rows = _load(table);
      const pk   = _pkField(table);
      if (!pk) return null;

      const idx = rows.findIndex(
        r => r[pk] === id || String(r[pk]) === String(id)
      );
      if (idx === -1) return null;

      rows[idx] = Object.assign({}, rows[idx], changes);
      _save(table, rows);
      return rows[idx];
    },

    /* ── session management ─────────────────────────────────────── */

    /**
     * Returns the current session object, checking localStorage first, then sessionStorage.
     * @returns {Object|null}
     */
    getSession() {
      try {
        const ls = localStorage.getItem(SESSION_KEY);
        if (ls) return JSON.parse(ls);
        const ss = sessionStorage.getItem(SESSION_KEY);
        if (ss) return JSON.parse(ss);
      } catch (_) {}
      return null;
    },

    /**
     * Persists the session. If remember is true, uses localStorage; otherwise sessionStorage.
     * @param {Object} user
     * @param {boolean} remember
     */
    setSession(user, remember) {
      const payload = JSON.stringify({ user_id: user.user_id, role: user.role });
      if (remember) {
        localStorage.setItem(SESSION_KEY, payload);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, payload);
        localStorage.removeItem(SESSION_KEY);
      }
    },

    /**
     * Clears the session from both storages and redirects to index.html.
     */
    logout() {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = 'index.html';
      }
    },

    /**
     * Returns {user, donor} for the currently logged-in donor, or null.
     * @returns {{user: Object, donor: Object}|null}
     */
    currentDonor() {
      const session = this.getSession();
      if (!session) return null;

      const user = this.getById('ffg_users', session.user_id);
      if (!user) return null;

      const donor = this.findBy('ffg_donors', 'user_id', user.user_id);
      if (!donor) return null;

      return { user, donor };
    },

    /* ── security ───────────────────────────────────────────────── */

    /**
     * Hashes a plain-text password with SHA-256 via the Web Crypto API.
     * @param {string} text
     * @returns {Promise<string>} Lowercase hex digest.
     */
    async hashPassword(text) {
      const encoded = new TextEncoder().encode(text);
      const buffer  = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },

    /* ── business logic ─────────────────────────────────────────── */

    /**
     * Marks listings past their expiry as 'expired' and rejects their pending requests.
     */
    expireListings() {
      const now      = new Date().toISOString();
      const listings = _load('ffg_listings');
      let changed    = false;

      listings.forEach((listing, idx) => {
        if (
          (listing.status === 'available' || listing.status === 'requested') &&
          listing.expires_at && (new Date(listing.expires_at).getTime() < Date.now())
        ) {
          listings[idx] = Object.assign({}, listing, { status: 'expired' });
          changed = true;

          // Reject all pending requests for this listing
          const requests = _load('ffg_requests');
          let reqChanged = false;
          requests.forEach((req, ri) => {
            if (
              (req.listing_id === listing.listing_id ||
               String(req.listing_id) === String(listing.listing_id)) &&
              req.status === 'pending'
            ) {
              requests[ri] = Object.assign({}, req, { status: 'rejected' });
              reqChanged = true;
            }
          });
          if (reqChanged) _save('ffg_requests', requests);
        }
      });

      if (changed) _save('ffg_listings', listings);
    },

    /**
     * Seeds demo NGO users, a demo donor, and a demo admin on first load.
     */
    seedDemoData() {
      // Seed a default demo donor for quick testing if not present
      if (!this.findBy('ffg_users', 'email', 'donor@demo.com')) {
        const demoDonorUser = this.insert('ffg_users', {
          full_name:     'Ramesh Sharma',
          email:         'donor@demo.com',
          phone:         '9876543210',
          password_hash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', // password123
          role:          'donor',
          status:        'active',
        });
        this.insert('ffg_donors', {
          user_id:    demoDonorUser.user_id,
          donor_type: 'restaurant',
          org_name:   'The Good Spoon Restaurant',
          address:    'Plot 42, Knowledge Park',
          city:       'Greater Noida',
          pincode:    '201310',
          fssai_no:   '10019011000123',
        });
      }

      // Demo admin account (Prototype/Demo only — replace with secure backend auth in production)
      if (!this.findBy('ffg_users', 'email', 'admin@foodforgood.in')) {
        this.insert('ffg_users', {
          full_name:     'System Administrator',
          email:         'admin@foodforgood.in',
          phone:         '9999999999',
          password_hash: 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7', // Admin@123
          role:          'admin',
          status:        'active',
        });
      }

      if (localStorage.getItem('ffg_seeded') === '1') return;

      const demoNgos = [
        {
          full_name: 'Roti Bank Ghaziabad',
          email:     'rotibank@demo.com',
          phone:     '9000000001',
          ngo_name:  'Roti Bank Ghaziabad',
          city:      'Ghaziabad',
          people_served:       350,
          pickup_capability:   'own_vehicle',
          verification_status: 'verified',
        },
        {
          full_name: 'Hope Shelter Noida',
          email:     'hopeshelter@demo.com',
          phone:     '9000000002',
          ngo_name:  'Hope Shelter Noida',
          city:      'Noida',
          people_served:       150,
          pickup_capability:   'need_delivery',
          verification_status: 'verified',
        },
        {
          full_name: 'Annapurna Seva Delhi',
          email:     'annapurna@demo.com',
          phone:     '9000000003',
          ngo_name:  'Annapurna Seva Delhi',
          city:      'Delhi',
          people_served:       500,
          pickup_capability:   'own_vehicle',
          verification_status: 'verified',
        },
      ];

      demoNgos.forEach(data => {
        const user = this.insert('ffg_users', {
          full_name:     data.full_name,
          email:         data.email,
          phone:         data.phone,
          password_hash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', // password123
          role:          'ngo',
          status:        'active',
        });

        this.insert('ffg_ngos', {
          user_id:             user.user_id,
          ngo_name:            data.ngo_name,
          city:                data.city,
          people_served:       data.people_served,
          pickup_capability:   data.pickup_capability,
          verification_status: data.verification_status,
        });
      });

      localStorage.setItem('ffg_seeded', '1');
    },

    /**
     * Simulates an NGO picking up and requesting a listing.
     * @param {*} listing_id
     * @returns {Object|null} The new request record, or null if the listing isn't available.
     */
    simulateNgoRequest(listing_id) {
      const listing = this.getById('ffg_listings', listing_id);
      if (!listing || listing.status !== 'available') return null;

      const ngos = _load('ffg_ngos');
      if (!ngos.length) return null;

      const ngo = ngos[Math.floor(Math.random() * ngos.length)];

      const messages = [
        'We serve daily meals to underprivileged families, this donation will help greatly.',
        'Our shelter hosts over a hundred people each night — your food will feed them tonight.',
        'We run community kitchens across the city; this contribution will be distributed immediately.',
      ];
      const message = messages[Math.floor(Math.random() * messages.length)];

      const requested_qty = Math.min(
        listing.quantity,
        Math.floor(Math.random() * listing.quantity) + 1
      );

      const request = this.insert('ffg_requests', {
        listing_id:    listing.listing_id,
        ngo_id:        ngo.ngo_id,
        requested_qty,
        message,
        status:        'pending',
        requested_at:  new Date().toISOString(),
        responded_at:  null,
      });

      // Mark listing as requested
      this.update('ffg_listings', listing.listing_id, { status: 'requested' });

      return request;
    },
  };

  /* ─────────────────── expose globally ───────────────────────── */
  window.FFGStore = FFGStore;

  /* ─────────────────── boot ───────────────────────────────────── */
  FFGStore.seedDemoData();

})();
