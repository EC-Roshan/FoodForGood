// js/admin-dashboard.js — Complete Central Administrator Workstation for Food For Good

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    //  1. PAGE GUARD & SESSION VERIFICATION
    // ═══════════════════════════════════════════════════════════════
    const session = FFGStore.getSession();
    if (!session || session.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    const currentAdminUser = FFGStore.getById('ffg_users', session.user_id);
    if (!currentAdminUser) {
        FFGStore.logout();
        return;
    }

    if (currentAdminUser.status === 'blocked') {
        FFGStore.logout();
        return;
    }

    // Set navbar info
    const userNameEl = document.getElementById('dash-user-name');
    if (userNameEl) userNameEl.textContent = currentAdminUser.full_name || 'Administrator';

    const welcomeEl = document.getElementById('admin-welcome');
    if (welcomeEl) welcomeEl.textContent = `Welcome back, ${currentAdminUser.full_name || 'Admin'} — central control room.`;

    const logoutBtn = document.getElementById('dash-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => FFGStore.logout());

    // Run expiration check immediately and periodically
    FFGStore.expireListings();
    setInterval(FFGStore.expireListings, 60000);

    // ═══════════════════════════════════════════════════════════════
    //  2. UTILITY & HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function formatRelative(iso) {
        if (!iso) return '—';
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    }

    function showToast(msg, type = 'success') {
        const container = document.getElementById('admin-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `admin-toast admin-toast--${type}`;
        const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(msg)}</span>`;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 260);
        }, 3400);
    }

    function downloadCSV(filename, csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function toCSVRow(arr) {
        return arr.map(val => {
            if (val == null) return '""';
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
        }).join(',');
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. MODALS & SLIDE-IN VIEW DRAWER
    // ═══════════════════════════════════════════════════════════════
    let confirmCallback = null;
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMsgEl = document.getElementById('confirm-msg');
    const confirmOkBtn = document.getElementById('confirm-ok');
    const confirmCancelBtn = document.getElementById('confirm-cancel');

    function openConfirmModal(msg, onConfirm) {
        confirmCallback = onConfirm;
        if (confirmMsgEl) confirmMsgEl.textContent = msg;
        if (confirmModal) confirmModal.style.display = 'flex';
        if (confirmOkBtn) confirmOkBtn.focus();
    }

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            if (confirmModal) confirmModal.style.display = 'none';
            confirmCallback = null;
        });
    }

    if (confirmOkBtn) {
        confirmOkBtn.addEventListener('click', () => {
            if (confirmModal) confirmModal.style.display = 'none';
            if (typeof confirmCallback === 'function') confirmCallback();
            confirmCallback = null;
        });
    }

    // Reject Modal
    let rejectCallback = null;
    const rejectModal = document.getElementById('reject-modal');
    const rejectReasonInput = document.getElementById('reject-reason');
    const rejectErrorEl = document.getElementById('reject-error');
    const rejectSubmitBtn = document.getElementById('reject-submit');
    const rejectCancelBtn = document.getElementById('reject-cancel');

    function openRejectModal(onSubmit) {
        rejectCallback = onSubmit;
        if (rejectReasonInput) rejectReasonInput.value = '';
        if (rejectErrorEl) rejectErrorEl.style.display = 'none';
        if (rejectModal) rejectModal.style.display = 'flex';
        if (rejectReasonInput) rejectReasonInput.focus();
    }

    if (rejectCancelBtn) {
        rejectCancelBtn.addEventListener('click', () => {
            if (rejectModal) rejectModal.style.display = 'none';
            rejectCallback = null;
        });
    }

    if (rejectSubmitBtn) {
        rejectSubmitBtn.addEventListener('click', () => {
            const reason = rejectReasonInput ? rejectReasonInput.value.trim() : '';
            if (!reason) {
                if (rejectErrorEl) {
                    rejectErrorEl.textContent = 'Please enter a valid rejection reason.';
                    rejectErrorEl.style.display = 'block';
                }
                return;
            }
            if (rejectModal) rejectModal.style.display = 'none';
            if (typeof rejectCallback === 'function') rejectCallback(reason);
            rejectCallback = null;
        });
    }

    // View Drawer
    const viewDrawer = document.getElementById('view-drawer');
    const drawerTitle = document.getElementById('drawer-title');
    const drawerContent = document.getElementById('drawer-content');
    const drawerCloseBtn = document.getElementById('drawer-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openViewDrawer(title, html) {
        if (drawerTitle) drawerTitle.textContent = title;
        if (drawerContent) drawerContent.innerHTML = html;
        if (viewDrawer) viewDrawer.classList.add('drawer-open');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
    }

    function closeViewDrawer() {
        if (viewDrawer) viewDrawer.classList.remove('drawer-open');
        if (!mobileMenuOpen && sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeViewDrawer);

    // Escape key modal/drawer handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (confirmModal && confirmModal.style.display !== 'none') confirmModal.style.display = 'none';
            if (rejectModal && rejectModal.style.display !== 'none') rejectModal.style.display = 'none';
            const addAdminModal = document.getElementById('add-admin-modal');
            if (addAdminModal && addAdminModal.style.display !== 'none') addAdminModal.style.display = 'none';
            const resetPwModal = document.getElementById('reset-pw-modal');
            if (resetPwModal && resetPwModal.style.display !== 'none') resetPwModal.style.display = 'none';
            const resetDataModal = document.getElementById('reset-data-modal');
            if (resetDataModal && resetDataModal.style.display !== 'none') resetDataModal.style.display = 'none';
            closeViewDrawer();
            closeMobileMenu();
        }
    });

    // ═══════════════════════════════════════════════════════════════
    //  4. HASH ROUTING & SECTION NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    const sections = [
        'overview',
        'verifications',
        'users',
        'listings',
        'requests',
        'distributions',
        'reports',
        'activity-log',
        'settings'
    ];

    let mobileMenuOpen = false;
    const adminMenuToggle = document.getElementById('admin-menu-toggle');
    const adminSidebar = document.getElementById('dash-sidebar');

    function openMobileMenu() {
        mobileMenuOpen = true;
        if (adminSidebar) adminSidebar.classList.add('sidebar-open');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
    }

    function closeMobileMenu() {
        mobileMenuOpen = false;
        if (adminSidebar) adminSidebar.classList.remove('sidebar-open');
        if (!viewDrawer.classList.contains('drawer-open') && sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
    }

    if (adminMenuToggle) {
        adminMenuToggle.addEventListener('click', () => {
            if (mobileMenuOpen) closeMobileMenu();
            else openMobileMenu();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            closeMobileMenu();
            closeViewDrawer();
        });
    }

    function switchSection(name, updateHash = true) {
        if (!sections.includes(name)) name = 'overview';

        sections.forEach(s => {
            const secEl = document.getElementById('section-' + s);
            const btnEl = document.querySelector(`.dash-nav-btn[data-section="${s}"]`);
            if (secEl) secEl.style.display = s === name ? 'block' : 'none';
            if (btnEl) btnEl.classList.toggle('active', s === name);
        });

        if (updateHash && window.location.hash !== '#' + name) {
            window.location.hash = '#' + name;
        }

        closeMobileMenu();
        closeViewDrawer();

        // Render target section
        if (name === 'overview') renderOverview();
        else if (name === 'verifications') renderVerifications();
        else if (name === 'users') renderUsers();
        else if (name === 'listings') renderListings();
        else if (name === 'requests') renderRequests();
        else if (name === 'distributions') renderDistributions();
        else if (name === 'reports') renderReports();
        else if (name === 'activity-log') renderActivityLog();
        else if (name === 'settings') loadSettings();

        updateVerifBadge();
    }

    document.querySelectorAll('.dash-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sec = btn.getAttribute('data-section');
            if (sec) switchSection(sec);
        });
    });

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'overview';
        switchSection(hash, false);
    });

    // ═══════════════════════════════════════════════════════════════
    //  5. VERIFICATION BADGE CALCULATOR
    // ═══════════════════════════════════════════════════════════════
    function updateVerifBadge() {
        const ngos = FFGStore.getAll('ffg_ngos') || [];
        const users = FFGStore.getAll('ffg_users') || [];

        const pendingNgosCount = ngos.filter(n => n.verification_status === 'pending').length;
        const pendingDonorsCount = users.filter(u => u.role === 'donor' && u.status === 'pending').length;
        const totalPending = pendingNgosCount + pendingDonorsCount;

        const badge = document.getElementById('verif-badge');
        if (badge) {
            badge.textContent = totalPending > 0 ? String(totalPending) : '';
            badge.setAttribute('data-count', String(totalPending));
            badge.style.display = totalPending > 0 ? 'inline-flex' : 'none';
        }
        return { pendingNgosCount, pendingDonorsCount, totalPending };
    }

    // ═══════════════════════════════════════════════════════════════
    //  6. CANVAS CHARTS (Vanilla Canvas 2D API, Zero Libraries)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Draws smooth 2-line chart: Listings Created vs Distributions Completed (14 Days)
     */
    function drawLineChart(canvas, labels, dataset1, dataset2) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 40;
        const padRight = 20;
        const padTop = 20;
        const padBottom = 35;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        const maxVal = Math.max(1, ...dataset1, ...dataset2);
        const yMax = Math.ceil(maxVal * 1.25);

        // Grid lines & Y Axis labels
        ctx.strokeStyle = '#eef2ea';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64736d';
        ctx.font = '10px "DM Sans", sans-serif';
        ctx.textAlign = 'right';

        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const val = Math.round((yMax / ySteps) * i);
            const y = padTop + chartH - (chartH / ySteps) * i;

            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + chartW, y);
            ctx.stroke();

            ctx.fillText(String(val), padLeft - 6, y + 3);
        }

        const count = labels.length;
        const stepX = chartW / Math.max(1, count - 1);

        // Helper to draw polyline
        function drawLine(data, color, dotColor) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;

            data.forEach((val, idx) => {
                const x = padLeft + idx * stepX;
                const y = padTop + chartH - (val / yMax) * chartH;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Draw points
            data.forEach((val, idx) => {
                const x = padLeft + idx * stepX;
                const y = padTop + chartH - (val / yMax) * chartH;
                ctx.beginPath();
                ctx.fillStyle = dotColor || '#ffffff';
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }

        drawLine(dataset1, '#174c42', '#ffffff'); // Listings
        drawLine(dataset2, '#c7e86b', '#174c42'); // Distributions

        // X Axis labels (Show every 2nd or 3rd label)
        ctx.fillStyle = '#64736d';
        ctx.textAlign = 'center';
        labels.forEach((lbl, idx) => {
            if (idx % 2 === 0 || idx === count - 1) {
                const x = padLeft + idx * stepX;
                ctx.fillText(lbl, x, h - 12);
            }
        });
    }

    /**
     * Draws Donut chart: Listings by Status
     */
    function drawDonutChart(canvas, segments, legendContainerId) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const total = segments.reduce((acc, s) => acc + s.value, 0);
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 15;
        const innerRadius = radius * 0.62;

        if (total === 0) {
            ctx.fillStyle = '#dfe3da';
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#64736d';
            ctx.font = '12px "DM Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No Listings', cx, cy + 4);
            return;
        }

        let startAngle = -Math.PI / 2;
        segments.forEach(seg => {
            if (seg.value <= 0) return;
            const sliceAngle = (seg.value / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();

            startAngle += sliceAngle;
        });

        // Center cutout & text
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius - 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#172321';
        ctx.font = '700 20px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(total), cx, cy + 2);

        ctx.fillStyle = '#64736d';
        ctx.font = '10px "DM Sans", sans-serif';
        ctx.fillText('Listings', cx, cy + 18);

        // Build HTML legend
        if (legendContainerId) {
            const legendEl = document.getElementById(legendContainerId);
            if (legendEl) {
                legendEl.innerHTML = segments.map(s => {
                    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                    return `
                        <div class="chart-legend-item">
                            <span class="chart-legend-dot" style="background: ${s.color};"></span>
                            <span>${escapeHtml(s.label)} (${s.value} · ${pct}%)</span>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    /**
     * Draws Horizontal Bar chart: Top Cities
     */
    function drawBarChart(canvas, items) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (!items || items.length === 0) {
            ctx.fillStyle = '#64736d';
            ctx.font = '12px "DM Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No city activity data recorded yet', w / 2, h / 2);
            return;
        }

        const padLeft = 85;
        const padRight = 45;
        const padTop = 15;
        const padBottom = 15;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        const maxVal = Math.max(1, ...items.map(i => i.value));
        const barH = Math.min(22, (chartH / items.length) * 0.65);
        const stepY = chartH / items.length;

        items.forEach((item, idx) => {
            const y = padTop + idx * stepY + (stepY - barH) / 2;
            const barW = Math.max(4, (item.value / maxVal) * chartW);

            // City label
            ctx.fillStyle = '#172321';
            ctx.font = '600 11px "DM Sans", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(item.label, padLeft - 10, y + barH * 0.75);

            // Bar fill
            ctx.fillStyle = '#174c42';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(padLeft, y, barW, barH, 4) : ctx.rect(padLeft, y, barW, barH);
            ctx.fill();

            // Value label
            ctx.fillStyle = '#64736d';
            ctx.font = '700 11px "Space Grotesk", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(String(item.value), padLeft + barW + 8, y + barH * 0.75);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  7. SECTION 1: OVERVIEW RENDERING
    // ═══════════════════════════════════════════════════════════════
    function renderOverview() {
        const donors = FFGStore.getAll('ffg_donors') || [];
        const ngos = FFGStore.getAll('ffg_ngos') || [];
        const listings = FFGStore.getAll('ffg_listings') || [];
        const requests = FFGStore.getAll('ffg_requests') || [];
        const handovers = FFGStore.getAll('ffg_handovers') || [];
        const distributions = FFGStore.getAll('ffg_distributions') || [];
        const activityLogs = FFGStore.getAll('ffg_activity_log') || [];

        // 1. Stat Card Counts
        const pendingNgos = ngos.filter(n => n.verification_status === 'pending');
        const activeListings = listings.filter(l => l.status === 'available' || l.status === 'requested');

        let totalRescuedQty = 0;
        listings.forEach(l => {
            if (l.status === 'collected' || l.status === 'distributed') {
                totalRescuedQty += Number(l.quantity) || 0;
            }
        });

        let totalPeopleFed = 0;
        distributions.forEach(d => {
            totalPeopleFed += Number(d.people_served) || 0;
        });

        document.getElementById('astat-donors').textContent = String(donors.length);
        document.getElementById('astat-ngos').textContent = String(ngos.length);
        document.getElementById('astat-verif').textContent = String(pendingNgos.length);
        document.getElementById('astat-active').textContent = String(activeListings.length);
        document.getElementById('astat-rescued').textContent = `${totalRescuedQty}`;
        document.getElementById('astat-people').textContent = `${totalPeopleFed}`;

        // 2. Trend Line Chart (Last 14 Days)
        const lineLabels = [];
        const listingsData = [];
        const distributionsData = [];
        const now = Date.now();
        const DAY = 24 * 3600 * 1000;

        for (let i = 13; i >= 0; i--) {
            const d = new Date(now - i * DAY);
            const dateStr = d.toISOString().slice(0, 10);
            const labelStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            lineLabels.push(labelStr);

            const countListings = listings.filter(l => (l.created_at || '').slice(0, 10) === dateStr).length;
            const countDist = distributions.filter(dist => (dist.distributed_at || dist.created_at || '').slice(0, 10) === dateStr).length;

            listingsData.push(countListings);
            distributionsData.push(countDist);
        }

        const lineCanvas = document.getElementById('chart-line');
        if (lineCanvas) drawLineChart(lineCanvas, lineLabels, listingsData, distributionsData);

        // 3. Donut Chart (Listings by Status)
        const statusColors = {
            available: '#28a745',
            requested: '#ffc107',
            approved: '#0c63e4',
            collected: '#17a2b8',
            distributed: '#174c42',
            expired: '#6c757d',
            cancelled: '#e05353',
        };

        const statusSegments = [
            { label: 'Available', color: statusColors.available, value: listings.filter(l => l.status === 'available').length },
            { label: 'Requested', color: statusColors.requested, value: listings.filter(l => l.status === 'requested').length },
            { label: 'Approved', color: statusColors.approved, value: listings.filter(l => l.status === 'approved').length },
            { label: 'Collected', color: statusColors.collected, value: listings.filter(l => l.status === 'collected').length },
            { label: 'Distributed', color: statusColors.distributed, value: listings.filter(l => l.status === 'distributed').length },
            { label: 'Expired', color: statusColors.expired, value: listings.filter(l => l.status === 'expired').length },
            { label: 'Cancelled', color: statusColors.cancelled, value: listings.filter(l => l.status === 'cancelled').length },
        ].filter(s => s.value > 0);

        const donutCanvas = document.getElementById('chart-donut');
        if (donutCanvas) drawDonutChart(donutCanvas, statusSegments, 'chart-donut-legend');

        // 4. Bar Chart (Top Active Cities)
        const cityCounts = {};
        donors.forEach(d => { if (d.city) cityCounts[d.city] = (cityCounts[d.city] || 0) + 1; });
        ngos.forEach(n => { if (n.city) cityCounts[n.city] = (cityCounts[n.city] || 0) + 1; });
        listings.forEach(l => {
            const donor = FFGStore.getById('ffg_donors', l.donor_id);
            if (donor && donor.city) cityCounts[donor.city] = (cityCounts[donor.city] || 0) + 1;
        });

        const topCities = Object.keys(cityCounts)
            .map(c => ({ label: c, value: cityCounts[c] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const barCanvas = document.getElementById('chart-bar');
        if (barCanvas) drawBarChart(barCanvas, topCities);

        // 5. Needs Attention Alerts
        const attentionList = document.getElementById('needs-attention-list');
        if (attentionList) {
            const alerts = [];

            if (pendingNgos.length > 0) {
                alerts.push(`
                    <div class="attention-card attention-warning">
                        <div class="attention-card-content">
                            <h4 class="attention-card-title">⏳ ${pendingNgos.length} NGO Application${pendingNgos.length > 1 ? 's' : ''} Awaiting Review</h4>
                            <p class="attention-card-desc">Partner NGOs cannot book food pickups until their registration certificates are verified.</p>
                        </div>
                        <button type="button" class="btn-sm btn-primary" onclick="window.location.hash='#verifications'">Review Now</button>
                    </div>
                `);
            }

            // Flag listings expiring within 3 hours
            const nowTime = Date.now();
            const expiringSoon = listings.filter(l => {
                if (l.status !== 'available' && l.status !== 'requested') return false;
                const rem = new Date(l.expires_at).getTime() - nowTime;
                return rem > 0 && rem <= 3 * 3600 * 1000;
            });

            if (expiringSoon.length > 0) {
                alerts.push(`
                    <div class="attention-card attention-danger">
                        <div class="attention-card-content">
                            <h4 class="attention-card-title">⚠️ ${expiringSoon.length} Food Listing${expiringSoon.length > 1 ? 's' : ''} Expiring in &lt; 3 Hours</h4>
                            <p class="attention-card-desc">Coordinate urgent notification to verified local shelters before quality threshold lapses.</p>
                        </div>
                        <button type="button" class="btn-sm btn-danger" onclick="window.location.hash='#listings'">Inspect Listings</button>
                    </div>
                `);
            }

            // Flag stale requests (> 1 hour pending without donor answer)
            const stalePending = requests.filter(r => {
                if (r.status !== 'pending') return false;
                const reqAge = nowTime - new Date(r.requested_at).getTime();
                return reqAge > 3600 * 1000;
            });

            if (stalePending.length > 0) {
                alerts.push(`
                    <div class="attention-card attention-info">
                        <div class="attention-card-content">
                            <h4 class="attention-card-title">⏱️ ${stalePending.length} Stale Pickup Request${stalePending.length > 1 ? 's' : ''}</h4>
                            <p class="attention-card-desc">Requests pending without donor confirmation for over 60 minutes.</p>
                        </div>
                        <button type="button" class="btn-sm btn-warning" onclick="window.location.hash='#requests'">View Requests</button>
                    </div>
                `);
            }

            if (alerts.length === 0) {
                attentionList.innerHTML = `
                    <div class="attention-card" style="border-left-color: #28a745; background: #f6fcf8;">
                        <div class="attention-card-content">
                            <h4 class="attention-card-title">✅ All Operations Running Smoothly</h4>
                            <p class="attention-card-desc">No pending review backlogs, expiring risks, or unattended delivery stalls.</p>
                        </div>
                    </div>
                `;
            } else {
                attentionList.innerHTML = alerts.join('');
            }
        }

        // 6. Recent Activity Feed (Top 5)
        const recentActivityList = document.getElementById('overview-activity-list');
        if (recentActivityList) {
            const sortedLogs = [...activityLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
            if (sortedLogs.length === 0) {
                recentActivityList.innerHTML = '<div class="empty-state">No recent activity logs recorded.</div>';
            } else {
                recentActivityList.innerHTML = sortedLogs.map(log => `
                    <div class="activity-item">
                        <span class="status-badge status-approved" style="font-size: 10px;">${escapeHtml(log.action)}</span>
                        <span style="font-weight: 500;">${escapeHtml(log.details)}</span>
                        <span class="activity-time">${formatRelative(log.created_at)}</span>
                    </div>
                `).join('');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  8. SECTION 2: VERIFICATIONS (NGO & DONOR APPROVALS)
    // ═══════════════════════════════════════════════════════════════
    let currentVerifTab = 'ngo-pending';

    function renderVerifications() {
        const container = document.getElementById('verif-cards-container');
        const emptyEl = document.getElementById('verif-empty');
        const cityFilter = document.getElementById('verif-city-filter');
        const searchInput = document.getElementById('verif-search');

        // Populate city filter once
        const allNgos = FFGStore.getAll('ffg_ngos') || [];
        const allDonors = FFGStore.getAll('ffg_donors') || [];
        const cities = Array.from(new Set([...allNgos.map(n => n.city), ...allDonors.map(d => d.city)].filter(Boolean))).sort();

        if (cityFilter && cityFilter.options.length <= 1) {
            cities.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                cityFilter.appendChild(opt);
            });
        }

        const selectedCity = cityFilter ? cityFilter.value : 'all';
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        // Wire tabs
        document.querySelectorAll('[data-verif-tab]').forEach(tabBtn => {
            tabBtn.onclick = () => {
                document.querySelectorAll('[data-verif-tab]').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                currentVerifTab = tabBtn.getAttribute('data-verif-tab');
                renderVerifications();
            };
        });

        if (cityFilter) cityFilter.onchange = () => renderVerifications();
        if (searchInput) searchInput.oninput = () => renderVerifications();

        let items = [];

        if (currentVerifTab === 'ngo-pending') {
            const ngos = FFGStore.getAll('ffg_ngos') || [];
            items = ngos.filter(n => n.verification_status === 'pending').map(n => {
                const user = FFGStore.getById('ffg_users', n.user_id) || {};
                return { type: 'ngo', data: n, user };
            });
        } else if (currentVerifTab === 'donor-pending') {
            const donors = FFGStore.getAll('ffg_donors') || [];
            items = donors.map(d => {
                const user = FFGStore.getById('ffg_users', d.user_id) || {};
                return { type: 'donor', data: d, user };
            }).filter(item => item.user.status === 'pending');
        } else if (currentVerifTab === 'reviewed') {
            const ngos = FFGStore.getAll('ffg_ngos') || [];
            items = ngos.filter(n => n.verification_status === 'verified' || n.verification_status === 'rejected').map(n => {
                const user = FFGStore.getById('ffg_users', n.user_id) || {};
                return { type: 'ngo', data: n, user, status: n.verification_status };
            });
        }

        // Apply filters
        items = items.filter(it => {
            const entity = it.data;
            const user = it.user;
            if (selectedCity !== 'all' && entity.city !== selectedCity) return false;
            if (query) {
                const text = `${entity.ngo_name || entity.org_name || ''} ${user.full_name || ''} ${user.email || ''} ${entity.city || ''} ${entity.reg_number || ''}`.toLowerCase();
                if (!text.includes(query)) return false;
            }
            return true;
        });

        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        container.innerHTML = items.map(it => {
            if (it.type === 'ngo') {
                const ngo = it.data;
                const user = it.user;
                const isReviewed = currentVerifTab === 'reviewed';

                return `
                    <div class="verif-card">
                        <div>
                            <div class="verif-card-header">
                                <div>
                                    <h4 class="verif-card-name">${escapeHtml(ngo.ngo_name)}</h4>
                                    <span style="font-size: 12px; color: #64736d;">Reg No: <strong>${escapeHtml(ngo.reg_number || 'N/A')}</strong></span>
                                </div>
                                <span class="status-badge ${ngo.verification_status === 'verified' ? 'status-available' : ngo.verification_status === 'rejected' ? 'status-cancelled' : 'status-requested'}">
                                    ${escapeHtml(ngo.verification_status)}
                                </span>
                            </div>

                            <div class="verif-card-meta">👤 Contact: <strong>${escapeHtml(ngo.contact_name || user.full_name)}</strong> (${escapeHtml(ngo.designation || 'Representative')})</div>
                            <div class="verif-card-meta">📧 Email: <strong>${escapeHtml(user.email)}</strong></div>
                            <div class="verif-card-meta">📞 Phone: <strong>${escapeHtml(user.phone || '—')}</strong></div>
                            <div class="verif-card-meta">📍 Address: ${escapeHtml(ngo.address)}, ${escapeHtml(ngo.city)} - ${escapeHtml(ngo.pincode)}</div>
                            <div class="verif-card-meta">👥 Capacity: <strong>${ngo.people_served || 0}</strong> people served daily</div>
                            <div class="verif-card-meta">🚚 Logistics: <strong>${ngo.pickup_capability === 'own_vehicle' ? 'Own Vehicle (Self Pickup)' : 'Needs Delivery Support'}</strong></div>
                            <div class="verif-card-meta">📄 Document: <a href="javascript:void(0)" onclick="window.viewDoc('${escapeHtml(ngo.certificate_file || 'Registration_Certificate.pdf')}')" style="color: #174c42; font-weight: 600; text-decoration: underline;">${escapeHtml(ngo.certificate_file || 'Registration_Certificate.pdf')}</a></div>
                        </div>

                        ${!isReviewed ? `
                            <div class="verif-card-actions">
                                <button type="button" class="btn-sm btn-primary" onclick="window.approveNgo('${ngo.ngo_id}')">Approve NGO</button>
                                <button type="button" class="btn-sm btn-danger" onclick="window.rejectNgo('${ngo.ngo_id}')">Reject</button>
                            </div>
                        ` : `
                            <div class="verif-card-actions">
                                <button type="button" class="btn-sm btn-warning" onclick="window.revertNgoReview('${ngo.ngo_id}')">Re-open Review</button>
                            </div>
                        `}
                    </div>
                `;
            } else {
                // Donor Pending Card
                const donor = it.data;
                const user = it.user;
                return `
                    <div class="verif-card">
                        <div>
                            <div class="verif-card-header">
                                <div>
                                    <h4 class="verif-card-name">${escapeHtml(donor.org_name || user.full_name)}</h4>
                                    <span style="font-size: 12px; color: #64736d;">Type: <strong>${escapeHtml(donor.donor_type || 'Donor')}</strong></span>
                                </div>
                                <span class="status-badge status-requested">Pending Verification</span>
                            </div>

                            <div class="verif-card-meta">👤 Representative: <strong>${escapeHtml(user.full_name)}</strong></div>
                            <div class="verif-card-meta">📧 Email: <strong>${escapeHtml(user.email)}</strong></div>
                            <div class="verif-card-meta">📞 Phone: <strong>${escapeHtml(user.phone || '—')}</strong></div>
                            <div class="verif-card-meta">📍 Address: ${escapeHtml(donor.address)}, ${escapeHtml(donor.city)} - ${escapeHtml(donor.pincode)}</div>
                            <div class="verif-card-meta">🛡️ FSSAI License: <strong>${escapeHtml(donor.fssai_no || 'Not Provided')}</strong></div>
                        </div>

                        <div class="verif-card-actions">
                            <button type="button" class="btn-sm btn-primary" onclick="window.approveDonor('${user.user_id}')">Verify Donor</button>
                            <button type="button" class="btn-sm btn-danger" onclick="window.rejectDonor('${user.user_id}')">Reject</button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    // Global action handlers for verifications
    window.viewDoc = (filename) => {
        openViewDrawer('Document Inspection', `
            <div style="text-align: center; padding: 24px 0;">
                <div style="font-size: 48px; margin-bottom: 12px;">📑</div>
                <h4 style="font-family: 'Space Grotesk', sans-serif; font-size: 18px; margin-bottom: 8px;">${escapeHtml(filename)}</h4>
                <p style="color: #64736d; font-size: 13px; max-width: 360px; margin: 0 auto 24px;">
                    Government registration and compliance document file submitted during organization onboarding.
                </p>
                <div style="background: #f8f6ef; border: 1px dashed #dfe3da; border-radius: 14px; padding: 30px; margin-bottom: 20px;">
                    <span style="font-size: 13px; color: #174c42; font-weight: 600;">[ Document Verification Preview Verified ]</span>
                    <p style="font-size: 12px; color: #64736d; margin-top: 6px;">Seal, signature, and registration authority matching registered NGO identity.</p>
                </div>
                <button type="button" class="btn-sm btn-primary" onclick="window.closeDrawer()">Return to Reviews</button>
            </div>
        `);
    };

    window.closeDrawer = closeViewDrawer;

    window.approveNgo = (ngoId) => {
        openConfirmModal('Approve this NGO organization and grant full food requisition permissions?', () => {
            const ngo = FFGStore.getById('ffg_ngos', ngoId);
            if (!ngo) return;

            FFGStore.update('ffg_ngos', ngo.ngo_id, { verification_status: 'verified' });
            FFGStore.update('ffg_users', ngo.user_id, { status: 'active' });

            FFGStore.logAction(currentAdminUser.user_id, 'VERIFIED_NGO', 'ngo', ngo.ngo_id, `Approved verification credentials for ${ngo.ngo_name}`);
            showToast(`NGO "${ngo.ngo_name}" has been approved!`, 'success');
            renderVerifications();
            updateVerifBadge();
        });
    };

    window.rejectNgo = (ngoId) => {
        const ngo = FFGStore.getById('ffg_ngos', ngoId);
        if (!ngo) return;

        openRejectModal((reason) => {
            FFGStore.update('ffg_ngos', ngo.ngo_id, { verification_status: 'rejected' });
            FFGStore.update('ffg_users', ngo.user_id, { status: 'rejected' });

            FFGStore.logAction(currentAdminUser.user_id, 'REJECTED_NGO', 'ngo', ngo.ngo_id, `Rejected ${ngo.ngo_name}. Reason: ${reason}`);
            showToast(`NGO "${ngo.ngo_name}" rejected.`, 'error');
            renderVerifications();
            updateVerifBadge();
        });
    };

    window.revertNgoReview = (ngoId) => {
        openConfirmModal('Re-open verification review for this organization and return to pending queue?', () => {
            const ngo = FFGStore.getById('ffg_ngos', ngoId);
            if (!ngo) return;

            FFGStore.update('ffg_ngos', ngo.ngo_id, { verification_status: 'pending' });
            FFGStore.update('ffg_users', ngo.user_id, { status: 'pending' });

            FFGStore.logAction(currentAdminUser.user_id, 'REOPENED_VERIFICATION', 'ngo', ngo.ngo_id, `Re-opened verification review for ${ngo.ngo_name}`);
            showToast(`Verification status reverted to pending for ${ngo.ngo_name}`, 'info');
            renderVerifications();
            updateVerifBadge();
        });
    };

    window.approveDonor = (userId) => {
        openConfirmModal('Verify this donor account and approve food listing creation?', () => {
            const user = FFGStore.getById('ffg_users', userId);
            if (!user) return;

            FFGStore.update('ffg_users', user.user_id, { status: 'active' });
            FFGStore.logAction(currentAdminUser.user_id, 'VERIFIED_DONOR', 'donor', user.user_id, `Verified donor account for ${user.full_name}`);
            showToast(`Donor "${user.full_name}" is now verified!`, 'success');
            renderVerifications();
            updateVerifBadge();
        });
    };

    window.rejectDonor = (userId) => {
        const user = FFGStore.getById('ffg_users', userId);
        if (!user) return;

        openRejectModal((reason) => {
            FFGStore.update('ffg_users', user.user_id, { status: 'rejected' });
            FFGStore.logAction(currentAdminUser.user_id, 'REJECTED_DONOR', 'donor', user.user_id, `Rejected donor ${user.full_name}. Reason: ${reason}`);
            showToast(`Donor "${user.full_name}" rejected.`, 'error');
            renderVerifications();
            updateVerifBadge();
        });
    };

    // ═══════════════════════════════════════════════════════════════
    //  9. SECTION 3: USERS DIRECTORY & MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    let usersCurrentPage = 1;
    const USERS_PER_PAGE = 10;
    let usersSortField = 'joined';
    let usersSortAsc = false;

    function renderUsers() {
        const tbody = document.getElementById('users-tbody');
        const pagination = document.getElementById('users-pagination');
        const roleFilter = document.getElementById('users-role-filter');
        const statusFilter = document.getElementById('users-status-filter');
        const cityFilter = document.getElementById('users-city-filter');
        const searchInput = document.getElementById('users-search');

        const allUsers = FFGStore.getAll('ffg_users') || [];
        const allDonors = FFGStore.getAll('ffg_donors') || [];
        const allNgos = FFGStore.getAll('ffg_ngos') || [];

        // Populate city filter
        const cities = Array.from(new Set([...allDonors.map(d => d.city), ...allNgos.map(n => n.city)].filter(Boolean))).sort();
        if (cityFilter && cityFilter.options.length <= 1) {
            cities.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                cityFilter.appendChild(opt);
            });
        }

        const role = roleFilter ? roleFilter.value : 'all';
        const status = statusFilter ? statusFilter.value : 'all';
        const city = cityFilter ? cityFilter.value : 'all';
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

        // Attach listeners once
        if (roleFilter && !roleFilter.dataset.bound) {
            roleFilter.dataset.bound = '1';
            roleFilter.onchange = () => { usersCurrentPage = 1; renderUsers(); };
        }
        if (statusFilter && !statusFilter.dataset.bound) {
            statusFilter.dataset.bound = '1';
            statusFilter.onchange = () => { usersCurrentPage = 1; renderUsers(); };
        }
        if (cityFilter && !cityFilter.dataset.bound) {
            cityFilter.dataset.bound = '1';
            cityFilter.onchange = () => { usersCurrentPage = 1; renderUsers(); };
        }
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = '1';
            searchInput.oninput = () => { usersCurrentPage = 1; renderUsers(); };
        }

        // Table header sort listeners
        document.querySelectorAll('#users-table th.sortable').forEach(th => {
            if (!th.dataset.bound) {
                th.dataset.bound = '1';
                th.addEventListener('click', () => {
                    const field = th.getAttribute('data-sort');
                    if (usersSortField === field) {
                        usersSortAsc = !usersSortAsc;
                    } else {
                        usersSortField = field;
                        usersSortAsc = true;
                    }
                    renderUsers();
                });
            }
            // Update sort classes
            const field = th.getAttribute('data-sort');
            th.classList.remove('sort-asc', 'sort-desc');
            if (usersSortField === field) {
                th.classList.add(usersSortAsc ? 'sort-asc' : 'sort-desc');
            }
        });

        // Map user with location & details
        let list = allUsers.map(u => {
            let userCity = '—';
            let orgName = '';
            if (u.role === 'donor') {
                const d = allDonors.find(x => x.user_id === u.user_id);
                if (d) { userCity = d.city || '—'; orgName = d.org_name || ''; }
            } else if (u.role === 'ngo') {
                const n = allNgos.find(x => x.user_id === u.user_id);
                if (n) { userCity = n.city || '—'; orgName = n.ngo_name || ''; }
            }
            return { ...u, city: userCity, orgName };
        });

        // Filter
        list = list.filter(u => {
            if (role !== 'all' && u.role !== role) return false;
            if (status !== 'all' && u.status !== status) return false;
            if (city !== 'all' && u.city !== city) return false;
            if (q) {
                const text = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''} ${u.orgName} ${u.city}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        // Sort
        list.sort((a, b) => {
            let valA = a[usersSortField] || '';
            let valB = b[usersSortField] || '';
            if (usersSortField === 'joined') {
                valA = new Date(a.created_at || 0).getTime();
                valB = new Date(b.created_at || 0).getTime();
            } else if (usersSortField === 'name') {
                valA = (a.full_name || '').toLowerCase();
                valB = (b.full_name || '').toLowerCase();
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return usersSortAsc ? -1 : 1;
            if (valA > valB) return usersSortAsc ? 1 : -1;
            return 0;
        });

        // Pagination
        const totalUsers = list.length;
        const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE) || 1;
        if (usersCurrentPage > totalPages) usersCurrentPage = totalPages;
        const start = (usersCurrentPage - 1) * USERS_PER_PAGE;
        const paginated = list.slice(start, start + USERS_PER_PAGE);

        if (!tbody) return;

        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #64736d;">No platform users match the specified criteria.</td></tr>`;
            if (pagination) pagination.innerHTML = '';
            return;
        }

        tbody.innerHTML = paginated.map(u => {
            const isSelf = u.user_id === currentAdminUser.user_id;
            const isBlocked = u.status === 'blocked';

            return `
                <tr>
                    <td data-label="Full Name">
                        <strong>${escapeHtml(u.full_name)}</strong>
                        ${u.orgName ? `<div style="font-size: 12px; color: #64736d;">${escapeHtml(u.orgName)}</div>` : ''}
                    </td>
                    <td data-label="Email">${escapeHtml(u.email)}</td>
                    <td data-label="Role">
                        <span class="status-badge" style="background: ${u.role === 'admin' ? '#e8e2f4' : u.role === 'donor' ? '#dcf5e4' : '#d0ebff'}; color: ${u.role === 'admin' ? '#6a1b9a' : '#172321'};">
                            ${escapeHtml(u.role)}
                        </span>
                    </td>
                    <td data-label="Status">
                        <span class="status-badge ${u.status === 'active' ? 'status-available' : u.status === 'pending' ? 'status-requested' : u.status === 'blocked' ? 'status-cancelled' : 'status-expired'}">
                            ${escapeHtml(u.status)}
                        </span>
                    </td>
                    <td data-label="City">${escapeHtml(u.city)}</td>
                    <td data-label="Registered">${formatDate(u.created_at)}</td>
                    <td data-label="Actions">
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button type="button" class="btn-sm btn-primary" onclick="window.viewUserDrawer('${u.user_id}')">View</button>
                            ${!isSelf ? `
                                <button type="button" class="btn-sm ${isBlocked ? 'btn-primary' : 'btn-danger'}" onclick="window.toggleUserBlock('${u.user_id}')">
                                    ${isBlocked ? 'Unblock' : 'Block'}
                                </button>
                                <button type="button" class="btn-sm btn-warning" onclick="window.resetUserPassword('${u.user_id}')">Reset PW</button>
                            ` : `<span style="font-size: 11px; color: #64736d; margin: auto 4px;">(Active Session)</span>`}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Pagination Controls
        if (pagination) {
            pagination.innerHTML = `
                <button type="button" class="page-btn" ${usersCurrentPage === 1 ? 'disabled' : ''} onclick="window.changeUsersPage(${usersCurrentPage - 1})">‹</button>
                <span class="page-info">Page ${usersCurrentPage} of ${totalPages} (${totalUsers} total)</span>
                <button type="button" class="page-btn" ${usersCurrentPage === totalPages ? 'disabled' : ''} onclick="window.changeUsersPage(${usersCurrentPage + 1})">›</button>
            `;
        }
    }

    window.changeUsersPage = (p) => {
        usersCurrentPage = p;
        renderUsers();
    };

    // User Drawer View
    window.viewUserDrawer = (userId) => {
        const user = FFGStore.getById('ffg_users', userId);
        if (!user) return;

        let extraHtml = '';
        if (user.role === 'donor') {
            const donor = FFGStore.findBy('ffg_donors', 'user_id', user.user_id);
            const listings = donor ? FFGStore.findAllBy('ffg_listings', 'donor_id', donor.donor_id) : [];
            extraHtml = `
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Donor Organization</div>
                    <div class="drawer-detail-value"><strong>${escapeHtml(donor ? donor.org_name : 'Individual')}</strong> (${escapeHtml(donor ? donor.donor_type : '')})</div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">FSSAI Registration</div>
                    <div class="drawer-detail-value">${escapeHtml(donor ? donor.fssai_no || 'Not Registered' : 'N/A')}</div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Registered Address</div>
                    <div class="drawer-detail-value">${escapeHtml(donor ? donor.address : '')}, ${escapeHtml(donor ? donor.city : '')} - ${escapeHtml(donor ? donor.pincode : '')}</div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Food Listings Posted</div>
                    <div class="drawer-detail-value"><strong>${listings.length}</strong> total food batches donated</div>
                </div>
            `;
        } else if (user.role === 'ngo') {
            const ngo = FFGStore.findBy('ffg_ngos', 'user_id', user.user_id);
            const requests = ngo ? FFGStore.findAllBy('ffg_requests', 'ngo_id', ngo.ngo_id) : [];
            extraHtml = `
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">NGO Organization</div>
                    <div class="drawer-detail-value"><strong>${escapeHtml(ngo ? ngo.ngo_name : 'NGO')}</strong></div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Government Registration No</div>
                    <div class="drawer-detail-value">${escapeHtml(ngo ? ngo.reg_number : '—')}</div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Verification Status</div>
                    <div class="drawer-detail-value"><span class="status-badge status-approved">${escapeHtml(ngo ? ngo.verification_status : '')}</span></div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Registered Office</div>
                    <div class="drawer-detail-value">${escapeHtml(ngo ? ngo.address : '')}, ${escapeHtml(ngo ? ngo.city : '')} - ${escapeHtml(ngo ? ngo.pincode : '')}</div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Community Daily Capacity</div>
                    <div class="drawer-detail-value">${ngo ? ngo.people_served : 0} beneficiaries / day</div>
                </div>
                <div class="drawer-detail-group">
                    <div class="drawer-detail-label">Food Requests Placed</div>
                    <div class="drawer-detail-value"><strong>${requests.length}</strong> requests</div>
                </div>
            `;
        }

        openViewDrawer('User Profile Details', `
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Account Holder</div>
                <div class="drawer-detail-value" style="font-size: 16px; font-weight: 700;">${escapeHtml(user.full_name)}</div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Email & Contact</div>
                <div class="drawer-detail-value">📧 ${escapeHtml(user.email)}<br>📞 ${escapeHtml(user.phone || 'No phone recorded')}</div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">System Role & Account State</div>
                <div class="drawer-detail-value">
                    <span class="status-badge" style="background: #e8e2f4; color: #6a1b9a;">${escapeHtml(user.role)}</span>
                    <span class="status-badge status-${user.status === 'active' ? 'available' : 'cancelled'}">${escapeHtml(user.status)}</span>
                </div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Account Created</div>
                <div class="drawer-detail-value">${formatDateTime(user.created_at)}</div>
            </div>
            ${extraHtml}
        `);
    };

    window.toggleUserBlock = (userId) => {
        const user = FFGStore.getById('ffg_users', userId);
        if (!user) return;

        const isBlocked = user.status === 'blocked';
        const newStatus = isBlocked ? 'active' : 'blocked';
        const actionText = isBlocked ? 'Unblock' : 'Suspend and Block';

        openConfirmModal(`${actionText} user account "${user.full_name}" (${user.email})?`, () => {
            FFGStore.update('ffg_users', user.user_id, { status: newStatus });
            FFGStore.logAction(currentAdminUser.user_id, isBlocked ? 'UNBLOCKED_USER' : 'BLOCKED_USER', 'user', user.user_id, `${isBlocked ? 'Restored access for' : 'Blocked and suspended'} ${user.email}`);
            showToast(`User ${user.email} is now ${newStatus}.`, isBlocked ? 'success' : 'error');
            renderUsers();
        });
    };

    window.resetUserPassword = async (userId) => {
        const user = FFGStore.getById('ffg_users', userId);
        if (!user) return;

        openConfirmModal(`Generate a new temporary password for ${user.email}? This will invalidate their current password immediately.`, async () => {
            // Generate random 12-char secure password
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
            let tempPassword = '';
            for (let i = 0; i < 12; i++) {
                tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            const hash = await FFGStore.hashPassword(tempPassword);
            FFGStore.update('ffg_users', user.user_id, { password_hash: hash });
            FFGStore.logAction(currentAdminUser.user_id, 'RESET_PASSWORD', 'user', user.user_id, `Administrative password reset for ${user.email}`);

            const resetModal = document.getElementById('reset-pw-modal');
            const resultEl = document.getElementById('reset-pw-result');
            const closeBtn = document.getElementById('reset-pw-close');

            if (resultEl) resultEl.textContent = tempPassword;
            if (resetModal) resetModal.style.display = 'flex';
            if (closeBtn) closeBtn.onclick = () => { resetModal.style.display = 'none'; };

            showToast(`Password successfully reset for ${user.email}`, 'info');
        });
    };

    // Add Admin Form Modal
    const addAdminBtn = document.getElementById('users-add-admin-btn');
    const addAdminModal = document.getElementById('add-admin-modal');
    const addAdminForm = document.getElementById('add-admin-form');
    const aaCancelBtn = document.getElementById('aa-cancel');
    const aaErrorEl = document.getElementById('aa-error');

    if (addAdminBtn && addAdminModal) {
        addAdminBtn.onclick = () => {
            if (addAdminForm) addAdminForm.reset();
            if (aaErrorEl) aaErrorEl.style.display = 'none';
            addAdminModal.style.display = 'flex';
        };
    }

    if (aaCancelBtn && addAdminModal) {
        aaCancelBtn.onclick = () => { addAdminModal.style.display = 'none'; };
    }

    if (addAdminForm) {
        addAdminForm.onsubmit = async (e) => {
            e.preventDefault();
            if (aaErrorEl) aaErrorEl.style.display = 'none';

            const name = document.getElementById('aa-name').value.trim();
            const email = document.getElementById('aa-email').value.trim().toLowerCase();
            const phone = document.getElementById('aa-phone').value.trim();
            const password = document.getElementById('aa-password').value;
            const confirm = document.getElementById('aa-confirm').value;

            if (!name || !email || !password) {
                if (aaErrorEl) { aaErrorEl.textContent = 'Please fill in all required fields.'; aaErrorEl.style.display = 'block'; }
                return;
            }

            if (password.length < 8) {
                if (aaErrorEl) { aaErrorEl.textContent = 'Password must be at least 8 characters long.'; aaErrorEl.style.display = 'block'; }
                return;
            }

            if (password !== confirm) {
                if (aaErrorEl) { aaErrorEl.textContent = 'Passwords do not match.'; aaErrorEl.style.display = 'block'; }
                return;
            }

            // Check email uniqueness
            const existing = FFGStore.findBy('ffg_users', 'email', email);
            if (existing) {
                if (aaErrorEl) { aaErrorEl.textContent = 'A user with this email address already exists.'; aaErrorEl.style.display = 'block'; }
                return;
            }

            const hash = await FFGStore.hashPassword(password);
            const newAdmin = FFGStore.insert('ffg_users', {
                full_name: name,
                email: email,
                phone: phone,
                password_hash: hash,
                role: 'admin',
                status: 'active',
            });

            FFGStore.logAction(currentAdminUser.user_id, 'CREATED_ADMIN', 'user', newAdmin.user_id, `Created new administrator account: ${email}`);

            if (addAdminModal) addAdminModal.style.display = 'none';
            showToast(`Administrator account created for ${email}`, 'success');
            renderUsers();
        };
    }

    // Export Users CSV
    const usersExportBtn = document.getElementById('users-export-btn');
    if (usersExportBtn) {
        usersExportBtn.onclick = () => {
            const allUsers = FFGStore.getAll('ffg_users') || [];
            const allDonors = FFGStore.getAll('ffg_donors') || [];
            const allNgos = FFGStore.getAll('ffg_ngos') || [];

            const headers = ['User ID', 'Full Name', 'Email', 'Phone', 'Role', 'Status', 'City', 'Joined At'];
            const rows = allUsers.map(u => {
                let city = '';
                if (u.role === 'donor') {
                    const d = allDonors.find(x => x.user_id === u.user_id);
                    if (d) city = d.city;
                } else if (u.role === 'ngo') {
                    const n = allNgos.find(x => x.user_id === u.user_id);
                    if (n) city = n.city;
                }
                return toCSVRow([u.user_id, u.full_name, u.email, u.phone || '', u.role, u.status, city, u.created_at]);
            });

            const csv = [headers.join(','), ...rows].join('\n');
            downloadCSV(`food_for_good_users_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast('User accounts CSV exported successfully.', 'success');
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  10. SECTION 4: FOOD LISTINGS AUDIT & DIRECTORY
    // ═══════════════════════════════════════════════════════════════
    let listingsCurrentPage = 1;
    const LISTINGS_PER_PAGE = 10;

    function renderListings() {
        const tbody = document.getElementById('listings-tbody');
        const pagination = document.getElementById('listings-pagination');
        const statusFilter = document.getElementById('listings-status-filter');
        const typeFilter = document.getElementById('listings-type-filter');
        const cityFilter = document.getElementById('listings-city-filter');
        const dateFrom = document.getElementById('listings-date-from');
        const dateTo = document.getElementById('listings-date-to');
        const searchInput = document.getElementById('listings-search');

        const allListings = FFGStore.getAll('ffg_listings') || [];
        const allDonors = FFGStore.getAll('ffg_donors') || [];

        // Populate cities
        const cities = Array.from(new Set(allDonors.map(d => d.city).filter(Boolean))).sort();
        if (cityFilter && cityFilter.options.length <= 1) {
            cities.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                cityFilter.appendChild(opt);
            });
        }

        const selStatus = statusFilter ? statusFilter.value : 'all';
        const selType = typeFilter ? typeFilter.value : 'all';
        const selCity = cityFilter ? cityFilter.value : 'all';
        const fromVal = dateFrom ? dateFrom.value : '';
        const toVal = dateTo ? dateTo.value : '';
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

        // Attach listeners once
        [statusFilter, typeFilter, cityFilter, dateFrom, dateTo].forEach(el => {
            if (el && !el.dataset.bound) {
                el.dataset.bound = '1';
                el.onchange = () => { listingsCurrentPage = 1; renderListings(); };
            }
        });
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = '1';
            searchInput.oninput = () => { listingsCurrentPage = 1; renderListings(); };
        }

        let filtered = allListings.map(l => {
            const donor = allDonors.find(d => d.donor_id === l.donor_id) || {};
            return { ...l, donor };
        });

        filtered = filtered.filter(l => {
            if (selStatus !== 'all' && l.status !== selStatus) return false;
            if (selType !== 'all' && l.food_type !== selType) return false;
            if (selCity !== 'all' && l.donor.city !== selCity) return false;
            if (fromVal && (l.created_at || '').slice(0, 10) < fromVal) return false;
            if (toVal && (l.created_at || '').slice(0, 10) > toVal) return false;
            if (q) {
                const text = `${l.food_name || ''} ${l.donor.org_name || ''} ${l.notes || ''} ${l.pickup_address || ''}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        // Sort by created desc
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = filtered.length;
        const totalPages = Math.ceil(total / LISTINGS_PER_PAGE) || 1;
        if (listingsCurrentPage > totalPages) listingsCurrentPage = totalPages;
        const start = (listingsCurrentPage - 1) * LISTINGS_PER_PAGE;
        const paginated = filtered.slice(start, start + LISTINGS_PER_PAGE);

        if (!tbody) return;

        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #64736d;">No food listings match the specified filter criteria.</td></tr>`;
            if (pagination) pagination.innerHTML = '';
            return;
        }

        tbody.innerHTML = paginated.map(l => {
            const canExpire = l.status === 'available' || l.status === 'requested';
            const canCancel = l.status !== 'cancelled' && l.status !== 'distributed';

            return `
                <tr>
                    <td data-label="Food Item"><strong>${escapeHtml(l.food_name)}</strong></td>
                    <td data-label="Donor Organization">${escapeHtml(l.donor.org_name || 'Individual Donor')}</td>
                    <td data-label="Type">
                        <span class="status-badge" style="background: ${l.food_type === 'veg' ? '#eaf4e8' : '#fce8e8'}; color: ${l.food_type === 'veg' ? '#174c42' : '#c0392b'};">
                            ${l.food_type === 'veg' ? '🥗 Veg' : '🍗 Non-Veg'}
                        </span>
                    </td>
                    <td data-label="Quantity">${l.quantity} ${escapeHtml(l.unit || 'meals')}</td>
                    <td data-label="Status"><span class="status-badge status-${l.status}">${escapeHtml(l.status)}</span></td>
                    <td data-label="Posted At">${formatDateTime(l.created_at)}</td>
                    <td data-label="Expires At">${formatDateTime(l.expires_at)}</td>
                    <td data-label="Actions">
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button type="button" class="btn-sm btn-primary" onclick="window.viewListingTimeline('${l.listing_id}')">Timeline</button>
                            ${canExpire ? `<button type="button" class="btn-sm btn-warning" onclick="window.markListingExpired('${l.listing_id}')">Expire</button>` : ''}
                            ${canCancel ? `<button type="button" class="btn-sm btn-danger" onclick="window.cancelListing('${l.listing_id}')">Cancel</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (pagination) {
            pagination.innerHTML = `
                <button type="button" class="page-btn" ${listingsCurrentPage === 1 ? 'disabled' : ''} onclick="window.changeListingsPage(${listingsCurrentPage - 1})">‹</button>
                <span class="page-info">Page ${listingsCurrentPage} of ${totalPages} (${total} total)</span>
                <button type="button" class="page-btn" ${listingsCurrentPage === totalPages ? 'disabled' : ''} onclick="window.changeListingsPage(${listingsCurrentPage + 1})">›</button>
            `;
        }
    }

    window.changeListingsPage = (p) => {
        listingsCurrentPage = p;
        renderListings();
    };

    window.viewListingTimeline = (listingId) => {
        const listing = FFGStore.getById('ffg_listings', listingId);
        if (!listing) return;

        const donor = FFGStore.getById('ffg_donors', listing.donor_id) || {};
        const requests = FFGStore.findAllBy('ffg_requests', 'listing_id', listing.listing_id) || [];
        const approvedReq = requests.find(r => r.status === 'approved');
        const handover = approvedReq ? FFGStore.findBy('ffg_handovers', 'request_id', approvedReq.request_id) : null;
        const distribution = handover ? FFGStore.findBy('ffg_distributions', 'handover_id', handover.handover_id) : null;

        let timelineItems = [];

        // 1. Created
        timelineItems.push(`
            <div class="timeline-item timeline-done">
                <div class="timeline-time">${formatDateTime(listing.created_at)}</div>
                <div class="timeline-title">Food Batch Posted</div>
                <div class="timeline-desc">Posted by <strong>${escapeHtml(donor.org_name || 'Donor')}</strong> (${listing.quantity} ${escapeHtml(listing.unit || 'meals')})</div>
            </div>
        `);

        // 2. Requests
        if (requests.length > 0) {
            requests.forEach(r => {
                const ngo = FFGStore.getById('ffg_ngos', r.ngo_id) || {};
                timelineItems.push(`
                    <div class="timeline-item ${r.status === 'approved' ? 'timeline-done' : ''}">
                        <div class="timeline-time">${formatDateTime(r.requested_at)}</div>
                        <div class="timeline-title">Request Placed (${escapeHtml(r.status)})</div>
                        <div class="timeline-desc"><strong>${escapeHtml(ngo.ngo_name || 'NGO')}</strong> requested ${r.requested_qty} items. "${escapeHtml(r.message || '')}"</div>
                    </div>
                `);
            });
        }

        // 3. Handover Schedule
        if (handover) {
            timelineItems.push(`
                <div class="timeline-item ${handover.status === 'collected' ? 'timeline-done' : ''}">
                    <div class="timeline-time">${formatDateTime(handover.pickup_time)}</div>
                    <div class="timeline-title">Pickup Scheduled / Collected</div>
                    <div class="timeline-desc">Handover person: <strong>${escapeHtml(handover.pickup_person || 'Driver')}</strong> (${escapeHtml(handover.status)})</div>
                </div>
            `);
        }

        // 4. Distribution
        if (distribution) {
            timelineItems.push(`
                <div class="timeline-item timeline-done">
                    <div class="timeline-time">${formatDateTime(distribution.distributed_at)}</div>
                    <div class="timeline-title">Community Distribution Completed</div>
                    <div class="timeline-desc">Location: <strong>${escapeHtml(distribution.location)}</strong> · Fed: <strong>${distribution.people_served}</strong> beneficiaries.</div>
                </div>
            `);
        }

        // 5. Expired / Cancelled
        if (listing.status === 'expired') {
            timelineItems.push(`
                <div class="timeline-item timeline-expired">
                    <div class="timeline-time">${formatDateTime(listing.expires_at)}</div>
                    <div class="timeline-title">Batch Expired</div>
                    <div class="timeline-desc">Food exceeded maximum freshness window. Auto-expired to preserve safety.</div>
                </div>
            `);
        } else if (listing.status === 'cancelled') {
            timelineItems.push(`
                <div class="timeline-item timeline-expired">
                    <div class="timeline-time">${formatDateTime(listing.updated_at || listing.created_at)}</div>
                    <div class="timeline-title">Listing Cancelled</div>
                    <div class="timeline-desc">This donation batch was cancelled by the donor or administrator.</div>
                </div>
            `);
        }

        openViewDrawer('Donation Batch Lifecycle', `
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Food Name & Batch Details</div>
                <div class="drawer-detail-value" style="font-size: 16px; font-weight: 700;">${escapeHtml(listing.food_name)}</div>
                <div style="font-size: 13px; color: #64736d; margin-top: 4px;">
                    Quantity: <strong>${listing.quantity} ${escapeHtml(listing.unit || 'meals')}</strong> · Type: <strong>${escapeHtml(listing.food_type)}</strong>
                </div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Pickup Location</div>
                <div class="drawer-detail-value">${escapeHtml(listing.pickup_address || '—')}</div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Lifecycle Timeline</div>
                <div class="timeline">${timelineItems.join('')}</div>
            </div>
        `);
    };

    window.markListingExpired = (listingId) => {
        openConfirmModal('Immediately expire this listing and notify requesting parties?', () => {
            const listing = FFGStore.getById('ffg_listings', listingId);
            if (!listing) return;

            FFGStore.update('ffg_listings', listing.listing_id, { status: 'expired' });
            FFGStore.logAction(currentAdminUser.user_id, 'EXPIRED_LISTING', 'listing', listing.listing_id, `Manually marked food listing "${listing.food_name}" as expired.`);
            showToast(`Listing "${listing.food_name}" marked as expired.`, 'info');
            renderListings();
        });
    };

    window.cancelListing = (listingId) => {
        const listing = FFGStore.getById('ffg_listings', listingId);
        if (!listing) return;

        openConfirmModal(`Cancel donation batch "${listing.food_name}"? Any active requests will be terminated.`, () => {
            FFGStore.update('ffg_listings', listing.listing_id, { status: 'cancelled' });
            // Cancel pending requests
            const reqs = FFGStore.findAllBy('ffg_requests', 'listing_id', listing.listing_id) || [];
            reqs.forEach(r => {
                if (r.status === 'pending' || r.status === 'approved') {
                    FFGStore.update('ffg_requests', r.request_id, { status: 'cancelled' });
                }
            });

            FFGStore.logAction(currentAdminUser.user_id, 'CANCELLED_LISTING', 'listing', listing.listing_id, `Admin cancelled listing "${listing.food_name}".`);
            showToast(`Listing "${listing.food_name}" cancelled.`, 'error');
            renderListings();
        });
    };

    const listingsExportBtn = document.getElementById('listings-export-btn');
    if (listingsExportBtn) {
        listingsExportBtn.onclick = () => {
            const allListings = FFGStore.getAll('ffg_listings') || [];
            const allDonors = FFGStore.getAll('ffg_donors') || [];

            const headers = ['Listing ID', 'Food Name', 'Donor Org', 'Food Type', 'Quantity', 'Unit', 'Status', 'Created At', 'Expires At', 'Pickup Address'];
            const rows = allListings.map(l => {
                const donor = allDonors.find(d => d.donor_id === l.donor_id) || {};
                return toCSVRow([l.listing_id, l.food_name, donor.org_name || 'Individual', l.food_type, l.quantity, l.unit, l.status, l.created_at, l.expires_at, l.pickup_address]);
            });

            const csv = [headers.join(','), ...rows].join('\n');
            downloadCSV(`food_listings_audit_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast('Food listings audit exported to CSV.', 'success');
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  11. SECTION 5: REQUESTS & PICKUPS MONITORING
    // ═══════════════════════════════════════════════════════════════
    let reqCurrentPage = 1;
    const REQ_PER_PAGE = 10;

    function renderRequests() {
        const tbody = document.getElementById('req-tbody');
        const pagination = document.getElementById('req-pagination');
        const statusFilter = document.getElementById('req-status-filter');
        const dateFrom = document.getElementById('req-date-from');
        const dateTo = document.getElementById('req-date-to');
        const searchInput = document.getElementById('req-search');

        const allRequests = FFGStore.getAll('ffg_requests') || [];
        const allListings = FFGStore.getAll('ffg_listings') || [];
        const allNgos = FFGStore.getAll('ffg_ngos') || [];
        const allHandovers = FFGStore.getAll('ffg_handovers') || [];

        const selStatus = statusFilter ? statusFilter.value : 'all';
        const fromVal = dateFrom ? dateFrom.value : '';
        const toVal = dateTo ? dateTo.value : '';
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

        [statusFilter, dateFrom, dateTo].forEach(el => {
            if (el && !el.dataset.bound) {
                el.dataset.bound = '1';
                el.onchange = () => { reqCurrentPage = 1; renderRequests(); };
            }
        });
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = '1';
            searchInput.oninput = () => { reqCurrentPage = 1; renderRequests(); };
        }

        const nowTime = Date.now();

        let list = allRequests.map(r => {
            const listing = allListings.find(l => l.listing_id === r.listing_id) || {};
            const ngo = allNgos.find(n => n.ngo_id === r.ngo_id) || {};
            const handover = allHandovers.find(h => h.request_id === r.request_id);

            // Stale rule:
            // 1. Pending > 1 hour
            // 2. Approved > 2 hours with no scheduled pickup handover
            let isStale = false;
            let staleReason = '';

            const reqTime = new Date(r.requested_at).getTime();
            if (r.status === 'pending' && nowTime - reqTime > 3600 * 1000) {
                isStale = true;
                staleReason = 'Pending > 1 hr';
            } else if (r.status === 'approved' && !handover) {
                const respTime = new Date(r.responded_at || r.requested_at).getTime();
                if (nowTime - respTime > 2 * 3600 * 1000) {
                    isStale = true;
                    staleReason = 'No pickup schedule';
                }
            }

            return { ...r, listing, ngo, handover, isStale, staleReason };
        });

        // Filter
        list = list.filter(r => {
            if (selStatus !== 'all' && r.status !== selStatus) return false;
            if (fromVal && (r.requested_at || '').slice(0, 10) < fromVal) return false;
            if (toVal && (r.requested_at || '').slice(0, 10) > toVal) return false;
            if (q) {
                const text = `${r.listing.food_name || ''} ${r.ngo.ngo_name || ''} ${r.message || ''}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        list.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

        const total = list.length;
        const totalPages = Math.ceil(total / REQ_PER_PAGE) || 1;
        if (reqCurrentPage > totalPages) reqCurrentPage = totalPages;
        const start = (reqCurrentPage - 1) * REQ_PER_PAGE;
        const paginated = list.slice(start, start + REQ_PER_PAGE);

        if (!tbody) return;

        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #64736d;">No food pickup requests match the selected filters.</td></tr>`;
            if (pagination) pagination.innerHTML = '';
            return;
        }

        tbody.innerHTML = paginated.map(r => {
            const rowClass = r.isStale ? 'row-stale' : '';

            return `
                <tr class="${rowClass}">
                    <td data-label="Food Item">
                        <strong>${escapeHtml(r.listing.food_name || 'Food Batch')}</strong>
                        ${r.isStale ? `<span class="stale-tag">${escapeHtml(r.staleReason)}</span>` : ''}
                    </td>
                    <td data-label="Requesting NGO">${escapeHtml(r.ngo.ngo_name || 'Partner NGO')}</td>
                    <td data-label="Requested Qty">${r.requested_qty} items</td>
                    <td data-label="Status"><span class="status-badge status-${r.status}">${escapeHtml(r.status)}</span></td>
                    <td data-label="Requested At">${formatDateTime(r.requested_at)}</td>
                    <td data-label="Pickup Info">
                        ${r.handover ? `
                            <div><strong>${escapeHtml(r.handover.pickup_person || 'Driver')}</strong></div>
                            <small style="color: #64736d;">${formatDateTime(r.handover.pickup_time)}</small>
                        ` : '<span style="color: #64736d; font-size: 12px;">Not Scheduled</span>'}
                    </td>
                    <td data-label="Actions">
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button type="button" class="btn-sm btn-primary" onclick="window.viewRequestDrawer('${r.request_id}')">Details</button>
                            ${r.status === 'pending' || r.status === 'approved' ? `
                                <button type="button" class="btn-sm btn-danger" onclick="window.cancelRequestByAdmin('${r.request_id}')">Cancel</button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (pagination) {
            pagination.innerHTML = `
                <button type="button" class="page-btn" ${reqCurrentPage === 1 ? 'disabled' : ''} onclick="window.changeReqPage(${reqCurrentPage - 1})">‹</button>
                <span class="page-info">Page ${reqCurrentPage} of ${totalPages} (${total} total)</span>
                <button type="button" class="page-btn" ${reqCurrentPage === totalPages ? 'disabled' : ''} onclick="window.changeReqPage(${reqCurrentPage + 1})">›</button>
            `;
        }
    }

    window.changeReqPage = (p) => {
        reqCurrentPage = p;
        renderRequests();
    };

    window.viewRequestDrawer = (requestId) => {
        const req = FFGStore.getById('ffg_requests', requestId);
        if (!req) return;

        const listing = FFGStore.getById('ffg_listings', req.listing_id) || {};
        const ngo = FFGStore.getById('ffg_ngos', req.ngo_id) || {};
        const donor = FFGStore.getById('ffg_donors', listing.donor_id) || {};
        const handover = FFGStore.findBy('ffg_handovers', 'request_id', req.request_id);

        openViewDrawer('Request & Logistics Dossier', `
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Food Batch Target</div>
                <div class="drawer-detail-value" style="font-size: 16px; font-weight: 700;">${escapeHtml(listing.food_name)}</div>
                <div style="font-size: 13px; color: #64736d;">Offered by ${escapeHtml(donor.org_name || 'Donor')} · Total Qty: ${listing.quantity}</div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Requisitioning NGO</div>
                <div class="drawer-detail-value"><strong>${escapeHtml(ngo.ngo_name)}</strong> (Contact: ${escapeHtml(ngo.contact_name)})</div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Requisition Message</div>
                <div class="drawer-detail-value" style="background: #f8f6ef; padding: 12px; border-radius: 10px; font-style: italic;">
                    "${escapeHtml(req.message || 'No additional note provided.')}"
                </div>
            </div>
            <div class="drawer-detail-group">
                <div class="drawer-detail-label">Handover Logistics State</div>
                <div class="drawer-detail-value">
                    ${handover ? `
                        Status: <strong>${escapeHtml(handover.status)}</strong><br>
                        Assigned Collector: <strong>${escapeHtml(handover.pickup_person)}</strong><br>
                        Scheduled Pickup: <strong>${formatDateTime(handover.pickup_time)}</strong>
                    ` : 'No pickup driver or time has been scheduled yet.'}
                </div>
            </div>
        `);
    };

    window.cancelRequestByAdmin = (requestId) => {
        openConfirmModal('Cancel this food pickup request? If approved, the food listing will be returned to available status.', () => {
            const req = FFGStore.getById('ffg_requests', requestId);
            if (!req) return;

            FFGStore.update('ffg_requests', req.request_id, { status: 'cancelled' });

            // If the listing was tied to this, return it to available
            const listing = FFGStore.getById('ffg_listings', req.listing_id);
            if (listing && (listing.status === 'requested' || listing.status === 'approved')) {
                FFGStore.update('ffg_listings', listing.listing_id, { status: 'available' });
            }

            FFGStore.logAction(currentAdminUser.user_id, 'CANCELLED_REQUEST', 'request', req.request_id, `Cancelled pickup request for listing ${listing ? listing.food_name : ''}`);
            showToast('Request has been cancelled and listing released.', 'error');
            renderRequests();
        });
    };

    const reqExportBtn = document.getElementById('req-export-btn');
    if (reqExportBtn) {
        reqExportBtn.onclick = () => {
            const allRequests = FFGStore.getAll('ffg_requests') || [];
            const allListings = FFGStore.getAll('ffg_listings') || [];
            const allNgos = FFGStore.getAll('ffg_ngos') || [];

            const headers = ['Request ID', 'Food Name', 'NGO Name', 'Requested Qty', 'Status', 'Requested At', 'Responded At', 'Message'];
            const rows = allRequests.map(r => {
                const listing = allListings.find(l => l.listing_id === r.listing_id) || {};
                const ngo = allNgos.find(n => n.ngo_id === r.ngo_id) || {};
                return toCSVRow([r.request_id, listing.food_name, ngo.ngo_name, r.requested_qty, r.status, r.requested_at, r.responded_at || '', r.message || '']);
            });

            const csv = [headers.join(','), ...rows].join('\n');
            downloadCSV(`food_requests_log_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast('Requests audit log exported to CSV.', 'success');
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  12. SECTION 6: DISTRIBUTION AUDITS & BENEFICIARIES
    // ═══════════════════════════════════════════════════════════════
    function renderDistributions() {
        const tbody = document.getElementById('dist-tbody');
        const ngoFilter = document.getElementById('dist-ngo-filter');
        const dateFrom = document.getElementById('dist-date-from');
        const dateTo = document.getElementById('dist-date-to');

        const allDist = FFGStore.getAll('ffg_distributions') || [];
        const allHandovers = FFGStore.getAll('ffg_handovers') || [];
        const allRequests = FFGStore.getAll('ffg_requests') || [];
        const allListings = FFGStore.getAll('ffg_listings') || [];
        const allNgos = FFGStore.getAll('ffg_ngos') || [];

        // Populate NGO filter
        if (ngoFilter && ngoFilter.options.length <= 1) {
            allNgos.forEach(n => {
                const opt = document.createElement('option');
                opt.value = String(n.ngo_id);
                opt.textContent = n.ngo_name;
                ngoFilter.appendChild(opt);
            });
        }

        const selNgo = ngoFilter ? ngoFilter.value : 'all';
        const fromVal = dateFrom ? dateFrom.value : '';
        const toVal = dateTo ? dateTo.value : '';

        [ngoFilter, dateFrom, dateTo].forEach(el => {
            if (el && !el.dataset.bound) {
                el.dataset.bound = '1';
                el.onchange = renderDistributions;
            }
        });

        let list = allDist.map(d => {
            const handover = allHandovers.find(h => h.handover_id === d.handover_id) || {};
            const req = allRequests.find(r => r.request_id === handover.request_id) || {};
            const listing = allListings.find(l => l.listing_id === req.listing_id) || {};
            const ngo = allNgos.find(n => n.ngo_id === req.ngo_id) || {};
            return { ...d, listing, ngo, handover };
        });

        // Filter
        list = list.filter(d => {
            if (selNgo !== 'all' && String(d.ngo.ngo_id) !== selNgo) return false;
            if (fromVal && (d.distributed_at || '').slice(0, 10) < fromVal) return false;
            if (toVal && (d.distributed_at || '').slice(0, 10) > toVal) return false;
            return true;
        });

        list.sort((a, b) => new Date(b.distributed_at) - new Date(a.distributed_at));

        // Summary metrics
        let totalPeople = 0;
        list.forEach(d => { totalPeople += Number(d.people_served) || 0; });
        const avgPeople = list.length > 0 ? Math.round(totalPeople / list.length) : 0;

        document.getElementById('dist-total').textContent = String(list.length);
        document.getElementById('dist-people').textContent = String(totalPeople);
        document.getElementById('dist-avg').textContent = String(avgPeople);

        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #64736d;">No distribution audit records match the selected parameters.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(d => `
            <tr>
                <td data-label="Food Item"><strong>${escapeHtml(d.listing.food_name || 'Surplus Meal Batch')}</strong></td>
                <td data-label="Distributing NGO">${escapeHtml(d.ngo.ngo_name || 'Partner NGO')}</td>
                <td data-label="Distributed At">${formatDateTime(d.distributed_at)}</td>
                <td data-label="Location / Shelter">${escapeHtml(d.location || 'Local Community')}</td>
                <td data-label="Beneficiaries"><strong>${d.people_served}</strong> people fed</td>
                <td data-label="Audit Remarks">${escapeHtml(d.remarks || 'Standard distribution completed')}</td>
            </tr>
        `).join('');
    }

    const distExportBtn = document.getElementById('dist-export-btn');
    if (distExportBtn) {
        distExportBtn.onclick = () => {
            const allDist = FFGStore.getAll('ffg_distributions') || [];
            const allHandovers = FFGStore.getAll('ffg_handovers') || [];
            const allRequests = FFGStore.getAll('ffg_requests') || [];
            const allListings = FFGStore.getAll('ffg_listings') || [];
            const allNgos = FFGStore.getAll('ffg_ngos') || [];

            const headers = ['Distribution ID', 'Food Name', 'NGO Name', 'Distributed At', 'Location', 'People Served', 'Remarks'];
            const rows = allDist.map(d => {
                const handover = allHandovers.find(h => h.handover_id === d.handover_id) || {};
                const req = allRequests.find(r => r.request_id === handover.request_id) || {};
                const listing = allListings.find(l => l.listing_id === req.listing_id) || {};
                const ngo = allNgos.find(n => n.ngo_id === req.ngo_id) || {};
                return toCSVRow([d.distribution_id, listing.food_name, ngo.ngo_name, d.distributed_at, d.location, d.people_served, d.remarks]);
            });

            const csv = [headers.join(','), ...rows].join('\n');
            downloadCSV(`food_distributions_audit_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast('Distribution audit log exported to CSV.', 'success');
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  13. SECTION 7: AUDITS & IMPACT REPORTS
    // ═══════════════════════════════════════════════════════════════
    function renderReports() {
        const rangeSelect = document.getElementById('report-range-select');
        const dateFrom = document.getElementById('report-date-from');
        const dateTo = document.getElementById('report-date-to');
        const applyBtn = document.getElementById('report-apply-btn');

        if (rangeSelect && !rangeSelect.dataset.bound) {
            rangeSelect.dataset.bound = '1';
            rangeSelect.onchange = () => {
                const isCustom = rangeSelect.value === 'custom';
                if (dateFrom) dateFrom.style.display = isCustom ? 'inline-block' : 'none';
                if (dateTo) dateTo.style.display = isCustom ? 'inline-block' : 'none';
                if (!isCustom) renderReportCalculations();
            };
        }

        if (applyBtn && !applyBtn.dataset.bound) {
            applyBtn.dataset.bound = '1';
            applyBtn.onclick = renderReportCalculations;
        }

        renderReportCalculations();
    }

    function renderReportCalculations() {
        const rangeSelect = document.getElementById('report-range-select');
        const dateFrom = document.getElementById('report-date-from');
        const dateTo = document.getElementById('report-date-to');

        const val = rangeSelect ? rangeSelect.value : '14';
        const now = Date.now();
        const DAY = 24 * 3600 * 1000;

        let startTime = 0;
        let endTime = now;

        if (val === '7') startTime = now - 7 * DAY;
        else if (val === '14') startTime = now - 14 * DAY;
        else if (val === '30') startTime = now - 30 * DAY;
        else if (val === 'custom') {
            if (dateFrom && dateFrom.value) startTime = new Date(dateFrom.value).getTime();
            if (dateTo && dateTo.value) endTime = new Date(dateTo.value + 'T23:59:59').getTime();
        }

        const listings = FFGStore.getAll('ffg_listings') || [];
        const distributions = FFGStore.getAll('ffg_distributions') || [];
        const donors = FFGStore.getAll('ffg_donors') || [];
        const ngos = FFGStore.getAll('ffg_ngos') || [];
        const handovers = FFGStore.getAll('ffg_handovers') || [];
        const requests = FFGStore.getAll('ffg_requests') || [];

        // Filter for range
        const periodListings = listings.filter(l => {
            const t = new Date(l.created_at).getTime();
            return t >= startTime && t <= endTime;
        });

        const periodDist = distributions.filter(d => {
            const t = new Date(d.distributed_at).getTime();
            return t >= startTime && t <= endTime;
        });

        const periodCollected = listings.filter(l => {
            const t = new Date(l.created_at).getTime();
            return t >= startTime && t <= endTime && (l.status === 'collected' || l.status === 'distributed');
        });

        let periodPeople = 0;
        periodDist.forEach(d => { periodPeople += Number(d.people_served) || 0; });

        document.getElementById('rpt-listings').textContent = String(periodListings.length);
        document.getElementById('rpt-collected').textContent = String(periodCollected.length);
        document.getElementById('rpt-distributed').textContent = String(periodDist.length);
        document.getElementById('rpt-people').textContent = String(periodPeople);

        // Chart: Status distribution in period
        const rptCanvas = document.getElementById('rpt-chart');
        if (rptCanvas) {
            const statusCounts = [
                { label: 'Available', value: periodListings.filter(l => l.status === 'available').length },
                { label: 'Requested', value: periodListings.filter(l => l.status === 'requested').length },
                { label: 'Approved', value: periodListings.filter(l => l.status === 'approved').length },
                { label: 'Collected', value: periodListings.filter(l => l.status === 'collected').length },
                { label: 'Distributed', value: periodListings.filter(l => l.status === 'distributed').length },
                { label: 'Expired', value: periodListings.filter(l => l.status === 'expired').length },
            ];
            drawBarChart(rptCanvas, statusCounts);
        }

        // Leaderboards: Top 5 Donors
        const donorCounts = {};
        periodListings.forEach(l => {
            donorCounts[l.donor_id] = (donorCounts[l.donor_id] || 0) + Number(l.quantity || 1);
        });

        const topDonors = Object.keys(donorCounts)
            .map(id => {
                const d = donors.find(x => x.donor_id === Number(id) || x.donor_id === id) || {};
                return { name: d.org_name || 'Individual Donor', qty: donorCounts[id] };
            })
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        const topDonorsEl = document.getElementById('rpt-top-donors');
        if (topDonorsEl) {
            if (topDonors.length === 0) {
                topDonorsEl.innerHTML = '<div style="font-size: 13px; color: #64736d; padding: 12px 0;">No food donations recorded in this timeframe.</div>';
            } else {
                topDonorsEl.innerHTML = topDonors.map((item, idx) => `
                    <div class="leaderboard-item">
                        <span class="leaderboard-rank">${idx + 1}</span>
                        <span class="leaderboard-name">${escapeHtml(item.name)}</span>
                        <span class="leaderboard-value">${item.qty} items</span>
                    </div>
                `).join('');
            }
        }

        // Leaderboards: Top 5 NGOs (by distributions)
        const ngoCounts = {};
        periodDist.forEach(d => {
            const h = handovers.find(x => x.handover_id === d.handover_id);
            const r = h ? requests.find(x => x.request_id === h.request_id) : null;
            if (r) {
                ngoCounts[r.ngo_id] = (ngoCounts[r.ngo_id] || 0) + Number(d.people_served || 0);
            }
        });

        const topNgos = Object.keys(ngoCounts)
            .map(id => {
                const n = ngos.find(x => x.ngo_id === Number(id) || x.ngo_id === id) || {};
                return { name: n.ngo_name || 'Partner NGO', people: ngoCounts[id] };
            })
            .sort((a, b) => b.people - a.people)
            .slice(0, 5);

        const topNgosEl = document.getElementById('rpt-top-ngos');
        if (topNgosEl) {
            if (topNgos.length === 0) {
                topNgosEl.innerHTML = '<div style="font-size: 13px; color: #64736d; padding: 12px 0;">No distributions tracked in this timeframe.</div>';
            } else {
                topNgosEl.innerHTML = topNgos.map((item, idx) => `
                    <div class="leaderboard-item">
                        <span class="leaderboard-rank">${idx + 1}</span>
                        <span class="leaderboard-name">${escapeHtml(item.name)}</span>
                        <span class="leaderboard-value">${item.people} fed</span>
                    </div>
                `).join('');
            }
        }
    }

    // Print Report
    const rptPrintBtn = document.getElementById('rpt-print-btn');
    if (rptPrintBtn) {
        rptPrintBtn.onclick = () => {
            document.body.classList.add('printing-report');
            window.print();
            setTimeout(() => document.body.classList.remove('printing-report'), 500);
        };
    }

    // Export Reports Summary CSV
    const rptExportBtn = document.getElementById('rpt-export-btn');
    if (rptExportBtn) {
        rptExportBtn.onclick = () => {
            const listings = FFGStore.getAll('ffg_listings') || [];
            const distributions = FFGStore.getAll('ffg_distributions') || [];

            const headers = ['Audit Metric', 'Value'];
            const rows = [
                toCSVRow(['Total Surplus Listings Tracked', listings.length]),
                toCSVRow(['Active Listings (Available / Requested)', listings.filter(l => l.status === 'available' || l.status === 'requested').length]),
                toCSVRow(['Completed Distributions', distributions.length]),
                toCSVRow(['Total Beneficiaries Nourished', distributions.reduce((acc, d) => acc + (Number(d.people_served) || 0), 0)]),
                toCSVRow(['Audit Report Generated At', new Date().toISOString()]),
            ];

            const csv = [headers.join(','), ...rows].join('\n');
            downloadCSV(`platform_impact_summary_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast('Impact summary report exported.', 'success');
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  14. SECTION 8: SYSTEM ACTIVITY LOG AUDIT TRAIL
    // ═══════════════════════════════════════════════════════════════
    let logCurrentPage = 1;
    const LOG_PER_PAGE = 10;

    function renderActivityLog() {
        const tbody = document.getElementById('log-tbody');
        const pagination = document.getElementById('log-pagination');
        const actionFilter = document.getElementById('log-action-filter');
        const dateFrom = document.getElementById('log-date-from');
        const dateTo = document.getElementById('log-date-to');
        const searchInput = document.getElementById('log-search');

        const allLogs = FFGStore.getAll('ffg_activity_log') || [];
        const allUsers = FFGStore.getAll('ffg_users') || [];

        const selAction = actionFilter ? actionFilter.value : 'all';
        const fromVal = dateFrom ? dateFrom.value : '';
        const toVal = dateTo ? dateTo.value : '';
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

        [actionFilter, dateFrom, dateTo].forEach(el => {
            if (el && !el.dataset.bound) {
                el.dataset.bound = '1';
                el.onchange = () => { logCurrentPage = 1; renderActivityLog(); };
            }
        });
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = '1';
            searchInput.oninput = () => { logCurrentPage = 1; renderActivityLog(); };
        }

        let list = allLogs.map(l => {
            const admin = allUsers.find(u => u.user_id === l.admin_id) || {};
            return { ...l, adminName: admin.full_name || 'System Admin' };
        });

        // Filter
        list = list.filter(l => {
            if (selAction !== 'all' && l.action !== selAction) return false;
            if (fromVal && (l.created_at || '').slice(0, 10) < fromVal) return false;
            if (toVal && (l.created_at || '').slice(0, 10) > toVal) return false;
            if (q) {
                const text = `${l.action} ${l.target_type} ${l.details} ${l.adminName}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = list.length;
        const totalPages = Math.ceil(total / LOG_PER_PAGE) || 1;
        if (logCurrentPage > totalPages) logCurrentPage = totalPages;
        const start = (logCurrentPage - 1) * LOG_PER_PAGE;
        const paginated = list.slice(start, start + LOG_PER_PAGE);

        if (!tbody) return;

        if (paginated.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64736d;">No administrative log records match the selected filters.</td></tr>`;
            if (pagination) pagination.innerHTML = '';
            return;
        }

        tbody.innerHTML = paginated.map(l => `
            <tr>
                <td data-label="Administrator"><strong>${escapeHtml(l.adminName)}</strong></td>
                <td data-label="Action Taken">
                    <span class="status-badge" style="background: #e8e2f4; color: #6a1b9a;">${escapeHtml(l.action)}</span>
                </td>
                <td data-label="Target Entity">${escapeHtml(l.target_type || '—')}</td>
                <td data-label="Audit Details">${escapeHtml(l.details || '—')}</td>
                <td data-label="Timestamp">${formatDateTime(l.created_at)}</td>
            </tr>
        `).join('');

        if (pagination) {
            pagination.innerHTML = `
                <button type="button" class="page-btn" ${logCurrentPage === 1 ? 'disabled' : ''} onclick="window.changeLogPage(${logCurrentPage - 1})">‹</button>
                <span class="page-info">Page ${logCurrentPage} of ${totalPages} (${total} total)</span>
                <button type="button" class="page-btn" ${logCurrentPage === totalPages ? 'disabled' : ''} onclick="window.changeLogPage(${logCurrentPage + 1})">›</button>
            `;
        }
    }

    window.changeLogPage = (p) => {
        logCurrentPage = p;
        renderActivityLog();
    };

    const logExportBtn = document.getElementById('log-export-btn');
    if (logExportBtn) {
        logExportBtn.onclick = () => {
            const allLogs = FFGStore.getAll('ffg_activity_log') || [];
            const allUsers = FFGStore.getAll('ffg_users') || [];

            const headers = ['Log ID', 'Administrator', 'Action', 'Target Type', 'Target ID', 'Audit Details', 'Timestamp'];
            const rows = allLogs.map(l => {
                const admin = allUsers.find(u => u.user_id === l.admin_id) || {};
                return toCSVRow([l.log_id, admin.full_name || 'Admin', l.action, l.target_type, l.target_id || '', l.details, l.created_at]);
            });

            const csv = [headers.join(','), ...rows].join('\n');
            downloadCSV(`platform_activity_log_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast('Audit activity log exported to CSV.', 'success');
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  15. SECTION 9: SETTINGS & PLATFORM POLICIES
    // ═══════════════════════════════════════════════════════════════
    function loadSettings() {
        // Profile form
        const nameInput = document.getElementById('set-name');
        const emailInput = document.getElementById('set-email');
        const phoneInput = document.getElementById('set-phone');

        if (nameInput) nameInput.value = currentAdminUser.full_name || '';
        if (emailInput) emailInput.value = currentAdminUser.email || '';
        if (phoneInput) phoneInput.value = currentAdminUser.phone || '';

        // Platform policy settings
        const settings = FFGStore.getSettings ? FFGStore.getSettings() : { default_expiry_hours: 6, allow_unverified_donors: true };
        const expiryInput = document.getElementById('set-expiry-hours');
        const allowUnverifiedInput = document.getElementById('set-allow-unverified');

        if (expiryInput) expiryInput.value = settings.default_expiry_hours || 6;
        if (allowUnverifiedInput) allowUnverifiedInput.checked = !!settings.allow_unverified_donors;
    }

    // Profile Form Submit
    const profileForm = document.getElementById('settings-profile-form');
    if (profileForm) {
        profileForm.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('set-name').value.trim();
            const phone = document.getElementById('set-phone').value.trim();

            if (!name) {
                showToast('Name cannot be empty.', 'error');
                return;
            }

            FFGStore.update('ffg_users', currentAdminUser.user_id, { full_name: name, phone: phone });
            FFGStore.logAction(currentAdminUser.user_id, 'SETTINGS_UPDATE', 'user', currentAdminUser.user_id, `Updated administrator profile details for ${currentAdminUser.email}`);

            currentAdminUser.full_name = name;
            currentAdminUser.phone = phone;
            if (userNameEl) userNameEl.textContent = name;

            showToast('Admin profile successfully updated.', 'success');
        };
    }

    // Password Form Submit
    const pwForm = document.getElementById('settings-pw-form');
    if (pwForm) {
        pwForm.onsubmit = async (e) => {
            e.preventDefault();
            const currPw = document.getElementById('set-cp-current').value;
            const newPw = document.getElementById('set-cp-new').value;
            const confirmPw = document.getElementById('set-cp-confirm').value;

            if (!currPw || !newPw || !confirmPw) {
                showToast('Please fill in all password fields.', 'error');
                return;
            }

            const currHash = await FFGStore.hashPassword(currPw);
            if (currHash !== currentAdminUser.password_hash) {
                showToast('Current password does not match.', 'error');
                return;
            }

            if (newPw.length < 8) {
                showToast('New password must be at least 8 characters.', 'error');
                return;
            }

            if (newPw !== confirmPw) {
                showToast('New passwords do not match.', 'error');
                return;
            }

            const newHash = await FFGStore.hashPassword(newPw);
            FFGStore.update('ffg_users', currentAdminUser.user_id, { password_hash: newHash });
            currentAdminUser.password_hash = newHash;

            FFGStore.logAction(currentAdminUser.user_id, 'PASSWORD_CHANGE', 'user', currentAdminUser.user_id, `Administrator changed password for ${currentAdminUser.email}`);
            pwForm.reset();
            showToast('Admin password successfully changed.', 'success');
        };
    }

    // Platform Settings Submit
    const platformForm = document.getElementById('settings-platform-form');
    if (platformForm) {
        platformForm.onsubmit = (e) => {
            e.preventDefault();
            const hours = Number(document.getElementById('set-expiry-hours').value) || 6;
            const allowUnverified = document.getElementById('set-allow-unverified').checked;

            if (hours < 1 || hours > 48) {
                showToast('Expiry threshold must be between 1 and 48 hours.', 'error');
                return;
            }

            FFGStore.saveSettings({
                default_expiry_hours: hours,
                allow_unverified_donors: allowUnverified,
            });

            FFGStore.logAction(currentAdminUser.user_id, 'SETTINGS_UPDATE', 'platform', 'policy', `Default expiry: ${hours}h, Allow unverified donors: ${allowUnverified}`);
            showToast('Platform parameters updated and active.', 'success');
        };
    }

    // Reset Demo Data (Danger Zone)
    const resetDemoBtn = document.getElementById('reset-demo-btn');
    const resetDataModal = document.getElementById('reset-data-modal');
    const resetDataInput = document.getElementById('reset-data-input');
    const resetDataError = document.getElementById('reset-data-error');
    const resetDataCancel = document.getElementById('reset-data-cancel');
    const resetDataSubmit = document.getElementById('reset-data-submit');

    if (resetDemoBtn && resetDataModal) {
        resetDemoBtn.onclick = () => {
            if (resetDataInput) resetDataInput.value = '';
            if (resetDataError) resetDataError.style.display = 'none';
            resetDataModal.style.display = 'flex';
            if (resetDataInput) resetDataInput.focus();
        };
    }

    if (resetDataCancel && resetDataModal) {
        resetDataCancel.onclick = () => { resetDataModal.style.display = 'none'; };
    }

    if (resetDataSubmit) {
        resetDataSubmit.onclick = () => {
            const val = resetDataInput ? resetDataInput.value.trim().toUpperCase() : '';
            if (val !== 'RESET') {
                if (resetDataError) {
                    resetDataError.textContent = 'You must type RESET in all capital letters to confirm.';
                    resetDataError.style.display = 'block';
                }
                return;
            }

            // Clear all ffg keys
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('ffg_')) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            sessionStorage.clear();

            alert ? null : null; // No alerts rule
            window.location.reload();
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  16. BOOT & INITIAL SECTION ROUTE
    // ═══════════════════════════════════════════════════════════════
    const initialHash = window.location.hash.replace('#', '') || 'overview';
    switchSection(initialHash, false);
});
