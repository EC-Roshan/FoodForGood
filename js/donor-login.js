// js/donor-login.js — Donor login logic for Food For Good

document.addEventListener('DOMContentLoaded', () => {
    // Guard: already logged in?
    const session = FFGStore.getSession();
    if (session && session.role === 'donor') {
        window.location.href = 'donor-dashboard.html';
        return;
    }

    const form = document.getElementById('donor-login-form');
    const errorBox = document.getElementById('login-error');
    const forgotLink = document.getElementById('forgot-link');
    const forgotPanel = document.getElementById('forgot-panel');
    const fpCancel = document.getElementById('fp-cancel');
    const fpSubmit = document.getElementById('fp-submit');

    // Show/hide password toggle
    document.querySelectorAll('.pw-toggle').forEach(btn => {
        if (btn.dataset.pwBound) return;
        btn.dataset.pwBound = 'true';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const inp = document.getElementById(btn.dataset.target);
            if (!inp) return;
            const isPassword = inp.type === 'password';
            inp.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '🙈' : '👁';
            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    });

    // Login submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.style.display = 'none';

        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;

        const hash = await FFGStore.hashPassword(password);
        const user = FFGStore.findBy('ffg_users', 'email', email);

        if (!user || user.password_hash !== hash || user.role !== 'donor') {
            showError('Invalid email or password.');
            return;
        }
        if (user.status === 'blocked') {
            showError('Your account has been blocked. Please contact support.');
            return;
        }

        FFGStore.setSession(user, remember);
        window.location.href = 'donor-dashboard.html';
    });

    // Forgot password toggle
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPanel.style.display = forgotPanel.style.display === 'none' ? 'block' : 'none';
    });
    fpCancel.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPanel.style.display = 'none';
    });

    // Forgot password submit
    // PROTOTYPE ONLY — no real email/SMS verification; replace with server-side token flow when backend is built
    fpSubmit.addEventListener('click', async () => {
        const fpErrorEl = document.getElementById('fp-error');
        const fpSuccessEl = document.getElementById('fp-success');
        fpErrorEl.style.display = 'none';
        fpSuccessEl.style.display = 'none';

        const email = document.getElementById('fp-email').value.trim().toLowerCase();
        const phone = document.getElementById('fp-phone').value.trim();
        const newPw = document.getElementById('fp-new-pw').value;
        const confirmPw = document.getElementById('fp-confirm-pw').value;

        const user = FFGStore.findBy('ffg_users', 'email', email);
        if (!user || user.phone !== phone || user.role !== 'donor') {
            fpErrorEl.textContent = 'No donor account found with that email and phone combination.';
            fpErrorEl.style.display = 'block';
            return;
        }
        if (newPw.length < 8 || !/[a-zA-Z]/.test(newPw) || !/[0-9]/.test(newPw)) {
            fpErrorEl.textContent = 'Password must be at least 8 characters with a letter and a number.';
            fpErrorEl.style.display = 'block';
            return;
        }
        if (newPw !== confirmPw) {
            fpErrorEl.textContent = 'Passwords do not match.';
            fpErrorEl.style.display = 'block';
            return;
        }

        const hash = await FFGStore.hashPassword(newPw);
        FFGStore.update('ffg_users', user.user_id, { password_hash: hash });
        fpSuccessEl.textContent = 'Password reset successfully! You can now log in.';
        fpSuccessEl.style.display = 'block';
        document.getElementById('fp-new-pw').value = '';
        document.getElementById('fp-confirm-pw').value = '';
    });

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    }
});
