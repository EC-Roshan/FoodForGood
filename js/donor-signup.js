// js/donor-signup.js — Donor sign-up logic for Food For Good

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('donor-signup-form');
  const donorTypeSelect = document.getElementById('donor-type');
  const orgWrap = document.getElementById('org-name-wrap');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  const strengthBar = document.getElementById('pw-strength-bar');
  const strengthLabel = document.getElementById('pw-strength-label');
  const matchError = document.getElementById('pw-match-error');
  const msgBox = document.getElementById('signup-message');

  // 1. Hide org-name when donor type is "individual"
  donorTypeSelect.addEventListener('change', () => {
    orgWrap.style.display = donorTypeSelect.value === 'individual' ? 'none' : '';
  });

  // 2. Password strength (live)
  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[a-zA-Z]/.test(val) && /[0-9]/.test(val)) score++;
    if (val.length >= 12) score++;
    const labels = ['', 'Weak', 'Medium', 'Strong'];
    const colors = ['', '#c0392b', '#e67e22', '#174c42'];
    const widths = ['0%', '33%', '66%', '100%'];
    strengthBar.style.width = widths[score] || '0%';
    strengthBar.style.background = colors[score] || 'transparent';
    strengthLabel.textContent = labels[score] || '';
    strengthLabel.style.color = colors[score] || '';
  });

  // 3. Show/hide password toggles (works for any .pw-toggle button)
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

  // 4. Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // a) HTML5 validity
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    const email = document.getElementById('email').value.trim().toLowerCase();

    // b) password must have at least 1 letter and 1 number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      showMessage('Password must contain at least one letter and one number.', 'error');
      return;
    }

    // c) passwords must match
    if (password !== confirmPassword) {
      matchError.style.display = 'block';
      confirmInput.focus();
      return;
    }
    matchError.style.display = 'none';

    // d) check duplicate email
    const existing = FFGStore.findBy('ffg_users', 'email', email);
    if (existing) {
      showMessage('An account with this email already exists.', 'error');
      return;
    }

    // e) save user + donor profile
    const hash = await FFGStore.hashPassword(password);

    const user = FFGStore.insert('ffg_users', {
      full_name: document.getElementById('full-name').value.trim(),
      email: email,
      phone: document.getElementById('phone').value.trim(),
      password_hash: hash,
      role: 'donor',
      status: 'active'
    });

    FFGStore.insert('ffg_donors', {
      user_id: user.user_id,
      donor_type: document.getElementById('donor-type').value,
      org_name: document.getElementById('org-name').value.trim(),
      address: document.getElementById('address').value.trim(),
      city: document.getElementById('city').value.trim(),
      pincode: document.getElementById('pincode').value.trim(),
      fssai_no: document.getElementById('fssai').value.trim()
    });

    // f) show success, redirect after 2s
    showMessage('Account created! Redirecting to login\u2026', 'success');
    setTimeout(() => { window.location.href = 'donor-login.html'; }, 2000);
  });

  function showMessage(text, type) {
    msgBox.textContent = text;
    msgBox.className = 'form-message ' + (type === 'success' ? 'form-message--success' : 'form-message--error');
    msgBox.style.display = 'block';
    msgBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
