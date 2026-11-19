// js/ngo-dashboard.js — NGO Dashboard logic for Food For Good

document.addEventListener('DOMContentLoaded', () => {

    // ═══════════════════════════════════════════════
    //  1. PAGE GUARD & INITIALIZATION
    // ═══════════════════════════════════════════════
    const session = FFGStore.getSession();
    if (!session || session.role !== 'ngo') {
        window.location.href = 'ngo-login.html';
        return;
    }

    const ngoData = FFGStore.currentNgo();
    if (!ngoData) {
        window.location.href = 'ngo-login.html';
        return;
    }

    let { user, ngo } = ngoData;

    if (user.status === 'blocked') {
        FFGStore.logout();
        return;
    }

    // Run expiration check on load and every 60s
    FFGStore.expireListings();
    setInterval(() => {
        FFGStore.expireListings();
        renderActiveSection();
    }, 60000);

    // Set navbar info
    document.getElementById('dash-user-name').textContent = ngo.ngo_name || user.full_name;
    document.getElementById('dash-logout-btn').addEventListener('click', () => FFGStore.logout());

    // Render verification banner
    renderVerificationBanner();

    // ═══════════════════════════════════════════════
    //  2. NAVIGATION & SECTION SWITCHING
    // ═══════════════════════════════════════════════
    const sections = ['overview', 'browse', 'requests', 'distributions', 'profile'];
    let currentSection = 'overview';

    function switchSection(name) {
        currentSection = name;
        sections.forEach(s => {
            const sec = document.getElementById('section-' + s);
            const btn = document.querySelector(`.dash-nav-btn[data-section="${s}"]`);
            if (sec) sec.style.display = (s === name ? '' : 'none');
            if (btn) btn.classList.toggle('active', s === name);
        });

        renderActiveSection();
    }

    function renderActiveSection() {
        if (currentSection === 'overview') renderOverview();
        else if (currentSection === 'browse') renderBrowse();
        else if (currentSection === 'requests') renderRequests();
        else if (currentSection === 'distributions') renderDistributions();
        else if (currentSection === 'profile') loadProfile();
    }

    document.querySelectorAll('.dash-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    // ═══════════════════════════════════════════════
    //  3. VERIFICATION BANNER & BADGE
    // ═══════════════════════════════════════════════
    function renderVerificationBanner() {
        const wrap = document.getElementById('verification-banner-wrap');
        const badge = document.getElementById('overview-status-badge');
        const vStatus = ngo.verification_status || 'pending';

        if (vStatus === 'pending') {
            wrap.innerHTML = `
                <div class="verification-banner banner-pending">
                    <span class="banner-icon">⏳</span>
                    <div>
                        <strong>Awaiting Verification:</strong> Your organization is awaiting admin verification. You can browse available surplus food, but you can send pickup requests only after verification.
                    </div>
                </div>
            `;
            if (badge) {
                badge.textContent = '⏳ Pending Verification';
                badge.className = 'status-badge status-requested';
            }
        } else if (vStatus === 'rejected') {
            // Check for rejection notes in logs if present
            wrap.innerHTML = `
                <div class="verification-banner banner-rejected">
                    <span class="banner-icon">✕</span>
                    <div>
                        <strong>Verification Rejected:</strong> Your organization verification was not approved by the administrator. Food requests are currently disabled. Please contact support.
                    </div>
                </div>
            `;
            if (badge) {
                badge.textContent = '✕ Verification Rejected';
                badge.className = 'status-badge status-cancelled';
            }
        } else {
            wrap.innerHTML = '';
            if (badge) {
                badge.textContent = '✓ Verified Organization';
                badge.className = 'status-badge status-available';
            }
        }
    }

    function isActionAllowed() {
        return ngo.verification_status === 'verified';
    }

    // ═══════════════════════════════════════════════
    //  4. OVERVIEW SECTION
    // ═══════════════════════════════════════════════
    function renderOverview() {
        FFGStore.expireListings();
        renderVerificationBanner();

        document.getElementById('dash-welcome').textContent = `Welcome back, ${ngo.ngo_name}!`;

        const allListings = FFGStore.getAll('ffg_listings');
        const myRequests = FFGStore.findAllBy('ffg_requests', 'ngo_id', ngo.ngo_id);

        // 1. Food near you (available in NGO city)
        const cityLower = (ngo.city || '').toLowerCase().trim();
        const availableInCity = allListings.filter(l => {
            if (l.status !== 'available' && l.status !== 'requested') return false;
            if (new Date(l.expires_at).getTime() <= Date.now()) return false;
            const donor = FFGStore.getById('ffg_donors', l.donor_id);
            const donorCity = donor ? (donor.city || '').toLowerCase().trim() : '';
            const pickupAddr = (l.pickup_address || '').toLowerCase();
            return (donorCity === cityLower) || (cityLower && pickupAddr.includes(cityLower));
        });
        document.getElementById('stat-food-near').textContent = availableInCity.length;

        // 2. Pending requests
        const pendingRequests = myRequests.filter(r => r.status === 'pending');
        document.getElementById('stat-pending-req').textContent = pendingRequests.length;

        // 3. Pickups scheduled
        const approvedReqIds = myRequests.filter(r => r.status === 'approved').map(r => String(r.request_id));
        const allHandovers = FFGStore.getAll('ffg_handovers');
        const myHandovers = allHandovers.filter(h => approvedReqIds.includes(String(h.request_id)));
        const scheduledCount = myHandovers.filter(h => h.status === 'scheduled').length;
        document.getElementById('stat-scheduled-pickups').textContent = scheduledCount;

        // 4. People served from distributions
        const myHandoverIds = myHandovers.map(h => String(h.handover_id));
        const allDistributions = FFGStore.getAll('ffg_distributions');
        const myDistributions = allDistributions.filter(d => myHandoverIds.includes(String(d.handover_id)));
        const peopleSum = myDistributions.reduce((acc, d) => acc + (parseInt(d.people_served, 10) || 0), 0);
        document.getElementById('stat-people-served').textContent = peopleSum;

        // Expiring Soon List (< 3 hours)
        renderExpiringSoon(availableInCity);

        // Recent Activity
        renderRecentActivity(myRequests, myHandovers, myDistributions);
    }

    function renderExpiringSoon(cityListings) {
        const container = document.getElementById('expiring-soon-container');
        const now = Date.now();
        const threeHours = 3 * 3600 * 1000;

        let expiring = cityListings.filter(l => {
            const exp = new Date(l.expires_at).getTime();
            return (exp > now) && ((exp - now) <= threeHours);
        });

        if (expiring.length === 0) {
            container.innerHTML = '<p class="empty-state">No food expiring within 3 hours in your city right now.</p>';
            return;
        }

        // Prioritize closest expiring food first
        expiring.sort((a, b) => getListingTransitInfo(a).distanceKm - getListingTransitInfo(b).distanceKm);
        const closestId = expiring[0].listing_id;

        container.innerHTML = expiring.map(l => buildListingCardHtml(l, true, l.listing_id === closestId)).join('');
        attachListingCardEvents(container);
    }

    function renderRecentActivity(myRequests, myHandovers, myDistributions) {
        const container = document.getElementById('recent-activity');
        const events = [];

        myRequests.forEach(r => {
            const l = FFGStore.getById('ffg_listings', r.listing_id);
            const foodName = l ? l.food_name : 'food item';
            events.push({
                time: new Date(r.requested_at),
                text: `Requested ${r.requested_qty} ${l ? l.unit : ''} of "${foodName}"`
            });
            if (r.responded_at) {
                events.push({
                    time: new Date(r.responded_at),
                    text: `Request for "${foodName}" was ${r.status}`
                });
            }
        });

        myHandovers.forEach(h => {
            const req = FFGStore.getById('ffg_requests', h.request_id);
            const l = req ? FFGStore.getById('ffg_listings', req.listing_id) : null;
            const foodName = l ? l.food_name : 'food';

            if (h.created_at) {
                events.push({
                    time: new Date(h.created_at),
                    text: `Pickup scheduled for "${foodName}" with ${h.pickup_person || 'driver'}`
                });
            }
            if (h.collected_at) {
                events.push({
                    time: new Date(h.collected_at),
                    text: `Handover collected: "${foodName}" is in your custody`
                });
            }
        });

        myDistributions.forEach(d => {
            const h = FFGStore.getById('ffg_handovers', d.handover_id);
            const req = h ? FFGStore.getById('ffg_requests', h.request_id) : null;
            const l = req ? FFGStore.getById('ffg_listings', req.listing_id) : null;
            const foodName = l ? l.food_name : 'food';
            events.push({
                time: new Date(d.distributed_at || d.created_at),
                text: `Distributed "${foodName}" at ${d.location} (${d.people_served} people served)`
            });
        });

        events.sort((a, b) => b.time - a.time);
        const topEvents = events.slice(0, 5);

        if (topEvents.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent activity found. Browse available food to request donations.</p>';
            return;
        }

        container.innerHTML = topEvents.map(e => `
            <div class="activity-item">
                <span class="activity-icon">🔔</span>
                <span class="activity-text" style="flex: 1;">${escapeHtml(e.text)}</span>
                <span class="activity-time">${formatRelativeTime(e.time)}</span>
            </div>
        `).join('');
    }

    // ═══════════════════════════════════════════════
    //  5. TRANSIT DISTANCE & PRIORITY ENGINE (GEO CALCULATOR)
    // ═══════════════════════════════════════════════
    const GEO_LOCALITIES = {
        'raj nagar': { lat: 28.6854, lng: 77.4422 },
        'rdc': { lat: 28.6750, lng: 77.4410 },
        'indirapuram': { lat: 28.6415, lng: 77.3714 },
        'vaishali': { lat: 28.6469, lng: 77.3392 },
        'ghaziabad': { lat: 28.6692, lng: 77.4538 },
        'muradnagar': { lat: 28.7844, lng: 77.5029 },
        'sector 62': { lat: 28.6270, lng: 77.3725 },
        'sector 18': { lat: 28.5708, lng: 77.3260 },
        'sector 132': { lat: 28.5080, lng: 77.3780 },
        'sector 15': { lat: 28.5835, lng: 77.3140 },
        'noida': { lat: 28.5355, lng: 77.3910 },
        'knowledge park': { lat: 28.4601, lng: 77.4940 },
        'pari chowk': { lat: 28.4682, lng: 77.5085 },
        'surajpur': { lat: 28.5200, lng: 77.4900 },
        'greater noida': { lat: 28.4744, lng: 77.5040 },
        'connaught place': { lat: 28.6315, lng: 77.2167 },
        'chandni chowk': { lat: 28.6506, lng: 77.2303 },
        'kashmere gate': { lat: 28.6675, lng: 77.2285 },
        'pitampura': { lat: 28.7032, lng: 77.1325 },
        'delhi': { lat: 28.6139, lng: 77.2090 },
        'civil lines': { lat: 28.9950, lng: 77.7120 },
        'cantt': { lat: 28.9800, lng: 77.7000 },
        'meerut': { lat: 28.9845, lng: 77.7064 }
    };

    function resolveCoords(address, city) {
        const text = ((address || '') + ' ' + (city || '')).toLowerCase();
        for (const [key, coords] of Object.entries(GEO_LOCALITIES)) {
            if (text.includes(key)) return coords;
        }
        const c = (city || '').toLowerCase();
        if (c.includes('noida') && c.includes('greater')) return GEO_LOCALITIES['greater noida'];
        if (c.includes('noida')) return GEO_LOCALITIES['noida'];
        if (c.includes('ghaziabad')) return GEO_LOCALITIES['ghaziabad'];
        if (c.includes('delhi')) return GEO_LOCALITIES['delhi'];
        if (c.includes('meerut')) return GEO_LOCALITIES['meerut'];
        return { lat: 28.6692, lng: 77.4538 }; // Default NCR center
    }

    function calculateDistanceAndDuration(fromAddr, fromCity, toAddr, toCity) {
        const c1 = resolveCoords(fromAddr, fromCity);
        const c2 = resolveCoords(toAddr, toCity);

        const R = 6371; // Earth radius in km
        const dLat = (c2.lat - c1.lat) * Math.PI / 180;
        const dLng = (c2.lng - c1.lng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straight = R * c;

        // Urban road detour multiplier (1.35x realistic driving path)
        const factor = straight < 1.5 ? 1.15 : 1.35;
        let km = straight * factor;
        if (km < 0.6) km = 0.8;
        km = Math.round(km * 10) / 10;

        // Estimated transit speed ~25 km/h in NCR city traffic + 2 min dispatch buffer
        const mins = Math.max(3, Math.round((km / 25) * 60) + 2);

        return {
            distanceKm: km,
            durationMins: mins,
            formattedDistance: `${km} km`,
            formattedDuration: mins < 60 ? `${mins} mins` : `${Math.floor(mins / 60)}h ${mins % 60}m`
        };
    }

    function getListingTransitInfo(listing) {
        const donor = FFGStore.getById('ffg_donors', listing.donor_id);
        const donorAddr = listing.pickup_address || (donor ? donor.address : '');
        const donorCity = donor ? donor.city : '';
        const ngoAddr = ngo ? (ngo.address || '') : '';
        const ngoCity = ngo ? (ngo.city || '') : '';

        return calculateDistanceAndDuration(ngoAddr, ngoCity, donorAddr, donorCity);
    }

    // ═══════════════════════════════════════════════
    //  6. BROWSE FOOD SECTION
    // ═══════════════════════════════════════════════
    function renderBrowse() {
        FFGStore.expireListings();
        populateCityFilter();
        applyBrowseFilters();
    }

    function populateCityFilter() {
        const citySelect = document.getElementById('browse-city');
        const curVal = citySelect.value;

        const allListings = FFGStore.getAll('ffg_listings');
        const activeListings = allListings.filter(l =>
            (l.status === 'available' || l.status === 'requested') &&
            new Date(l.expires_at).getTime() > Date.now()
        );

        const cities = new Set();
        if (ngo.city) cities.add(ngo.city);

        activeListings.forEach(l => {
            // Add donor's registered city
            const donor = FFGStore.getById('ffg_donors', l.donor_id);
            if (donor && donor.city) cities.add(donor.city);

            // Also extract city from pickup_address if it contains a known city name
            // This ensures listings with pickup addresses in different cities are discoverable
            if (l.pickup_address) {
                const addrLower = l.pickup_address.toLowerCase();
                const knownCities = ['ghaziabad', 'noida', 'greater noida', 'delhi', 'meerut', 'indirapuram', 'vaishali'];
                knownCities.forEach(kc => {
                    if (addrLower.includes(kc)) {
                        // Capitalise properly for display
                        const displayCity = kc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        cities.add(displayCity);
                    }
                });
            }
        });

        let opts = `<option value="all">All Cities</option>`;
        cities.forEach(c => {
            const isSelected = (curVal === c) || (!curVal && c.toLowerCase() === (ngo.city || '').toLowerCase());
            opts += `<option value="${escapeHtml(c)}"${isSelected ? ' selected' : ''}>${escapeHtml(c)}${c.toLowerCase() === (ngo.city || '').toLowerCase() ? ' (Your City)' : ''}</option>`;
        });

        citySelect.innerHTML = opts;
    }

    function applyBrowseFilters() {
        const allListings = FFGStore.getAll('ffg_listings');
        const now = Date.now();

        // Only available or requested listings not yet expired
        let items = allListings.filter(l =>
            (l.status === 'available' || l.status === 'requested') &&
            new Date(l.expires_at).getTime() > now
        );

        // Filter: City
        const cityFilter = document.getElementById('browse-city').value;
        if (cityFilter && cityFilter !== 'all') {
            const cLower = cityFilter.toLowerCase().trim();
            items = items.filter(l => {
                const donor = FFGStore.getById('ffg_donors', l.donor_id);
                const donorCity = donor ? (donor.city || '').toLowerCase().trim() : '';
                const addr = (l.pickup_address || '').toLowerCase();
                // Match if donor city contains filter word OR address contains filter word
                return donorCity.includes(cLower) || cLower.includes(donorCity) ||
                       addr.includes(cLower);
            });
        }

        // Filter: Food Type
        const typeFilter = document.getElementById('browse-type').value;
        if (typeFilter && typeFilter !== 'all') {
            items = items.filter(l => l.food_type === typeFilter);
        }

        // Filter: Expiring Within
        const expiryFilter = document.getElementById('browse-expiry').value;
        if (expiryFilter && expiryFilter !== 'all') {
            const hours = parseFloat(expiryFilter);
            const maxMs = hours * 3600 * 1000;
            items = items.filter(l => {
                const diff = new Date(l.expires_at).getTime() - now;
                return diff <= maxMs;
            });
        }

        // Filter: Search
        const searchVal = document.getElementById('browse-search').value.toLowerCase().trim();
        if (searchVal) {
            items = items.filter(l => {
                const donor = FFGStore.getById('ffg_donors', l.donor_id);
                const donorName = donor ? (donor.org_name || '').toLowerCase() : '';
                const foodName = (l.food_name || '').toLowerCase();
                return foodName.includes(searchVal) || donorName.includes(searchVal);
            });
        }

        // Sort
        const sortVal = document.getElementById('browse-sort').value;
        if (sortVal === 'nearest') {
            items.sort((a, b) => getListingTransitInfo(a).distanceKm - getListingTransitInfo(b).distanceKm);
        } else if (sortVal === 'expiring_soonest') {
            items.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
        } else if (sortVal === 'newest') {
            items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sortVal === 'largest_qty') {
            items.sort((a, b) => parseFloat(b.quantity) - parseFloat(a.quantity));
        }

        // Identify closest listing id
        let closestId = null;
        let minDistance = Infinity;
        items.forEach(l => {
            const dist = getListingTransitInfo(l).distanceKm;
            if (dist < minDistance) {
                minDistance = dist;
                closestId = l.listing_id;
            }
        });

        const grid = document.getElementById('browse-grid');
        const empty = document.getElementById('browse-empty');

        if (items.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        grid.innerHTML = items.map(l => buildListingCardHtml(l, false, l.listing_id === closestId)).join('');
        attachListingCardEvents(grid);
    }

    // Attach filter event listeners
    ['browse-city', 'browse-type', 'browse-expiry', 'browse-sort'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyBrowseFilters);
    });
    const searchEl = document.getElementById('browse-search');
    if (searchEl) searchEl.addEventListener('input', applyBrowseFilters);

    function buildListingCardHtml(l, isCompact, isNearest = false) {
        const donor = FFGStore.getById('ffg_donors', l.donor_id);
        const donorName = donor ? (donor.org_name || 'Food Donor') : 'Food Donor';
        const donorType = donor ? formatDonorType(donor.donor_type) : 'Provider';
        const city = donor ? (donor.city || '') : '';

        const typeIcon = l.food_type === 'veg' ? '🥦' : l.food_type === 'non-veg' ? '🍗' : '🍱';
        const typeLabel = l.food_type === 'veg' ? 'Veg' : l.food_type === 'non-veg' ? 'Non-veg' : 'Mixed';

        const expMs = new Date(l.expires_at).getTime() - Date.now();
        const isUrgent = expMs < 3600 * 1000;
        const countdownText = formatCountdown(expMs);

        // Transit Distance and Driving Route
        const transit = getListingTransitInfo(l);
        const ngoFullAddr = `${ngo ? ngo.address : ''}, ${ngo ? ngo.city : ''}`;
        const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ngoFullAddr)}&destination=${encodeURIComponent(l.pickup_address || city)}`;

        const transitHtml = `
            <div class="distance-badge-row">
                <div class="distance-pill ${isNearest ? 'distance-pill-nearest' : ''}" title="Estimated driving distance from your NGO">
                    <span class="distance-icon">🚗</span>
                    <strong>${transit.formattedDistance}</strong> away
                    <span class="distance-time">· ~${transit.formattedDuration}</span>
                </div>
                ${isNearest ? '<span class="nearest-chip">⚡ Nearest to you</span>' : ''}
                <a href="${mapUrl}" target="_blank" rel="noopener" class="route-link" title="Open driving directions in Google Maps">
                    🗺️ Directions
                </a>
            </div>
        `;

        // Check if current NGO already has a pending or approved request
        const existingReq = FFGStore.findAllBy('ffg_requests', 'listing_id', l.listing_id)
            .find(r => String(r.ngo_id) === String(ngo.ngo_id) && (r.status === 'pending' || r.status === 'approved'));

        const verified = isActionAllowed();

        let actionArea = '';
        if (existingReq) {
            actionArea = `
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:12px;">
                    <span class="card-badge-requested">✓ Already requested (${existingReq.status})</span>
                    <button class="btn-sm" disabled style="opacity:0.6;cursor:not-allowed;">Requested</button>
                </div>
            `;
        } else if (!verified) {
            actionArea = `
                <div style="margin-top:12px;">
                    <button class="btn-sm" disabled style="width:100%;opacity:0.6;cursor:not-allowed;" title="Requires admin verification">
                        Request Food (Verification Required)
                    </button>
                </div>
            `;
        } else {
            actionArea = `
                <div style="margin-top:12px;">
                    <button class="btn-sm btn-primary action-request-btn" data-id="${l.listing_id}" style="width:100%;">
                        Request this Food →
                    </button>
                </div>
            `;
        }

        return `
            <div class="listing-card" id="card-listing-${l.listing_id}">
                <div class="listing-header">
                    <span class="listing-type-badge">${typeIcon} ${typeLabel}</span>
                    <span class="status-badge status-${l.status}">${l.status}</span>
                </div>
                <h3 class="listing-title">${escapeHtml(l.food_name)}</h3>
                <div class="listing-quantity">${l.quantity} ${l.unit}</div>
                <div class="listing-meta">
                    <strong>${escapeHtml(donorName)}</strong> (${escapeHtml(donorType)})${city ? ` · 📍 ${escapeHtml(city)}` : ''}
                </div>
                <div class="listing-meta" style="font-size:12px;color:#64736d;">
                    Pickup: ${escapeHtml(l.pickup_address)}
                </div>
                ${transitHtml}
                <div class="listing-countdown ${isUrgent ? 'countdown-urgent' : ''}">
                    ⏱ Safe for ${countdownText}
                </div>
                ${l.notes ? `<div style="font-size:12px;color:#64736d;font-style:italic;margin-top:6px;">"${escapeHtml(l.notes)}"</div>` : ''}
                ${actionArea}
            </div>
        `;
    }

    function attachListingCardEvents(container) {
        container.querySelectorAll('.action-request-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const listingId = btn.dataset.id;
                openRequestModal(listingId);
            });
        });
    }

    // ═══════════════════════════════════════════════
    //  6. REQUEST FOOD MODAL
    // ═══════════════════════════════════════════════
    const requestModal = document.getElementById('request-modal');
    const reqForm = document.getElementById('request-food-form');
    const reqError = document.getElementById('req-error');
    const reqMessage = document.getElementById('req-message');
    const reqCharCount = document.getElementById('req-char-count');

    reqMessage.addEventListener('input', () => {
        reqCharCount.textContent = reqMessage.value.length;
    });

    document.getElementById('req-cancel-btn').addEventListener('click', () => {
        requestModal.style.display = 'none';
    });

    function openRequestModal(listingId) {
        if (!isActionAllowed()) {
            showInfoModal('Your organization is awaiting admin verification before you can request food.');
            return;
        }

        const l = FFGStore.getById('ffg_listings', listingId);
        if (!l) return;

        const donor = FFGStore.getById('ffg_donors', l.donor_id);
        const donorName = donor ? (donor.org_name || 'Food Donor') : 'Food Donor';

        document.getElementById('req-listing-id').value = l.listing_id;
        document.getElementById('req-food-name').textContent = l.food_name;
        document.getElementById('req-max-qty').textContent = `${l.quantity} ${l.unit}`;
        document.getElementById('req-donor-info').textContent = `${donorName} (${donor ? donor.city : ''})`;

        // Populate distance, transit time & Google Maps route in request modal
        const transit = getListingTransitInfo(l);
        const distEl = document.getElementById('req-distance-info');
        if (distEl) {
            distEl.textContent = `${transit.formattedDistance} · ~${transit.formattedDuration} driving`;
        }
        const routeLink = document.getElementById('req-route-link');
        if (routeLink) {
            const ngoFullAddr = `${ngo ? ngo.address : ''}, ${ngo ? ngo.city : ''}`;
            routeLink.href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ngoFullAddr)}&destination=${encodeURIComponent(l.pickup_address || (donor ? donor.city : ''))}`;
        }

        const qtyInput = document.getElementById('req-qty');
        qtyInput.value = l.quantity;
        qtyInput.max = l.quantity;
        qtyInput.min = 0.5;
        qtyInput.step = 0.5;

        reqMessage.value = '';
        reqCharCount.textContent = '0';
        reqError.style.display = 'none';

        requestModal.style.display = 'flex';
    }

    reqForm.addEventListener('submit', (e) => {
        e.preventDefault();
        reqError.style.display = 'none';

        const listingId = document.getElementById('req-listing-id').value;
        const l = FFGStore.getById('ffg_listings', listingId);
        if (!l) {
            reqError.textContent = 'Listing not found or has expired.';
            reqError.style.display = 'block';
            return;
        }

        // Duplicate check
        const existing = FFGStore.findAllBy('ffg_requests', 'listing_id', listingId)
            .find(r => String(r.ngo_id) === String(ngo.ngo_id) && r.status === 'pending');
        if (existing) {
            reqError.textContent = 'You have already requested this food donation.';
            reqError.style.display = 'block';
            return;
        }

        const reqQty = parseFloat(document.getElementById('req-qty').value);
        if (isNaN(reqQty) || reqQty <= 0 || reqQty > parseFloat(l.quantity)) {
            reqError.textContent = `Please enter a quantity between 0.5 and ${l.quantity}.`;
            reqError.style.display = 'block';
            return;
        }

        const message = reqMessage.value.trim();
        if (message.length > 200) {
            reqError.textContent = 'Message cannot exceed 200 characters.';
            reqError.style.display = 'block';
            return;
        }

        // Insert request
        FFGStore.insert('ffg_requests', {
            listing_id:    l.listing_id,
            ngo_id:        ngo.ngo_id,
            requested_qty: reqQty,
            message:       message,
            status:        'pending',
            requested_at:  new Date().toISOString(),
            responded_at:  null,
        });

        // Update listing status if currently available
        if (l.status === 'available') {
            FFGStore.update('ffg_listings', l.listing_id, { status: 'requested' });
        }

        requestModal.style.display = 'none';
        showToast('Food request sent to donor successfully!');
        renderBrowse();
        renderOverview();
    });

    // ═══════════════════════════════════════════════
    //  7. MY REQUESTS SECTION
    // ═══════════════════════════════════════════════
    let currentReqTab = 'pending';

    document.querySelectorAll('#requests-filter-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#requests-filter-chips .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentReqTab = chip.dataset.tab;
            renderRequests();
        });
    });

    function renderRequests() {
        FFGStore.expireListings();
        const allRequests = FFGStore.findAllBy('ffg_requests', 'ngo_id', ngo.ngo_id);

        const pending = allRequests.filter(r => r.status === 'pending');
        const approved = allRequests.filter(r => r.status === 'approved');
        const completed = allRequests.filter(r => {
            if (r.status !== 'approved') return false;
            const l = FFGStore.getById('ffg_listings', r.listing_id);
            return l && (l.status === 'collected' || l.status === 'distributed');
        });
        const rejected = allRequests.filter(r => r.status === 'rejected' || r.status === 'cancelled');

        document.getElementById('count-pending').textContent = pending.length;
        document.getElementById('count-approved').textContent = approved.length;
        document.getElementById('count-completed').textContent = completed.length;
        document.getElementById('count-rejected').textContent = rejected.length;

        let activeList = [];
        if (currentReqTab === 'pending') activeList = pending;
        else if (currentReqTab === 'approved') activeList = approved;
        else if (currentReqTab === 'completed') activeList = completed;
        else if (currentReqTab === 'rejected') activeList = rejected;

        // Sort newest first
        activeList.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

        const grid = document.getElementById('requests-grid');
        const empty = document.getElementById('requests-empty');

        if (activeList.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        grid.innerHTML = activeList.map(r => buildRequestCardHtml(r, currentReqTab)).join('');
        attachRequestEvents(grid);
    }

    function buildRequestCardHtml(r, tab) {
        const l = FFGStore.getById('ffg_listings', r.listing_id);
        const donor = l ? FFGStore.getById('ffg_donors', l.donor_id) : null;
        const donorUser = donor ? FFGStore.getById('ffg_users', donor.user_id) : null;
        const donorName = donor ? (donor.org_name || 'Food Donor') : 'Food Donor';
        const donorPhone = donorUser ? donorUser.phone : 'Contact Donor';

        // Check handover
        const handover = FFGStore.findBy('ffg_handovers', 'request_id', r.request_id);

        let actionArea = '';

        if (tab === 'pending') {
            actionArea = `
                <div class="request-actions">
                    <button class="btn-sm btn-danger action-cancel-req" data-id="${r.request_id}" data-listing="${r.listing_id}">
                        Cancel Request
                    </button>
                </div>
            `;
        } else if (tab === 'approved') {
            if (!handover || handover.status === 'pending') {
                actionArea = `
                    <div class="request-actions">
                        <button class="btn-sm btn-primary action-schedule-btn" data-id="${r.request_id}">
                            🗓 Schedule Pickup
                        </button>
                    </div>
                `;
            } else if (handover.status === 'scheduled') {
                actionArea = `
                    <div style="background:#f0f7ee;border:1px solid #dfe3da;border-radius:12px;padding:12px;margin-top:10px;font-size:13px;">
                        <div><strong>🚚 Scheduled Pickup:</strong> ${formatDateTime(handover.pickup_time)}</div>
                        <div style="margin-top:3px;"><strong>Driver/Person:</strong> ${escapeHtml(handover.pickup_person || 'Assigned Driver')}</div>
                        <div style="margin-top:3px;"><strong>Donor Phone:</strong> <a href="tel:${donorPhone}" style="color:#174c42;font-weight:700;">${donorPhone}</a></div>
                        <div style="margin-top:3px;"><strong>Pickup Address:</strong> ${escapeHtml(l ? l.pickup_address : 'Address on file')}</div>
                    </div>
                    <div class="request-actions" style="margin-top:10px;">
                        <button class="btn-sm btn-primary action-collect-btn" data-id="${handover.handover_id}" data-listing="${r.listing_id}">
                            ✅ Mark as Collected
                        </button>
                    </div>
                `;
            } else if (handover.status === 'collected') {
                actionArea = `
                    <div style="color:#0a7a7a;font-size:13px;font-weight:700;margin-top:10px;">
                        ✅ Food collected on ${formatDateTime(handover.collected_at)}. Ready for distribution logging.
                    </div>
                `;
            }
        } else if (tab === 'completed') {
            actionArea = `
                <div style="color:#174c42;font-size:13px;margin-top:10px;">
                    <strong>Status:</strong> ${l ? l.status.toUpperCase() : 'COMPLETED'}
                    ${handover && handover.collected_at ? ` · Collected on ${formatDate(handover.collected_at)}` : ''}
                </div>
            `;
        }

        return `
            <div class="request-card" id="req-card-${r.request_id}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px;">
                    <div class="request-ngo-name" style="font-size:17px;color:#172321;">
                        ${l ? escapeHtml(l.food_name) : 'Food Donation'}
                    </div>
                    <span class="status-badge status-${r.status}">${r.status}</span>
                </div>
                <div class="request-meta">
                    <strong>Donor:</strong> ${escapeHtml(donorName)}${donor ? ` (${escapeHtml(donor.city)})` : ''} · Requested: <strong>${r.requested_qty} ${l ? l.unit : ''}</strong>
                </div>
                <div class="request-meta">
                    🕒 Requested ${formatRelativeTime(new Date(r.requested_at))}
                    ${r.responded_at ? ` · Responded ${formatRelativeTime(new Date(r.responded_at))}` : ''}
                </div>
                ${r.message ? `<div class="request-message">"${escapeHtml(r.message)}"</div>` : ''}
                ${actionArea}
            </div>
        `;
    }

    function attachRequestEvents(container) {
        // Cancel request
        container.querySelectorAll('.action-cancel-req').forEach(btn => {
            btn.addEventListener('click', () => {
                const reqId = btn.dataset.id;
                const listingId = btn.dataset.listing;

                showConfirmModal('Are you sure you want to cancel this food request?', () => {
                    FFGStore.update('ffg_requests', reqId, { status: 'cancelled', responded_at: new Date().toISOString() });

                    // Revert listing to available if no other pending requests exist
                    const others = FFGStore.findAllBy('ffg_requests', 'listing_id', listingId)
                        .filter(r => r.request_id !== reqId && r.status === 'pending');
                    if (others.length === 0) {
                        const l = FFGStore.getById('ffg_listings', listingId);
                        if (l && l.status === 'requested') {
                            FFGStore.update('ffg_listings', listingId, { status: 'available' });
                        }
                    }

                    showToast('Request cancelled.');
                    renderRequests();
                    renderOverview();
                });
            });
        });

        // Open Schedule Pickup Modal
        container.querySelectorAll('.action-schedule-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reqId = btn.dataset.id;
                openScheduleModal(reqId);
            });
        });

        // Mark as Collected
        container.querySelectorAll('.action-collect-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const handoverId = btn.dataset.id;
                const listingId = btn.dataset.listing;

                showConfirmModal('Confirm that your team has collected the surplus food from the donor?', () => {
                    const nowIso = new Date().toISOString();
                    FFGStore.update('ffg_handovers', handoverId, {
                        status: 'collected',
                        collected_at: nowIso,
                    });
                    FFGStore.update('ffg_listings', listingId, { status: 'collected' });

                    showToast('Food marked as collected! Please log the distribution in the Distributions tab.');
                    renderRequests();
                    renderOverview();
                });
            });
        });
    }

    // ═══════════════════════════════════════════════
    //  8. SCHEDULE PICKUP MODAL
    // ═══════════════════════════════════════════════
    const scheduleModal = document.getElementById('schedule-modal');
    const scheduleForm = document.getElementById('schedule-form');
    const smError = document.getElementById('sm-error');

    document.getElementById('sm-cancel-btn').addEventListener('click', () => {
        scheduleModal.style.display = 'none';
    });

    function openScheduleModal(reqId) {
        const req = FFGStore.getById('ffg_requests', reqId);
        if (!req) return;
        const l = FFGStore.getById('ffg_listings', req.listing_id);
        if (!l) return;

        document.getElementById('sm-request-id').value = req.request_id;
        document.getElementById('sm-food-name').textContent = `${l.food_name} (${req.requested_qty} ${l.unit})`;
        document.getElementById('sm-address').textContent = l.pickup_address;
        document.getElementById('sm-safe-until').textContent = formatDateTime(l.expires_at);

        // Pre-fill default pickup time as +30 mins from now
        const defaultTime = new Date(Date.now() + 30 * 60 * 1000);
        document.getElementById('sm-pickup-time').value = toDatetimeLocalString(defaultTime);
        document.getElementById('sm-pickup-person').value = ngo.contact_name || '';

        smError.style.display = 'none';
        scheduleModal.style.display = 'flex';
    }

    scheduleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        smError.style.display = 'none';

        const reqId = document.getElementById('sm-request-id').value;
        const req = FFGStore.getById('ffg_requests', reqId);
        if (!req) {
            smError.textContent = 'Request not found.';
            smError.style.display = 'block';
            return;
        }

        const l = FFGStore.getById('ffg_listings', req.listing_id);
        if (!l) {
            smError.textContent = 'Associated listing expired or not found.';
            smError.style.display = 'block';
            return;
        }

        const pickupTimeVal = document.getElementById('sm-pickup-time').value;
        const pickupPersonVal = document.getElementById('sm-pickup-person').value.trim();

        if (!pickupTimeVal) {
            smError.textContent = 'Please choose a pickup date & time.';
            smError.style.display = 'block';
            return;
        }

        const pickupTime = new Date(pickupTimeVal).getTime();
        const now = Date.now();
        const expiryTime = new Date(l.expires_at).getTime();

        if (pickupTime <= now) {
            smError.textContent = 'Pickup time must be in the future.';
            smError.style.display = 'block';
            return;
        }

        if (pickupTime >= expiryTime) {
            smError.textContent = `Pickup time must be before safe food expiry (${formatDateTime(l.expires_at)}).`;
            smError.style.display = 'block';
            return;
        }

        if (!pickupPersonVal) {
            smError.textContent = 'Please enter the name of the representative or driver.';
            smError.style.display = 'block';
            return;
        }

        // Check if handover row already exists
        const existingHandover = FFGStore.findBy('ffg_handovers', 'request_id', req.request_id);
        if (existingHandover) {
            FFGStore.update('ffg_handovers', existingHandover.handover_id, {
                pickup_time:   new Date(pickupTimeVal).toISOString(),
                pickup_person: pickupPersonVal,
                status:        'scheduled',
            });
        } else {
            FFGStore.insert('ffg_handovers', {
                request_id:    req.request_id,
                pickup_time:   new Date(pickupTimeVal).toISOString(),
                pickup_person: pickupPersonVal,
                collected_at:  null,
                status:        'scheduled',
            });
        }

        scheduleModal.style.display = 'none';
        showToast('Pickup scheduled successfully!');
        renderRequests();
        renderOverview();
    });

    // ═══════════════════════════════════════════════
    //  9. DISTRIBUTIONS SECTION
    // ═══════════════════════════════════════════════
    function renderDistributions() {
        const myRequests = FFGStore.findAllBy('ffg_requests', 'ngo_id', ngo.ngo_id);
        const myReqIds = myRequests.map(r => String(r.request_id));

        const allHandovers = FFGStore.getAll('ffg_handovers');
        const myHandovers = allHandovers.filter(h => myReqIds.includes(String(h.request_id)));

        // Handovers marked as collected
        const collectedHandovers = myHandovers.filter(h => h.status === 'collected');

        // All distributions
        const allDistributions = FFGStore.getAll('ffg_distributions');
        const myHandoverIds = myHandovers.map(h => String(h.handover_id));
        const myDistributions = allDistributions.filter(d => myHandoverIds.includes(String(d.handover_id)));

        // Pending distributions: collected handovers without a distribution record
        const distributedHandoverIds = myDistributions.map(d => String(d.handover_id));
        const pendingDistribution = collectedHandovers.filter(h => !distributedHandoverIds.includes(String(h.handover_id)));

        // 1. Render pending distributions
        const pendingGrid = document.getElementById('pending-dist-grid');
        const pendingEmpty = document.getElementById('pending-dist-empty');

        if (pendingDistribution.length === 0) {
            pendingGrid.innerHTML = '';
            pendingEmpty.style.display = 'block';
        } else {
            pendingEmpty.style.display = 'none';
            pendingGrid.innerHTML = pendingDistribution.map(h => {
                const req = FFGStore.getById('ffg_requests', h.request_id);
                const l = req ? FFGStore.getById('ffg_listings', req.listing_id) : null;
                const donor = l ? FFGStore.getById('ffg_donors', l.donor_id) : null;
                const donorName = donor ? (donor.org_name || 'Food Donor') : 'Food Donor';

                return `
                    <div class="listing-card">
                        <div class="listing-header">
                            <span class="listing-type-badge">📦 Collected</span>
                            <span class="status-badge status-collected">Awaiting Log</span>
                        </div>
                        <h3 class="listing-title">${l ? escapeHtml(l.food_name) : 'Food Item'}</h3>
                        <div class="listing-quantity">${req ? req.requested_qty : ''} ${l ? l.unit : ''}</div>
                        <div class="listing-meta">From: <strong>${escapeHtml(donorName)}</strong></div>
                        <div class="listing-meta">Collected: ${h.collected_at ? formatDateTime(h.collected_at) : 'Recently'}</div>
                        <div style="margin-top:14px;">
                            <button class="btn-sm btn-primary action-record-dist-btn" data-handover="${h.handover_id}" data-listing="${l ? l.listing_id : ''}" style="width:100%;">
                                📝 Record Distribution →
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            pendingGrid.querySelectorAll('.action-record-dist-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openDistributionModal(btn.dataset.handover, btn.dataset.listing);
                });
            });
        }

        // 2. Render past distributions table
        const tbody = document.getElementById('dist-tbody');
        const distEmpty = document.getElementById('dist-empty');

        if (myDistributions.length === 0) {
            tbody.innerHTML = '';
            document.getElementById('dist-table').style.display = 'none';
            distEmpty.style.display = 'block';
        } else {
            document.getElementById('dist-table').style.display = '';
            distEmpty.style.display = 'none';

            myDistributions.sort((a, b) => new Date(b.distributed_at || b.created_at) - new Date(a.distributed_at || a.created_at));

            tbody.innerHTML = myDistributions.map(d => {
                const h = FFGStore.getById('ffg_handovers', d.handover_id);
                const req = h ? FFGStore.getById('ffg_requests', h.request_id) : null;
                const l = req ? FFGStore.getById('ffg_listings', req.listing_id) : null;
                const donor = l ? FFGStore.getById('ffg_donors', l.donor_id) : null;
                const donorName = donor ? (donor.org_name || 'Food Donor') : 'Food Donor';

                return `
                    <tr>
                        <td data-label="Distributed Date">${formatDate(d.distributed_at || d.created_at)}</td>
                        <td data-label="Food Name">${l ? escapeHtml(l.food_name) : '—'}</td>
                        <td data-label="Quantity">${req ? req.requested_qty : ''} ${l ? l.unit : ''}</td>
                        <td data-label="Donor">${escapeHtml(donorName)}</td>
                        <td data-label="Distribution Location">${escapeHtml(d.location)}</td>
                        <td data-label="People Served"><strong>${d.people_served}</strong></td>
                        <td data-label="Remarks">${d.remarks ? escapeHtml(d.remarks) : '—'}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Export CSV
    document.getElementById('export-dist-csv-btn').addEventListener('click', () => {
        const myRequests = FFGStore.findAllBy('ffg_requests', 'ngo_id', ngo.ngo_id);
        const myReqIds = myRequests.map(r => String(r.request_id));
        const allHandovers = FFGStore.getAll('ffg_handovers');
        const myHandovers = allHandovers.filter(h => myReqIds.includes(String(h.request_id)));
        const myHandoverIds = myHandovers.map(h => String(h.handover_id));
        const allDistributions = FFGStore.getAll('ffg_distributions');
        const myDistributions = allDistributions.filter(d => myHandoverIds.includes(String(d.handover_id)));

        const rows = [['Distributed Date', 'Food Name', 'Quantity', 'Unit', 'Donor', 'Location', 'People Served', 'Remarks']];

        myDistributions.forEach(d => {
            const h = FFGStore.getById('ffg_handovers', d.handover_id);
            const req = h ? FFGStore.getById('ffg_requests', h.request_id) : null;
            const l = req ? FFGStore.getById('ffg_listings', req.listing_id) : null;
            const donor = l ? FFGStore.getById('ffg_donors', l.donor_id) : null;
            const donorName = donor ? (donor.org_name || 'Food Donor') : 'Food Donor';

            rows.push([
                formatDate(d.distributed_at || d.created_at),
                l ? l.food_name : '',
                req ? req.requested_qty : '',
                l ? l.unit : '',
                donorName,
                d.location,
                d.people_served,
                d.remarks || '',
            ]);
        });

        const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `food-distributions-${(ngo.ngo_name || 'ngo').toLowerCase().replace(/\s+/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ═══════════════════════════════════════════════
    //  10. RECORD DISTRIBUTION MODAL
    // ═══════════════════════════════════════════════
    const distModal = document.getElementById('distribution-modal');
    const distForm = document.getElementById('distribution-form');
    const dmError = document.getElementById('dm-error');

    document.getElementById('dm-cancel-btn').addEventListener('click', () => {
        distModal.style.display = 'none';
    });

    function openDistributionModal(handoverId, listingId) {
        const h = FFGStore.getById('ffg_handovers', handoverId);
        if (!h) return;
        const req = FFGStore.getById('ffg_requests', h.request_id);
        const l = req ? FFGStore.getById('ffg_listings', req.listing_id) : null;

        document.getElementById('dm-handover-id').value = h.handover_id;
        document.getElementById('dm-listing-id').value = l ? l.listing_id : '';

        document.getElementById('dm-food-name').textContent = l ? l.food_name : 'Surplus Food';
        document.getElementById('dm-quantity').textContent = `${req ? req.requested_qty : ''} ${l ? l.unit : ''}`;
        document.getElementById('dm-collected-at').textContent = h.collected_at ? formatDateTime(h.collected_at) : 'Recently';

        document.getElementById('dm-distributed-at').value = toDatetimeLocalString(new Date());
        document.getElementById('dm-location').value = '';
        document.getElementById('dm-people-served').value = '';
        document.getElementById('dm-remarks').value = '';

        dmError.style.display = 'none';
        distModal.style.display = 'flex';
    }

    distForm.addEventListener('submit', (e) => {
        e.preventDefault();
        dmError.style.display = 'none';

        const handoverId = document.getElementById('dm-handover-id').value;
        const listingId = document.getElementById('dm-listing-id').value;
        const h = FFGStore.getById('ffg_handovers', handoverId);

        const distributedAtVal = document.getElementById('dm-distributed-at').value;
        const locationVal = document.getElementById('dm-location').value.trim();
        const peopleServedVal = parseInt(document.getElementById('dm-people-served').value, 10);
        const remarksVal = document.getElementById('dm-remarks').value.trim();

        if (!distributedAtVal) {
            dmError.textContent = 'Please specify distribution date & time.';
            dmError.style.display = 'block';
            return;
        }

        const distTime = new Date(distributedAtVal).getTime();
        const now = Date.now();

        if (distTime > now) {
            dmError.textContent = 'Distribution date cannot be in the future.';
            dmError.style.display = 'block';
            return;
        }

        if (h && h.collected_at) {
            const collectedTime = new Date(h.collected_at).getTime();
            if (distTime < collectedTime) {
                dmError.textContent = 'Distribution date cannot be earlier than collection time.';
                dmError.style.display = 'block';
                return;
            }
        }

        if (!locationVal) {
            dmError.textContent = 'Please enter the distribution location.';
            dmError.style.display = 'block';
            return;
        }

        if (isNaN(peopleServedVal) || peopleServedVal < 1) {
            dmError.textContent = 'Please enter a valid number of people served (at least 1).';
            dmError.style.display = 'block';
            return;
        }

        // Insert into ffg_distributions
        FFGStore.insert('ffg_distributions', {
            handover_id:    handoverId,
            distributed_at: new Date(distributedAtVal).toISOString(),
            location:       locationVal,
            people_served:  peopleServedVal,
            remarks:        remarksVal,
        });

        // Set listing status to 'distributed'
        if (listingId) {
            FFGStore.update('ffg_listings', listingId, { status: 'distributed' });
        }

        distModal.style.display = 'none';
        showToast('Distribution record saved successfully! Thank you for feeding the community.');
        renderDistributions();
        renderOverview();
    });

    // ═══════════════════════════════════════════════
    //  11. PROFILE SECTION
    // ═══════════════════════════════════════════════
    function loadProfile() {
        const latestNgoData = FFGStore.currentNgo();
        if (latestNgoData) {
            user = latestNgoData.user;
            ngo = latestNgoData.ngo;
        }

        document.getElementById('np-email').value = user.email || '';
        document.getElementById('np-reg-number').value = ngo.reg_number || 'N/A';
        document.getElementById('np-vstatus').value = (ngo.verification_status || 'pending').toUpperCase();
        document.getElementById('np-cert-file').value = ngo.certificate_file || 'None uploaded';

        document.getElementById('np-org-name').value = ngo.ngo_name || '';
        document.getElementById('np-contact-name').value = ngo.contact_name || user.full_name || '';
        document.getElementById('np-designation').value = ngo.designation || '';
        document.getElementById('np-phone').value = user.phone || '';
        document.getElementById('np-address').value = ngo.address || '';
        document.getElementById('np-city').value = ngo.city || '';
        document.getElementById('np-pincode').value = ngo.pincode || '';
        document.getElementById('np-people-served').value = ngo.people_served || '';

        const isVehicle = ngo.pickup_capability === 'own_vehicle';
        document.getElementById('np-cap-vehicle').checked = isVehicle;
        document.getElementById('np-cap-delivery').checked = !isVehicle;
    }

    document.getElementById('ngo-profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('profile-msg');
        msgEl.style.display = 'none';

        const updatedOrgName = document.getElementById('np-org-name').value.trim();
        const updatedContact = document.getElementById('np-contact-name').value.trim();
        const updatedDesig = document.getElementById('np-designation').value.trim();
        const updatedPhone = document.getElementById('np-phone').value.trim();
        const updatedAddress = document.getElementById('np-address').value.trim();
        const updatedCity = document.getElementById('np-city').value.trim();
        const updatedPincode = document.getElementById('np-pincode').value.trim();
        const updatedPeople = parseInt(document.getElementById('np-people-served').value, 10);
        const updatedCapability = document.querySelector('input[name="pickup_capability"]:checked').value;

        // Update user
        FFGStore.update('ffg_users', user.user_id, {
            full_name: updatedContact,
            phone:     updatedPhone,
        });

        // Update ngo
        FFGStore.update('ffg_ngos', ngo.ngo_id, {
            ngo_name:          updatedOrgName,
            contact_name:      updatedContact,
            designation:       updatedDesig,
            address:           updatedAddress,
            city:              updatedCity,
            pincode:           updatedPincode,
            people_served:     updatedPeople,
            pickup_capability: updatedCapability,
        });

        document.getElementById('dash-user-name').textContent = updatedOrgName;

        msgEl.textContent = 'Profile updated successfully!';
        msgEl.className = 'form-message form-message--success';
        msgEl.style.display = 'block';
        setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
    });

    // Change Password
    document.getElementById('ngo-pw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('pw-msg');
        msgEl.style.display = 'none';

        const currentPw = document.getElementById('np-cp-current').value;
        const newPw = document.getElementById('np-cp-new').value;
        const confirmPw = document.getElementById('np-cp-confirm').value;

        const currentHash = await FFGStore.hashPassword(currentPw);
        if (currentHash !== user.password_hash) {
            msgEl.textContent = 'Current password is incorrect.';
            msgEl.className = 'form-message form-message--error';
            msgEl.style.display = 'block';
            return;
        }

        if (newPw.length < 8 || !/[a-zA-Z]/.test(newPw) || !/[0-9]/.test(newPw)) {
            msgEl.textContent = 'New password must be at least 8 characters long and contain both letters and numbers.';
            msgEl.className = 'form-message form-message--error';
            msgEl.style.display = 'block';
            return;
        }

        if (newPw !== confirmPw) {
            msgEl.textContent = 'New passwords do not match.';
            msgEl.className = 'form-message form-message--error';
            msgEl.style.display = 'block';
            return;
        }

        const newHash = await FFGStore.hashPassword(newPw);
        FFGStore.update('ffg_users', user.user_id, { password_hash: newHash });

        document.getElementById('np-cp-current').value = '';
        document.getElementById('np-cp-new').value = '';
        document.getElementById('np-cp-confirm').value = '';

        msgEl.textContent = 'Password changed successfully!';
        msgEl.className = 'form-message form-message--success';
        msgEl.style.display = 'block';
        setTimeout(() => { msgEl.style.display = 'none'; }, 3500);
    });

    // ═══════════════════════════════════════════════
    //  12. MODALS & UTILITIES
    // ═══════════════════════════════════════════════
    let confirmCallback = null;

    function showConfirmModal(message, onConfirm) {
        document.getElementById('modal-msg').textContent = message;
        confirmCallback = onConfirm;
        document.getElementById('confirm-modal').style.display = 'flex';
    }

    document.getElementById('modal-cancel').addEventListener('click', () => {
        document.getElementById('confirm-modal').style.display = 'none';
        confirmCallback = null;
    });

    document.getElementById('modal-confirm').addEventListener('click', () => {
        document.getElementById('confirm-modal').style.display = 'none';
        if (confirmCallback) {
            const cb = confirmCallback;
            confirmCallback = null;
            cb();
        }
    });

    function showInfoModal(message) {
        showConfirmModal(message, () => {});
        document.getElementById('modal-cancel').style.display = 'none';
        document.getElementById('modal-confirm').textContent = 'OK';
        document.getElementById('modal-confirm').addEventListener('click', () => {
            document.getElementById('modal-cancel').style.display = '';
            document.getElementById('modal-confirm').textContent = 'Confirm';
        }, { once: true });
    }

    function showToast(message, type = 'success') {
        if (typeof showMessage === 'function') {
            showMessage(null, message, type);
        } else {
            console.log(message);
        }
    }

    function formatCountdown(ms) {
        if (ms <= 0) return 'Expired';
        const totalMinutes = Math.floor(ms / (60 * 1000));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours === 0) return `${mins}m`;
        return `${hours}h ${mins}m`;
    }

    function formatRelativeTime(date) {
        const sec = Math.floor((Date.now() - date.getTime()) / 1000);
        if (sec < 60) return 'just now';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const day = Math.floor(hr / 24);
        return `${day}d ago`;
    }

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function toDatetimeLocalString(date) {
        const pad = (n) => String(n).padStart(2, '0');
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${y}-${m}-${d}T${h}:${min}`;
    }

    function formatDonorType(type) {
        const map = {
            restaurant: 'Restaurant',
            hotel:      'Hotel',
            caterer:    'Caterer',
            grocery:    'Grocery Store',
            event:      'Event / Party',
            individual: 'Individual',
            other:      'Food Provider',
        };
        return map[type] || 'Food Provider';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ═══════════════════════════════════════════════
    //  13. BOOTSTRAP INITIAL VIEW
    // ═══════════════════════════════════════════════
    switchSection('overview');

});

