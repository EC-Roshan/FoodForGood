// js/donor-dashboard.js — Donor Dashboard logic for Food For Good

document.addEventListener('DOMContentLoaded', () => {

    // ═══════════════════════════════════════════════
    //  GUARD: redirect if not logged in as donor
    // ═══════════════════════════════════════════════
    const session = FFGStore.getSession();
    if (!session || session.role !== 'donor') {
        window.location.href = 'donor-login.html';
        return;
    }

    // ═══════════════════════════════════════════════
    //  LOAD DONOR DATA
    // ═══════════════════════════════════════════════
    const donorData = FFGStore.currentDonor();
    if (!donorData) {
        window.location.href = 'donor-login.html';
        return;
    }
    const { user, donor } = donorData;

    // ═══════════════════════════════════════════════
    //  CHECK PLATFORM SETTINGS (Verification gate)
    // ═══════════════════════════════════════════════
    const platformSettings = typeof FFGStore.getSettings === 'function' 
        ? FFGStore.getSettings() 
        : { default_expiry_hours: 6, allow_unverified_donors: true };

    const isDonorRestricted = !platformSettings.allow_unverified_donors && user.status === 'pending';
    if (isDonorRestricted) {
        const addBtn = document.querySelector('.dash-nav-btn[data-section="add-listing"]');
        if (addBtn) {
            addBtn.style.opacity = '0.6';
            addBtn.title = 'Account pending verification';
        }
        const overviewSec = document.getElementById('section-overview');
        if (overviewSec) {
            const banner = document.createElement('div');
            banner.className = 'verification-banner banner-pending';
            banner.innerHTML = '<span class="banner-icon">⏳</span><span>Your donor account is awaiting admin verification. Food listing creation is currently disabled until an admin verifies your details.</span>';
            const welcomeEl = document.getElementById('dash-welcome');
            if (welcomeEl && welcomeEl.nextSibling) {
                overviewSec.insertBefore(banner, welcomeEl.nextSibling);
            } else {
                overviewSec.prepend(banner);
            }
        }
    }

    // ═══════════════════════════════════════════════
    //  EXPIRE LISTINGS on load, then every 60s
    // ═══════════════════════════════════════════════
    FFGStore.expireListings();
    setInterval(FFGStore.expireListings, 60000);

    // ═══════════════════════════════════════════════
    //  NAV: set user name, logout, section switching
    // ═══════════════════════════════════════════════
    document.getElementById('dash-user-name').textContent = donor.org_name || user.full_name;
    document.getElementById('dash-logout-btn').addEventListener('click', () => FFGStore.logout());

    // Section navigation
    const sections = ['overview', 'add-listing', 'my-listings', 'requests', 'history', 'profile'];

    function switchSection(name) {
        sections.forEach(s => {
            const sec = document.getElementById('section-' + s);
            const btn = document.querySelector('.dash-nav-btn[data-section="' + s + '"]');
            if (sec) sec.style.display = s === name ? '' : 'none';
            if (btn) btn.classList.toggle('active', s === name);
        });
        // refresh content when switching
        if (name === 'overview') renderOverview();
        if (name === 'my-listings') renderListings();
        if (name === 'requests') renderRequests();
        if (name === 'history') renderHistory();
        if (name === 'profile') loadProfile();
    }

    document.querySelectorAll('.dash-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    // ═══════════════════════════════════════════════
    //  HELPER: get this donor's listings
    // ═══════════════════════════════════════════════
    function getMyListings() {
        return FFGStore.findAllBy('ffg_listings', 'donor_id', donor.donor_id);
    }

    function getRequestsForMyListings() {
        const myListingIds = getMyListings().map(l => String(l.listing_id));
        return FFGStore.getAll('ffg_requests').filter(r => myListingIds.includes(String(r.listing_id)));
    }

    // ═══════════════════════════════════════════════
    //  OVERVIEW
    // ═══════════════════════════════════════════════
    function renderOverview() {
        FFGStore.expireListings();
        const listings = getMyListings();
        const requests = getRequestsForMyListings();

        const active = listings.filter(l => l.status === 'available' || l.status === 'requested').length;
        const pending = requests.filter(r => r.status === 'pending').length;
        const collected = listings.filter(l => l.status === 'collected').length;
        const distributed = listings.filter(l => l.status === 'distributed').length;

        document.getElementById('stat-active').textContent = active;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-collected').textContent = collected;
        document.getElementById('stat-distributed').textContent = distributed;

        document.getElementById('dash-welcome').textContent =
            'Welcome back, ' + (donor.org_name || user.full_name) + '!';

        // Impact breakdown by unit
        const donatedListings = listings.filter(l => l.status === 'collected' || l.status === 'distributed');
        if (donatedListings.length === 0) {
            document.getElementById('impact-breakdown').textContent = 'No donations completed yet.';
        } else {
            const totals = {};
            donatedListings.forEach(l => {
                totals[l.unit] = (totals[l.unit] || 0) + parseFloat(l.quantity);
            });
            document.getElementById('impact-breakdown').innerHTML = Object.entries(totals)
                .map(([unit, qty]) => '<span style="margin-right:18px"><strong>' + qty + '</strong> ' + unit + '</span>')
                .join('');
        }

        // Recent activity (latest 5 events)
        const activity = [];
        listings.forEach(l => {
            activity.push({ time: new Date(l.created_at), text: 'Listed: ' + l.food_name + ' (' + l.quantity + ' ' + l.unit + ')' });
            if (l.status !== 'available') {
                activity.push({ time: new Date(l.created_at), text: 'Status updated \u2192 ' + l.status + ': ' + l.food_name });
            }
        });
        requests.forEach(r => {
            const listing = FFGStore.getById('ffg_listings', r.listing_id);
            const ngo = FFGStore.getById('ffg_ngos', r.ngo_id);
            if (listing && ngo) {
                activity.push({ time: new Date(r.requested_at), text: 'Request from ' + ngo.ngo_name + ' for ' + listing.food_name });
            }
        });
        activity.sort((a, b) => b.time - a.time);
        const recent = activity.slice(0, 5);

        const activityEl = document.getElementById('recent-activity');
        if (recent.length === 0) {
            activityEl.innerHTML = '<p class="empty-state">No activity yet. Add your first food listing!</p>';
        } else {
            activityEl.innerHTML = recent.map(a => `
                <div class="activity-item">
                    <span>\uD83D\uDD14</span>
                    <span>${a.text}</span>
                    <span class="activity-time">${formatRelativeTime(a.time)}</span>
                </div>
            `).join('');
        }
    }

    // ═══════════════════════════════════════════════
    //  ADD LISTING FORM
    // ═══════════════════════════════════════════════
    const addForm = document.getElementById('add-listing-form');
    const listingMsg = document.getElementById('listing-msg');
    const timeError = document.getElementById('time-error');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const addListingTitleEl = document.getElementById('add-listing-title');
    const addListingBtn = document.getElementById('add-listing-btn');

    // Pre-fill pickup address from donor profile
    document.getElementById('pickup-address').value = donor.address + ', ' + donor.city + ' - ' + donor.pincode;

    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        timeError.style.display = 'none';
        listingMsg.style.display = 'none';

        if (isDonorRestricted) {
            listingMsg.textContent = 'Account pending verification. You cannot post food listings until an admin verifies your account.';
            listingMsg.className = 'form-message form-message--error';
            listingMsg.style.display = 'block';
            return;
        }

        const now = new Date();
        const preparedAt = new Date(document.getElementById('prepared-at').value);
        const expiresAt = new Date(document.getElementById('expires-at').value);

        if (preparedAt > now) {
            timeError.textContent = 'Prepared time cannot be in the future.';
            timeError.style.display = 'block';
            return;
        }
        if (expiresAt <= now) {
            timeError.textContent = '"Safe until" must be in the future.';
            timeError.style.display = 'block';
            return;
        }
        if (expiresAt <= preparedAt) {
            timeError.textContent = '"Safe until" must be after the preparation time.';
            timeError.style.display = 'block';
            return;
        }

        const selectedFoodType = addForm.querySelector('input[name="food_type"]:checked');
        if (!selectedFoodType) {
            timeError.textContent = 'Please select a food type.';
            timeError.style.display = 'block';
            return;
        }

        const editId = document.getElementById('edit-listing-id').value;
        const prepVal = document.getElementById('prepared-at').value;
        const expVal = document.getElementById('expires-at').value;

        const data = {
            donor_id: donor.donor_id,
            food_name: document.getElementById('food-name').value.trim(),
            food_type: selectedFoodType.value,
            quantity: parseFloat(document.getElementById('quantity').value),
            unit: document.getElementById('unit').value,
            prepared_at: prepVal ? new Date(prepVal).toISOString() : new Date().toISOString(),
            expires_at: expVal ? new Date(expVal).toISOString() : new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
            pickup_address: document.getElementById('pickup-address').value.trim(),
            notes: document.getElementById('notes').value.trim()
        };

        if (editId) {
            FFGStore.update('ffg_listings', editId, data);
            showListingMsg('Listing updated successfully!', 'success');
        } else {
            FFGStore.insert('ffg_listings', { ...data, status: 'available' });
            showListingMsg('Listing saved! Switching to My Listings\u2026', 'success');
        }

        addForm.reset();
        document.getElementById('edit-listing-id').value = '';
        document.getElementById('pickup-address').value = donor.address + ', ' + donor.city + ' - ' + donor.pincode;
        addListingTitleEl.textContent = 'Add Surplus Food';
        addListingBtn.innerHTML = 'Save Listing <span>\u2192</span>';
        cancelEditBtn.style.display = 'none';

        setTimeout(() => switchSection('my-listings'), 1500);
    });

    cancelEditBtn.addEventListener('click', () => {
        addForm.reset();
        document.getElementById('edit-listing-id').value = '';
        document.getElementById('pickup-address').value = donor.address + ', ' + donor.city + ' - ' + donor.pincode;
        addListingTitleEl.textContent = 'Add Surplus Food';
        addListingBtn.innerHTML = 'Save Listing <span>\u2192</span>';
        cancelEditBtn.style.display = 'none';
        listingMsg.style.display = 'none';
        switchSection('my-listings');
    });

    function showListingMsg(text, type) {
        listingMsg.textContent = text;
        listingMsg.className = 'form-message form-message--' + (type === 'success' ? 'success' : 'error');
        listingMsg.style.display = 'block';
    }

    // ═══════════════════════════════════════════════
    //  MY LISTINGS
    // ═══════════════════════════════════════════════
    let currentFilter = 'all';
    let countdownIntervals = [];

    document.getElementById('listing-filter-chips').addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        document.querySelectorAll('#listing-filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderListings();
    });

    document.getElementById('listing-search').addEventListener('input', renderListings);

    function renderListings() {
        countdownIntervals.forEach(clearInterval);
        countdownIntervals = [];
        FFGStore.expireListings();

        const search = document.getElementById('listing-search').value.toLowerCase();
        let listings = getMyListings();

        if (currentFilter !== 'all') {
            if (currentFilter === 'expired') {
                listings = listings.filter(l => l.status === 'expired' || l.status === 'cancelled');
            } else {
                listings = listings.filter(l => l.status === currentFilter);
            }
        }
        if (search) {
            listings = listings.filter(l => l.food_name.toLowerCase().includes(search));
        }

        listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const container = document.getElementById('listings-container');
        if (listings.length === 0) {
            container.innerHTML = '<p class="empty-state">No listings found.</p>';
            return;
        }

        container.innerHTML = listings.map(l => buildListingCard(l)).join('');
        attachListingCardEvents(container);

        // Countdown timers
        listings.forEach(l => {
            if (l.status === 'available' || l.status === 'requested') {
                const countEl = document.getElementById('countdown-' + l.listing_id);
                if (countEl) {
                    updateCountdown(countEl, l.expires_at);
                    const iv = setInterval(() => updateCountdown(countEl, l.expires_at), 60000);
                    countdownIntervals.push(iv);
                }
            }
        });
    }

    function buildListingCard(l) {
        const requests = FFGStore.findAllBy('ffg_requests', 'listing_id', l.listing_id);
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        const foodTypeIcon = { veg: '\uD83E\uDD66', 'non-veg': '\uD83C\uDF57', mixed: '\uD83C\uDF71' }[l.food_type] || '\uD83C\uDF71';
        const statusBadge = `<span class="status-badge status-${l.status}">${l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span>`;

        let actions = '';
        if (l.status === 'available') {
            const isDemo = localStorage.getItem('ffg_demo_mode') === 'on';
            actions = `
                <button class="btn-sm btn-primary action-btn" data-action="edit" data-id="${l.listing_id}">Edit</button>
                <button class="btn-sm btn-danger action-btn" data-action="cancel" data-id="${l.listing_id}">Cancel</button>
                ${isDemo ? `<button class="btn-sm action-btn" data-action="simulate" data-id="${l.listing_id}" title="Demo only">\uD83E\uDD16 Simulate NGO Request</button>` : ''}
            `;
        } else if (l.status === 'requested') {
            actions = `
                <button class="btn-sm btn-primary action-btn" data-action="view-requests" data-id="${l.listing_id}">View Requests (${pendingCount})</button>
                <button class="btn-sm btn-danger action-btn" data-action="cancel" data-id="${l.listing_id}">Cancel</button>
            `;
        } else if (l.status === 'approved') {
            actions = `
                <button class="btn-sm btn-primary action-btn" data-action="schedule" data-id="${l.listing_id}">Schedule Pickup</button>
                <button class="btn-sm btn-warning action-btn" data-action="confirm-handover" data-id="${l.listing_id}">\u2705 Confirm Handover</button>
                <button class="btn-sm btn-danger action-btn" data-action="cancel" data-id="${l.listing_id}">Cancel</button>
            `;
        } else {
            actions = `<button class="btn-sm action-btn" data-action="view-details" data-id="${l.listing_id}">View Details</button>`;
        }

        const countdownHtml = (l.status === 'available' || l.status === 'requested')
            ? `<div class="listing-countdown" id="countdown-${l.listing_id}">\u2026</div>`
            : '';

        return `
            <div class="listing-card" id="card-${l.listing_id}">
                <div class="listing-card-top">
                    <div class="listing-food-name">${foodTypeIcon} ${escapeHtml(l.food_name)}</div>
                    ${statusBadge}
                </div>
                <div class="listing-meta">\uD83D\uDCE6 ${l.quantity} ${l.unit} \u00B7 ${l.food_type}</div>
                <div class="listing-meta">\uD83D\uDCCD ${escapeHtml(l.pickup_address)}</div>
                ${countdownHtml}
                ${pendingCount > 0 ? `<div class="listing-meta" style="color:#856404">\uD83D\uDD14 ${pendingCount} pending request(s)</div>` : ''}
                <div class="listing-actions">${actions}</div>
            </div>
        `;
    }

    function attachListingCardEvents(container) {
        container.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const listing = FFGStore.getById('ffg_listings', id);
                if (!listing) return;

                if (action === 'edit') {
                    openEditListing(listing);
                } else if (action === 'cancel') {
                    showConfirmModal('Cancel this listing? All pending and approved requests will also be cancelled.', async () => {
                        FFGStore.update('ffg_listings', id, { status: 'cancelled' });
                        const reqs = FFGStore.findAllBy('ffg_requests', 'listing_id', id);
                        reqs.filter(r => r.status === 'pending' || r.status === 'approved')
                            .forEach(r => FFGStore.update('ffg_requests', r.request_id, { status: 'cancelled' }));
                        renderListings();
                    });
                } else if (action === 'simulate') {
                    FFGStore.simulateNgoRequest(id);
                    renderListings();
                } else if (action === 'view-requests') {
                    switchSection('requests');
                } else if (action === 'schedule') {
                    openScheduleModal(id);
                } else if (action === 'confirm-handover') {
                    showConfirmModal('Confirm that the food has been handed over and collected?', () => {
                        // Find approved request → create/update handover
                        const approvedReq = FFGStore.findAllBy('ffg_requests', 'listing_id', id).find(r => r.status === 'approved');
                        if (approvedReq) {
                            const existing = FFGStore.findBy('ffg_handovers', 'request_id', approvedReq.request_id);
                            if (existing) {
                                FFGStore.update('ffg_handovers', existing.handover_id, { status: 'collected', collected_at: new Date().toISOString() });
                            } else {
                                FFGStore.insert('ffg_handovers', { request_id: approvedReq.request_id, pickup_time: null, pickup_person: null, collected_at: new Date().toISOString(), status: 'collected' });
                            }
                        }
                        FFGStore.update('ffg_listings', id, { status: 'collected' });
                        renderListings();
                    });
                } else if (action === 'view-details') {
                    // Show details in a simple modal
                    const req = FFGStore.findAllBy('ffg_requests', 'listing_id', id).find(r => r.status === 'approved' || r.status === 'collected') || FFGStore.findBy('ffg_requests', 'listing_id', id);
                    let ngoName = 'N/A';
                    if (req) {
                        const ngo = FFGStore.getById('ffg_ngos', req.ngo_id);
                        if (ngo) ngoName = ngo.ngo_name;
                    }
                    showInfoModal(`
                        <strong>${escapeHtml(listing.food_name)}</strong><br>
                        Status: ${listing.status}<br>
                        Quantity: ${listing.quantity} ${listing.unit}<br>
                        NGO: ${ngoName}<br>
                        Prepared: ${formatDate(listing.prepared_at)}<br>
                        Safe Until: ${formatDate(listing.expires_at)}
                    `);
                }
            });
        });
    }

    function openEditListing(listing) {
        document.getElementById('edit-listing-id').value = listing.listing_id;
        document.getElementById('food-name').value = listing.food_name;
        const ftRadio = addForm.querySelector('input[name="food_type"][value="' + listing.food_type + '"]');
        if (ftRadio) ftRadio.checked = true;
        document.getElementById('quantity').value = listing.quantity;
        document.getElementById('unit').value = listing.unit;
        document.getElementById('prepared-at').value = toDatetimeLocal(listing.prepared_at);
        document.getElementById('expires-at').value = toDatetimeLocal(listing.expires_at);
        document.getElementById('pickup-address').value = listing.pickup_address;
        document.getElementById('notes').value = listing.notes || '';
        addListingTitleEl.textContent = 'Edit Listing';
        addListingBtn.innerHTML = 'Update Listing <span>\u2192</span>';
        cancelEditBtn.style.display = 'block';
        switchSection('add-listing');
    }

    function updateCountdown(el, expiresAt) {
        const now = Date.now();
        const exp = new Date(expiresAt).getTime();
        const diff = exp - now;
        if (diff <= 0) {
            el.textContent = 'Expired';
            el.classList.add('countdown-urgent');
            return;
        }
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const text = hours > 0 ? `Expires in ${hours}h ${mins}m` : `Expires in ${mins}m`;
        el.textContent = text;
        el.classList.toggle('countdown-urgent', diff < 3600000);
    }

    // ═══════════════════════════════════════════════
    //  REQUESTS
    // ═══════════════════════════════════════════════
    function renderRequests() {
        const container = document.getElementById('requests-container');
        const allRequests = getRequestsForMyListings();

        const groups = {
            pending: allRequests.filter(r => r.status === 'pending'),
            approved: allRequests.filter(r => r.status === 'approved'),
            closed: allRequests.filter(r => r.status === 'rejected' || r.status === 'cancelled')
        };

        const groupLabels = { pending: 'Pending', approved: 'Approved', closed: 'Rejected & Cancelled' };
        let html = '';

        Object.entries(groups).forEach(([key, reqs]) => {
            if (reqs.length === 0) return;
            html += `<div><h3 class="request-group-title">${groupLabels[key]}</h3>`;
            html += reqs.map(r => buildRequestCard(r, key)).join('');
            html += '</div>';
        });

        if (!html) {
            html = '<p class="empty-state">No requests yet.</p>';
        }
        container.innerHTML = html;
        attachRequestCardEvents(container);
    }

    function buildRequestCard(r, group) {
        const listing = FFGStore.getById('ffg_listings', r.listing_id);
        const ngo = FFGStore.getById('ffg_ngos', r.ngo_id);
        if (!listing || !ngo) return '';

        const pickupLabel = ngo.pickup_capability === 'own_vehicle' ? '\uD83D\uDE90 Own vehicle' : '\uD83D\uDE9A Needs delivery';

        let actions = '';
        if (group === 'pending') {
            actions = `
                <button class="btn-sm btn-primary action-req" data-action="approve" data-req="${r.request_id}" data-listing="${r.listing_id}">Approve</button>
                <button class="btn-sm btn-danger action-req" data-action="reject" data-req="${r.request_id}" data-listing="${r.listing_id}">Reject</button>
            `;
        } else if (group === 'approved') {
            actions = `
                <button class="btn-sm btn-warning action-req" data-action="confirm-handover" data-req="${r.request_id}" data-listing="${r.listing_id}">\u2705 Confirm Handover</button>
            `;
        }

        return `
            <div class="request-card">
                <div class="request-ngo-name">${escapeHtml(ngo.ngo_name)}</div>
                <div class="request-meta">\uD83D\uDCCD ${escapeHtml(ngo.city)} \u00B7 \uD83D\uDC65 ${ngo.people_served} people/day \u00B7 ${pickupLabel}</div>
                <div class="request-meta">\uD83C\uDF71 For: <strong>${escapeHtml(listing.food_name)}</strong> \u00B7 Requested: ${r.requested_qty} ${listing.unit}</div>
                <div class="request-meta">\uD83D\uDD50 ${formatRelativeTime(new Date(r.requested_at))}</div>
                ${r.message ? `<div class="request-message">"${escapeHtml(r.message)}"</div>` : ''}
                ${actions ? `<div class="request-actions">${actions}</div>` : ''}
            </div>
        `;
    }

    function attachRequestCardEvents(container) {
        container.querySelectorAll('.action-req').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const reqId = btn.dataset.req;
                const listingId = btn.dataset.listing;

                if (action === 'approve') {
                    showConfirmModal('Approve this request? Other pending requests for this listing will be rejected.', () => {
                        FFGStore.update('ffg_requests', reqId, { status: 'approved', responded_at: new Date().toISOString() });
                        // Reject all other pending requests for this listing
                        const others = FFGStore.findAllBy('ffg_requests', 'listing_id', listingId)
                            .filter(r => r.request_id !== reqId && r.status === 'pending');
                        others.forEach(r => FFGStore.update('ffg_requests', r.request_id, { status: 'rejected', responded_at: new Date().toISOString() }));
                        // Update listing status
                        FFGStore.update('ffg_listings', listingId, { status: 'approved' });
                        renderRequests();
                    });
                } else if (action === 'reject') {
                    showConfirmModal('Reject this request?', () => {
                        FFGStore.update('ffg_requests', reqId, { status: 'rejected', responded_at: new Date().toISOString() });
                        // Check if no more pending requests → revert listing to available
                        const remaining = FFGStore.findAllBy('ffg_requests', 'listing_id', listingId)
                            .filter(r => r.request_id !== reqId && r.status === 'pending');
                        if (remaining.length === 0) {
                            const listing = FFGStore.getById('ffg_listings', listingId);
                            if (listing && listing.status === 'requested') {
                                FFGStore.update('ffg_listings', listingId, { status: 'available' });
                            }
                        }
                        renderRequests();
                    });
                } else if (action === 'confirm-handover') {
                    showConfirmModal('Confirm handover \u2014 food has been collected by the NGO?', () => {
                        const existing = FFGStore.findBy('ffg_handovers', 'request_id', reqId);
                        if (existing) {
                            FFGStore.update('ffg_handovers', existing.handover_id, { status: 'collected', collected_at: new Date().toISOString() });
                        } else {
                            FFGStore.insert('ffg_handovers', { request_id: reqId, pickup_time: null, pickup_person: null, collected_at: new Date().toISOString(), status: 'collected' });
                        }
                        FFGStore.update('ffg_listings', listingId, { status: 'collected' });
                        renderRequests();
                    });
                }
            });
        });
    }

    // ═══════════════════════════════════════════════
    //  HISTORY
    // ═══════════════════════════════════════════════
    function renderHistory() {
        const listings = getMyListings().filter(l =>
            ['collected', 'distributed', 'expired', 'cancelled'].includes(l.status)
        );
        listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const tbody = document.getElementById('history-tbody');
        const emptyEl = document.getElementById('history-empty');

        if (listings.length === 0) {
            tbody.innerHTML = '';
            document.getElementById('history-table').style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }
        document.getElementById('history-table').style.display = '';
        emptyEl.style.display = 'none';

        tbody.innerHTML = listings.map(l => {
            const req = FFGStore.findAllBy('ffg_requests', 'listing_id', l.listing_id)
                .find(r => r.status === 'approved' || r.status === 'collected');
            let ngoName = '\u2014';
            if (req) {
                const ngo = FFGStore.getById('ffg_ngos', req.ngo_id);
                if (ngo) ngoName = ngo.ngo_name + (ngo.city ? ` (${ngo.city})` : '');
            }
            return `<tr>
                <td data-label="Date">${formatDate(l.created_at)}</td>
                <td data-label="Food">${escapeHtml(l.food_name)}</td>
                <td data-label="Quantity">${l.quantity} ${l.unit}</td>
                <td data-label="NGO">${escapeHtml(ngoName)}</td>
                <td data-label="Status"><span class="status-badge status-${l.status}">${l.status}</span></td>
            </tr>`;
        }).join('');
    }

    document.getElementById('export-csv-btn').addEventListener('click', () => {
        const listings = getMyListings().filter(l =>
            ['collected', 'distributed', 'expired', 'cancelled'].includes(l.status)
        );
        const rows = [['Date', 'Food Name', 'Food Type', 'Quantity', 'Unit', 'NGO', 'Status']];
        listings.forEach(l => {
            const req = FFGStore.findAllBy('ffg_requests', 'listing_id', l.listing_id)
                .find(r => r.status === 'approved' || r.status === 'collected');
            let ngoName = '';
            if (req) {
                const ngo = FFGStore.getById('ffg_ngos', req.ngo_id);
                if (ngo) ngoName = ngo.ngo_name + (ngo.city ? ` (${ngo.city})` : '');
            }
            rows.push([formatDate(l.created_at), l.food_name, l.food_type, l.quantity, l.unit, ngoName, l.status]);
        });
        const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'food-for-good-history.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    // ═══════════════════════════════════════════════
    //  PROFILE
    // ═══════════════════════════════════════════════
    function loadProfile() {
        document.getElementById('p-email').value = user.email;
        document.getElementById('p-donor-type').value = donor.donor_type;
        document.getElementById('p-full-name').value = user.full_name;
        document.getElementById('p-org-name').value = donor.org_name || '';
        document.getElementById('p-phone').value = user.phone;
        document.getElementById('p-address').value = donor.address;
        document.getElementById('p-city').value = donor.city;
        document.getElementById('p-pincode').value = donor.pincode;
        document.getElementById('p-fssai').value = donor.fssai_no || '';

        const isInd = donor.donor_type === 'individual';
        const orgField = document.getElementById('p-org-name');
        const orgLabel = document.querySelector('label[for="p-org-name"]');
        if (orgField) orgField.style.display = isInd ? 'none' : '';
        if (orgLabel) orgLabel.style.display = isInd ? 'none' : '';

        const demoToggle = document.getElementById('demo-mode-toggle');
        if (demoToggle) {
            demoToggle.checked = localStorage.getItem('ffg_demo_mode') === 'on';
        }
    }

    const demoToggle = document.getElementById('demo-mode-toggle');
    if (demoToggle) {
        demoToggle.addEventListener('change', (e) => {
            localStorage.setItem('ffg_demo_mode', e.target.checked ? 'on' : 'off');
            if (typeof renderListings === 'function') renderListings();
        });
    }

    document.getElementById('p-donor-type').addEventListener('change', (e) => {
        const orgField = document.getElementById('p-org-name');
        const orgLabel = document.querySelector('label[for="p-org-name"]');
        const isInd = e.target.value === 'individual';
        if (orgField) orgField.style.display = isInd ? 'none' : '';
        if (orgLabel) orgLabel.style.display = isInd ? 'none' : '';
    });

    document.getElementById('profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const profileMsg = document.getElementById('profile-msg');
        if (!e.target.checkValidity()) {
            e.target.reportValidity();
            return;
        }
        FFGStore.update('ffg_users', user.user_id, {
            full_name: document.getElementById('p-full-name').value.trim(),
            phone: document.getElementById('p-phone').value.trim()
        });
        FFGStore.update('ffg_donors', donor.donor_id, {
            donor_type: document.getElementById('p-donor-type').value,
            org_name: document.getElementById('p-org-name').value.trim(),
            address: document.getElementById('p-address').value.trim(),
            city: document.getElementById('p-city').value.trim(),
            pincode: document.getElementById('p-pincode').value.trim(),
            fssai_no: document.getElementById('p-fssai').value.trim()
        });
        profileMsg.textContent = 'Profile updated successfully!';
        profileMsg.className = 'form-message form-message--success';
        profileMsg.style.display = 'block';
        // Refresh local copies
        const updated = FFGStore.currentDonor();
        if (updated) {
            Object.assign(user, updated.user);
            Object.assign(donor, updated.donor);
            document.getElementById('dash-user-name').textContent = donor.org_name || user.full_name;
        }
    });

    // Change password
    document.getElementById('change-pw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cpMsg = document.getElementById('cp-msg');
        const currentPw = document.getElementById('cp-current').value;
        const newPw = document.getElementById('cp-new').value;
        const confirmPw = document.getElementById('cp-confirm').value;

        const currentHash = await FFGStore.hashPassword(currentPw);
        if (currentHash !== user.password_hash) {
            cpMsg.textContent = 'Current password is incorrect.';
            cpMsg.className = 'form-message form-message--error';
            cpMsg.style.display = 'block';
            return;
        }
        if (!/[a-zA-Z]/.test(newPw) || !/[0-9]/.test(newPw) || newPw.length < 8) {
            cpMsg.textContent = 'New password must be at least 8 characters with a letter and a number.';
            cpMsg.className = 'form-message form-message--error';
            cpMsg.style.display = 'block';
            return;
        }
        if (newPw !== confirmPw) {
            cpMsg.textContent = 'New passwords do not match.';
            cpMsg.className = 'form-message form-message--error';
            cpMsg.style.display = 'block';
            return;
        }
        const newHash = await FFGStore.hashPassword(newPw);
        FFGStore.update('ffg_users', user.user_id, { password_hash: newHash });
        user.password_hash = newHash;
        cpMsg.textContent = 'Password changed successfully!';
        cpMsg.className = 'form-message form-message--success';
        cpMsg.style.display = 'block';
        e.target.reset();
    });

    // Password show/hide on profile page
    document.querySelectorAll('.pw-toggle').forEach(btn => {
        if (btn.dataset.pwBound) return;
        btn.dataset.pwBound = 'true';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const inp = document.getElementById(btn.dataset.target);
            if (!inp) return;
            const isPassword = inp.type === 'password';
            inp.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '\uD83D\uDE48' : '\uD83D\uDC41';
            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    });

    // ═══════════════════════════════════════════════
    //  MODALS
    // ═══════════════════════════════════════════════
    let confirmCallback = null;

    function showConfirmModal(message, onConfirm) {
        document.getElementById('modal-msg').textContent = message;
        document.getElementById('modal-confirm').style.display = '';
        document.getElementById('modal-cancel').textContent = 'Cancel';
        document.getElementById('confirm-modal').style.display = 'flex';
        confirmCallback = onConfirm;
    }

    document.getElementById('modal-cancel').addEventListener('click', () => {
        document.getElementById('confirm-modal').style.display = 'none';
        document.getElementById('modal-confirm').style.display = '';
        document.getElementById('modal-cancel').textContent = 'Cancel';
        confirmCallback = null;
    });

    document.getElementById('modal-confirm').addEventListener('click', () => {
        document.getElementById('confirm-modal').style.display = 'none';
        document.getElementById('modal-confirm').style.display = '';
        document.getElementById('modal-cancel').textContent = 'Cancel';
        if (confirmCallback) confirmCallback();
        confirmCallback = null;
    });

    function showInfoModal(html) {
        document.getElementById('modal-msg').innerHTML = html;
        document.getElementById('confirm-modal').style.display = 'flex';
        document.getElementById('modal-confirm').style.display = 'none';
        document.getElementById('modal-cancel').textContent = 'Close';
        confirmCallback = null;
    }

    // Schedule pickup modal
    function openScheduleModal(listingId) {
        const modal = document.getElementById('schedule-modal');
        modal.style.display = 'flex';

        document.getElementById('sm-cancel').onclick = () => { modal.style.display = 'none'; };
        document.getElementById('sm-save').onclick = () => {
            const pickupTime = document.getElementById('sm-pickup-time').value;
            const pickupPerson = document.getElementById('sm-pickup-person').value.trim();
            const smError = document.getElementById('sm-error');
            smError.style.display = 'none';

            if (!pickupTime) {
                smError.textContent = 'Please enter a pickup date and time.';
                smError.style.display = 'block';
                return;
            }
            if (!pickupPerson) {
                smError.textContent = 'Please enter the pickup person\'s name.';
                smError.style.display = 'block';
                return;
            }

            const approvedReq = FFGStore.findAllBy('ffg_requests', 'listing_id', listingId)
                .find(r => r.status === 'approved');

            if (approvedReq) {
                const existing = FFGStore.findBy('ffg_handovers', 'request_id', approvedReq.request_id);
                if (existing) {
                    FFGStore.update('ffg_handovers', existing.handover_id, { pickup_time: pickupTime, pickup_person: pickupPerson, status: 'scheduled' });
                } else {
                    FFGStore.insert('ffg_handovers', { request_id: approvedReq.request_id, pickup_time: pickupTime, pickup_person: pickupPerson, collected_at: null, status: 'scheduled' });
                }
            }
            modal.style.display = 'none';
            renderListings();
        };
    }

    // ═══════════════════════════════════════════════
    //  UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(iso) {
        if (!iso) return '\u2014';
        return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatRelativeTime(date) {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    }

    function toDatetimeLocal(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // ═══════════════════════════════════════════════
    //  INITIAL RENDER
    // ═══════════════════════════════════════════════
    renderOverview();

});
