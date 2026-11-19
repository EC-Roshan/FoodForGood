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
    ffg_activity_log:  'log_id',
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
     * Returns the current session object, checking sessionStorage first (tab-scoped), then localStorage.
     * This allows simultaneous multi-tab testing (e.g. Donor in Tab 1, NGO in Tab 2).
     * @returns {Object|null}
     */
    getSession() {
      try {
        const ss = sessionStorage.getItem(SESSION_KEY);
        if (ss) return JSON.parse(ss);
        const ls = localStorage.getItem(SESSION_KEY);
        if (ls) return JSON.parse(ls);
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
      sessionStorage.setItem(SESSION_KEY, payload);
      if (remember) {
        localStorage.setItem(SESSION_KEY, payload);
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

    /**
     * Returns {user, ngo} for the currently logged-in NGO, or null.
     * @returns {{user: Object, ngo: Object}|null}
     */
    currentNgo() {
      const session = this.getSession();
      if (!session) return null;

      const user = this.getById('ffg_users', session.user_id);
      if (!user) return null;

      const ngo = this.findBy('ffg_ngos', 'user_id', user.user_id);
      if (!ngo) return null;

      return { user, ngo };
    },

    /* ── admin & audit logging ──────────────────────────────────── */

    /**
     * Logs an admin action in ffg_activity_log.
     * @param {*} adminId
     * @param {string} action
     * @param {string} targetType
     * @param {*} targetId
     * @param {*} details
     * @returns {Object}
     */
    logAction(adminId, action, targetType, targetId, details) {
      return this.insert('ffg_activity_log', {
        admin_id:    adminId || (this.getSession() ? this.getSession().user_id : 'system'),
        action:      action || 'UNKNOWN',
        target_type: targetType || '',
        target_id:   targetId || null,
        details:     typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
      });
    },

    /**
     * Retrieves platform settings.
     * @returns {Object}
     */
    getSettings() {
      try {
        const s = localStorage.getItem('ffg_settings');
        if (s) return JSON.parse(s);
      } catch (_) {}
      return { default_expiry_hours: 6, allow_unverified_donors: true };
    },

    /**
     * Saves platform settings.
     * @param {Object} settings
     * @returns {Object}
     */
    saveSettings(settings) {
      const current = this.getSettings();
      const updated = Object.assign({}, current, settings);
      localStorage.setItem('ffg_settings', JSON.stringify(updated));
      return updated;
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
      const demoPwHash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'; // password123

      // Seed a default demo donor for quick testing if not present
      let demoDonorUser = this.findBy('ffg_users', 'email', 'donor@demo.com');
      let demoDonor = null;
      if (!demoDonorUser) {
        demoDonorUser = this.insert('ffg_users', {
          full_name:     'Ramesh Sharma',
          email:         'donor@demo.com',
          phone:         '9876543210',
          password_hash: demoPwHash,
          role:          'donor',
          status:        'active',
        });
        demoDonor = this.insert('ffg_donors', {
          user_id:    demoDonorUser.user_id,
          donor_type: 'restaurant',
          org_name:   'The Good Spoon Restaurant',
          address:    'Plot 42, Knowledge Park',
          city:       'Greater Noida',
          pincode:    '201310',
          fssai_no:   '10019011000123',
        });
      } else {
        demoDonor = this.findBy('ffg_donors', 'user_id', demoDonorUser.user_id);
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

      const demoNgos = [
        {
          full_name:           'Amit Verma',
          email:               'rotibank@demo.com',
          phone:               '9000000001',
          ngo_name:            'Roti Bank Ghaziabad',
          reg_number:          'NGO-GZB-2021-001',
          contact_name:        'Amit Verma',
          designation:         'Coordinator',
          address:             'Shop 12, RDC Raj Nagar',
          city:                'Ghaziabad',
          pincode:             '201001',
          people_served:       350,
          pickup_capability:   'own_vehicle',
          certificate_file:    'rotibank_certificate.pdf',
          verification_status: 'verified',
        },
        {
          full_name:           'Pooja Sharma',
          email:               'hopeshelter@demo.com',
          phone:               '9000000002',
          ngo_name:            'Hope Shelter Noida',
          reg_number:          'NGO-NOI-2019-042',
          contact_name:        'Pooja Sharma',
          designation:         'Director',
          address:             'Sector 62, Near Metro Station',
          city:                'Noida',
          pincode:             '201309',
          people_served:       150,
          pickup_capability:   'needs_delivery',
          certificate_file:    'hope_shelter_reg.pdf',
          verification_status: 'verified',
        },
        {
          full_name:           'Rajesh Gupta',
          email:               'annapurna@demo.com',
          phone:               '9000000003',
          ngo_name:            'Annapurna Seva Delhi',
          reg_number:          'NGO-DEL-2018-108',
          contact_name:        'Rajesh Gupta',
          designation:         'Trustee',
          address:             'Chandni Chowk, Central Delhi',
          city:                'Delhi',
          pincode:             '110006',
          people_served:       500,
          pickup_capability:   'own_vehicle',
          certificate_file:    'annapurna_trust.pdf',
          verification_status: 'verified',
        },
        {
          full_name:           'Suresh Kumar',
          email:               'pendingngo@demo.com',
          phone:               '9000000004',
          ngo_name:            'Jan Seva Trust Meerut',
          reg_number:          'NGO-MRT-2023-550',
          contact_name:        'Suresh Kumar',
          designation:         'Manager',
          address:             'Civil Lines, Meerut Cantt',
          city:                'Meerut',
          pincode:             '250001',
          people_served:       100,
          pickup_capability:   'own_vehicle',
          certificate_file:    'janseva_trust.pdf',
          verification_status: 'pending',
        },
      ];

      demoNgos.forEach(data => {
        let user = this.findBy('ffg_users', 'email', data.email);
        if (!user) {
          user = this.insert('ffg_users', {
            full_name:     data.full_name,
            email:         data.email,
            phone:         data.phone,
            password_hash: demoPwHash,
            role:          'ngo',
            status:        data.verification_status === 'verified' ? 'active' : 'pending',
          });
        } else if (user.password_hash !== demoPwHash) {
          this.update('ffg_users', user.user_id, { password_hash: demoPwHash });
        }

        let ngo = this.findBy('ffg_ngos', 'user_id', user.user_id);
        if (!ngo) {
          this.insert('ffg_ngos', {
            user_id:             user.user_id,
            ngo_name:            data.ngo_name,
            reg_number:          data.reg_number,
            contact_name:        data.contact_name,
            designation:         data.designation,
            address:             data.address,
            city:                data.city,
            pincode:             data.pincode,
            people_served:       data.people_served,
            pickup_capability:   data.pickup_capability,
            certificate_file:    data.certificate_file,
            verification_status: data.verification_status,
          });
        } else {
          // Backfill any missing fields on existing demo records
          const patch = {};
          if (!ngo.reg_number) patch.reg_number = data.reg_number;
          if (!ngo.contact_name) patch.contact_name = data.contact_name;
          if (!ngo.designation) patch.designation = data.designation;
          if (!ngo.address) patch.address = data.address;
          if (!ngo.pincode) patch.pincode = data.pincode;
          if (!ngo.certificate_file) patch.certificate_file = data.certificate_file;
          if (ngo.pickup_capability === 'need_delivery') patch.pickup_capability = 'needs_delivery';
          if (Object.keys(patch).length > 0) {
            this.update('ffg_ngos', ngo.ngo_id, patch);
          }
        }
      });

      // Seed a few active surplus food listings if none exist so NGOs have food to browse immediately
      const existingListings = this.getAll('ffg_listings');
      const activeCount = existingListings.filter(l => l.status === 'available' || l.status === 'requested').length;
      if (activeCount === 0 && demoDonor) {
        const now = Date.now();
        const sampleListings = [
          {
            donor_id:       demoDonor.donor_id,
            food_name:      'Dal Makhani & Steamed Rice',
            food_type:      'veg',
            quantity:       40,
            unit:           'meals',
            prepared_at:    new Date(now - 1.5 * 3600 * 1000).toISOString(),
            expires_at:     new Date(now + 2.5 * 3600 * 1000).toISOString(), // ~2.5 hrs remaining (expiring soon)
            pickup_address: 'Plot 42, Knowledge Park, Greater Noida',
            notes:          'Packed in hygienic foil containers. Needs immediate distribution.',
            status:         'available',
          },
          {
            donor_id:       demoDonor.donor_id,
            food_name:      'Paneer Tikka & Tawa Roti',
            food_type:      'veg',
            quantity:       25,
            unit:           'meals',
            prepared_at:    new Date(now - 1 * 3600 * 1000).toISOString(),
            expires_at:     new Date(now + 4 * 3600 * 1000).toISOString(),
            pickup_address: 'Shop 8, RDC Raj Nagar, Ghaziabad',
            notes:          'Freshly prepared surplus from corporate lunch event.',
            status:         'available',
          },
          {
            donor_id:       demoDonor.donor_id,
            food_name:      'Chicken Biryani with Salan',
            food_type:      'non-veg',
            quantity:       30,
            unit:           'meals',
            prepared_at:    new Date(now - 2 * 3600 * 1000).toISOString(),
            expires_at:     new Date(now + 3.5 * 3600 * 1000).toISOString(),
            pickup_address: 'Connaught Place, Central Delhi',
            notes:          'Spicy chicken biryani, safely packed in 1-meal boxes.',
            status:         'available',
          },
          {
            donor_id:       demoDonor.donor_id,
            food_name:      'Assorted Bread & Bakery Rolls',
            food_type:      'veg',
            quantity:       15,
            unit:           'kg',
            prepared_at:    new Date(now - 3 * 3600 * 1000).toISOString(),
            expires_at:     new Date(now + 6 * 3600 * 1000).toISOString(),
            pickup_address: 'Sector 18, Commercial Belt, Noida',
            notes:          'Whole wheat and multigrain bread loaves and rolls.',
            status:         'available',
          },
        ];

        sampleListings.forEach(item => this.insert('ffg_listings', item));
      }

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

    /**
     * Seeds comprehensive admin demo data (historical listings, distributions,
     * pending/rejected organizations, and activity logs across 30 days).
     */
    seedAdminDemoData() {
      if (localStorage.getItem('ffg_seeded_admin') === '1') return;

      const demoPwHash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'; // password123
      const now = Date.now();
      const DAY = 24 * 3600 * 1000;
      const HOUR = 3600 * 1000;

      // 1. Extra pending NGO
      let pendingNgoUser = this.findBy('ffg_users', 'email', 'samarpan@demo.com');
      if (!pendingNgoUser) {
        pendingNgoUser = this.insert('ffg_users', {
          full_name:     'Anita Saxena',
          email:         'samarpan@demo.com',
          phone:         '9811223344',
          password_hash: demoPwHash,
          role:          'ngo',
          status:        'pending',
          created_at:    new Date(now - 3 * DAY).toISOString(),
        });
        this.insert('ffg_ngos', {
          user_id:             pendingNgoUser.user_id,
          ngo_name:            'Samarpan Seva Sanstha',
          reg_number:          'NGO-GZB-2023-789',
          contact_name:        'Anita Saxena',
          designation:         'Secretary',
          address:             '14 Nehru Nagar, Sector 2',
          city:                'Ghaziabad',
          pincode:             '201001',
          people_served:       220,
          pickup_capability:   'own_vehicle',
          certificate_file:    'samarpan_sanstha.pdf',
          verification_status: 'pending',
          created_at:          new Date(now - 3 * DAY).toISOString(),
        });
      }

      // 2. A rejected NGO for testing reviewed tab
      let rejectedNgoUser = this.findBy('ffg_users', 'email', 'fakerelief@demo.com');
      if (!rejectedNgoUser) {
        rejectedNgoUser = this.insert('ffg_users', {
          full_name:     'Vikram Singh',
          email:         'fakerelief@demo.com',
          phone:         '9822334455',
          password_hash: demoPwHash,
          role:          'ngo',
          status:        'rejected',
          created_at:    new Date(now - 12 * DAY).toISOString(),
        });
        this.insert('ffg_ngos', {
          user_id:             rejectedNgoUser.user_id,
          ngo_name:            'Global Care Alliance',
          reg_number:          'NGO-DEL-INVALID-00',
          contact_name:        'Vikram Singh',
          designation:         'Founder',
          address:             'Block B, Pitampura',
          city:                'Delhi',
          pincode:             '110034',
          people_served:       50,
          pickup_capability:   'needs_delivery',
          certificate_file:    'unclear_scan.jpg',
          verification_status: 'rejected',
          created_at:          new Date(now - 12 * DAY).toISOString(),
        });
      }

      // 3. A pending donor account for testing donor verification
      let pendingDonorUser = this.findBy('ffg_users', 'email', 'royalfeast@demo.com');
      if (!pendingDonorUser) {
        pendingDonorUser = this.insert('ffg_users', {
          full_name:     'Rajiv Malhotra',
          email:         'royalfeast@demo.com',
          phone:         '9833445566',
          password_hash: demoPwHash,
          role:          'donor',
          status:        'pending',
          created_at:    new Date(now - 2 * DAY).toISOString(),
        });
        this.insert('ffg_donors', {
          user_id:    pendingDonorUser.user_id,
          donor_type: 'caterer',
          org_name:   'The Royal Feast Caterers',
          address:    'Plot 18, Sector 132',
          city:       'Noida',
          pincode:    '201304',
          fssai_no:   '10022011000987',
          created_at: new Date(now - 2 * DAY).toISOString(),
        });
      }

      // Check existing listings count
      const existing = this.getAll('ffg_listings');
      if (existing.length < 5) {
        const demoDonor = this.findBy('ffg_donors', 'donor_type', 'restaurant') || this.getAll('ffg_donors')[0];
        const allNgos = this.getAll('ffg_ngos').filter(n => n.verification_status === 'verified');
        const donorId = demoDonor ? demoDonor.donor_id : 1;

        // Sample historical listings across 30 days
        const historical = [
          {
            daysAgo: 28, name: 'North Indian Buffet Surplus', type: 'veg', qty: 75, unit: 'meals',
            status: 'distributed', city: 'Greater Noida', people: 110, loc: 'Pari Chowk Shelter, Greater Noida'
          },
          {
            daysAgo: 25, name: 'Vegetable Pulao & Raita', type: 'veg', qty: 60, unit: 'meals',
            status: 'distributed', city: 'Ghaziabad', people: 90, loc: 'Old Railway Station Slum, Ghaziabad'
          },
          {
            daysAgo: 22, name: 'Paneer Butter Masala & Naan', type: 'veg', qty: 45, unit: 'meals',
            status: 'distributed', city: 'Noida', people: 65, loc: 'Sector 62 Labour Camp, Noida'
          },
          {
            daysAgo: 19, name: 'Egg Curry & Jeera Rice', type: 'non-veg', qty: 50, unit: 'meals',
            status: 'distributed', city: 'Delhi', people: 80, loc: 'Yamuna Pushta Night Shelter, Delhi'
          },
          {
            daysAgo: 16, name: 'Assorted Breads & Buns', type: 'veg', qty: 30, unit: 'kg',
            status: 'distributed', city: 'Noida', people: 120, loc: 'Sector 8 Community Center, Noida'
          },
          {
            daysAgo: 13, name: 'Rajma Chawal Combo', type: 'veg', qty: 85, unit: 'meals',
            status: 'distributed', city: 'Ghaziabad', people: 130, loc: 'Raj Nagar Extension Slum, Ghaziabad'
          },
          {
            daysAgo: 10, name: 'Mixed Veg Gravy & Rotis', type: 'veg', qty: 55, unit: 'meals',
            status: 'distributed', city: 'Delhi', people: 85, loc: 'Kashmere Gate Shelter, Delhi'
          },
          {
            daysAgo: 7, name: 'Moong Dal Khichdi & Pickle', type: 'veg', qty: 40, unit: 'meals',
            status: 'distributed', city: 'Greater Noida', people: 60, loc: 'Surajpur Orphanage, Greater Noida'
          },
          {
            daysAgo: 5, name: 'Chole Bhature Lunch Surplus', type: 'veg', qty: 35, unit: 'meals',
            status: 'collected', city: 'Noida', people: 0, loc: ''
          },
          {
            daysAgo: 4, name: 'Chicken Curry & Steamed Rice', type: 'non-veg', qty: 40, unit: 'meals',
            status: 'collected', city: 'Delhi', people: 0, loc: ''
          },
          {
            daysAgo: 3, name: 'Idli, Vada & Sambar Packets', type: 'veg', qty: 50, unit: 'meals',
            status: 'collected', city: 'Ghaziabad', people: 0, loc: ''
          },
          {
            daysAgo: 2, name: 'Kadai Paneer with Phulkas', type: 'veg', qty: 30, unit: 'meals',
            status: 'approved', city: 'Noida', people: 0, loc: ''
          },
          {
            daysAgo: 1, name: 'Yellow Dal Tadka & Rice', type: 'veg', qty: 25, unit: 'meals',
            status: 'approved', city: 'Greater Noida', people: 0, loc: ''
          },
          {
            daysAgo: 0.5, name: 'Mutton Biryani (Party Leftover)', type: 'non-veg', qty: 20, unit: 'meals',
            status: 'requested', city: 'Delhi', people: 0, loc: ''
          },
          {
            daysAgo: 0.3, name: 'Fresh Seasonal Fruit Boxes', type: 'veg', qty: 18, unit: 'kg',
            status: 'requested', city: 'Noida', people: 0, loc: ''
          },
          {
            daysAgo: 6, name: 'Boiled Sweet Corn & Snacks', type: 'veg', qty: 15, unit: 'kg',
            status: 'expired', city: 'Ghaziabad', people: 0, loc: ''
          },
          {
            daysAgo: 8, name: 'Sandwiches & Cutlets Tray', type: 'veg', qty: 25, unit: 'meals',
            status: 'expired', city: 'Delhi', people: 0, loc: ''
          },
          {
            daysAgo: 9, name: 'Duplicate Banquet Listing', type: 'veg', qty: 10, unit: 'meals',
            status: 'cancelled', city: 'Noida', people: 0, loc: ''
          },
        ];

        historical.forEach((item, idx) => {
          const itemCreatedAt = new Date(now - item.daysAgo * DAY).toISOString();
          const preparedAt = new Date(now - (item.daysAgo * DAY + 2 * HOUR)).toISOString();
          const expiresAt = new Date(now - (item.daysAgo * DAY - 5 * HOUR)).toISOString();
          const targetNgo = allNgos[idx % allNgos.length] || allNgos[0];

          const listing = this.insert('ffg_listings', {
            donor_id:       donorId,
            food_name:      item.name,
            food_type:      item.type,
            quantity:       item.qty,
            unit:           item.unit,
            prepared_at:    preparedAt,
            expires_at:     expiresAt,
            pickup_address: `Plot ${10 + idx}, Sector ${idx + 1}, ${item.city}`,
            notes:          'Safely preserved surplus food in hygienic containers.',
            status:         item.status,
            created_at:     itemCreatedAt,
          });

          // Create requests, handovers, distributions for active/completed stages
          if (['requested', 'approved', 'collected', 'distributed'].includes(item.status)) {
            const reqStatus = item.status === 'requested' ? 'pending' : 'approved';
            const request = this.insert('ffg_requests', {
              listing_id:    listing.listing_id,
              ngo_id:        targetNgo ? targetNgo.ngo_id : 1,
              requested_qty: item.qty,
              message:       `We can collect this surplus food immediately to distribute in ${item.city}.`,
              status:        reqStatus,
              requested_at:  new Date(new Date(itemCreatedAt).getTime() + 30 * 60000).toISOString(),
              responded_at:  reqStatus === 'approved' ? new Date(new Date(itemCreatedAt).getTime() + 60 * 60000).toISOString() : null,
              created_at:    new Date(new Date(itemCreatedAt).getTime() + 30 * 60000).toISOString(),
            });

            if (['approved', 'collected', 'distributed'].includes(item.status)) {
              const handoverStatus = item.status === 'approved' ? 'scheduled' : 'collected';
              const pickupTime = new Date(new Date(itemCreatedAt).getTime() + 2 * HOUR).toISOString();
              const handover = this.insert('ffg_handovers', {
                request_id:    request.request_id,
                pickup_time:   pickupTime,
                pickup_person: targetNgo ? targetNgo.contact_name : 'Staff Driver',
                collected_at:  handoverStatus === 'collected' ? pickupTime : null,
                status:        handoverStatus,
                created_at:    new Date(new Date(itemCreatedAt).getTime() + 75 * 60000).toISOString(),
              });

              if (item.status === 'distributed') {
                const distTime = new Date(new Date(itemCreatedAt).getTime() + 3.5 * HOUR).toISOString();
                this.insert('ffg_distributions', {
                  handover_id:    handover.handover_id,
                  distributed_at: distTime,
                  location:       item.loc,
                  people_served:  item.people,
                  remarks:        'Smooth distribution; food quality checked and appreciated by recipients.',
                  created_at:     distTime,
                });
              }
            }
          }
        });
      }

      // 4. Seed activity log entries
      const existingLogs = this.getAll('ffg_activity_log');
      if (existingLogs.length === 0) {
        const adminUser = this.findBy('ffg_users', 'role', 'admin');
        const adminId = adminUser ? adminUser.user_id : 'admin';

        const sampleLogs = [
          { action: 'PLATFORM_INIT', targetType: 'system', targetId: 'sys-0', details: 'Food For Good prototype initialized with base demo dataset.', daysAgo: 30 },
          { action: 'VERIFIED_NGO', targetType: 'ngo', targetId: 'ngo-1', details: 'Approved registration and documents for Roti Bank Ghaziabad.', daysAgo: 24 },
          { action: 'VERIFIED_NGO', targetType: 'ngo', targetId: 'ngo-2', details: 'Verified registration credentials for Hope Shelter Noida.', daysAgo: 20 },
          { action: 'VERIFIED_NGO', targetType: 'ngo', targetId: 'ngo-3', details: 'Approved Annapurna Seva Delhi trust certification.', daysAgo: 18 },
          { action: 'REJECTED_NGO', targetType: 'ngo', targetId: 'ngo-rej', details: 'Rejected Global Care Alliance: unverified NGO registration certificate.', daysAgo: 12 },
          { action: 'SETTINGS_UPDATE', targetType: 'settings', targetId: 'expiry', details: 'Default expiry window set to 6 hours for food hygiene compliance.', daysAgo: 10 },
          { action: 'VERIFIED_DONOR', targetType: 'donor', targetId: 'donor-1', details: 'Approved Ramesh Sharma (The Good Spoon Restaurant) FSSAI certificate.', daysAgo: 8 },
        ];

        sampleLogs.forEach(lg => {
          this.insert('ffg_activity_log', {
            admin_id:    adminId,
            action:      lg.action,
            target_type: lg.targetType,
            target_id:   lg.targetId,
            details:     lg.details,
            created_at:  new Date(now - lg.daysAgo * DAY).toISOString(),
          });
        });
      }

      localStorage.setItem('ffg_seeded_admin', '1');
    },
  };

  /* ─────────────────── expose globally ───────────────────────── */
  window.FFGStore = FFGStore;

  /* ─────────────────── boot ───────────────────────────────────── */
  FFGStore.seedDemoData();
  FFGStore.seedAdminDemoData();

})();
