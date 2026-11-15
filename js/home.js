// js/home.js — Homepage interactivity for Food For Good
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // 1. Sticky Navbar shadow after scrolling 20px
  const navbar = document.querySelector('header.navbar');
  window.addEventListener('scroll', () => {
    if (navbar) {
      if (window.scrollY > 20) {
        navbar.classList.add('navbar-scrolled');
      } else {
        navbar.classList.remove('navbar-scrolled');
      }
    }
  }, { passive: true });

  // 2. Mobile Menu (Hamburger)
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    function toggleMenu(open) {
      const isOpen = open !== undefined ? open : !navMenu.classList.contains('nav-open');
      navMenu.classList.toggle('nav-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.textContent = isOpen ? '✕' : '☰';
    }

    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Close when clicking a nav link
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => toggleMenu(false));
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('nav-open')) {
        toggleMenu(false);
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('nav-open') && !navMenu.contains(e.target) && e.target !== navToggle) {
        toggleMenu(false);
      }
    });
  }

  // 3. Smooth scrolling for internal anchors with navbar height offset
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const navHeight = navbar ? navbar.offsetHeight : 80;
        const targetTop = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({
          top: targetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // 4. Highlight active nav link on scroll (IntersectionObserver)
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const currentId = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === '#' + currentId) {
              link.classList.add('nav-link-active');
            } else {
              link.classList.remove('nav-link-active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(s => sectionObserver.observe(s));
  }

  // 5. Scroll-in animations for problem cards, solution cards, steps, user cards
  const animatedElements = document.querySelectorAll(
    '.problem-card, .flow-card, .timeline-item, .user-card, .impact-counter-card'
  );

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (animatedElements.length && 'IntersectionObserver' in window && !prefersReducedMotion) {
    animatedElements.forEach(el => el.classList.add('reveal-on-scroll'));

    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    animatedElements.forEach(el => revealObserver.observe(el));
  }

  // 6. Animated Impact Counters read live from FFGStore
  function getPlatformStats() {
    if (typeof FFGStore === 'undefined') {
      return { listings: 0, collected: 0, donors: 0, ngos: 0 };
    }
    const listings = FFGStore.getAll('ffg_listings') || [];
    const donors = FFGStore.getAll('ffg_donors') || [];
    const ngos = FFGStore.getAll('ffg_ngos') || [];

    const collectedCount = listings.filter(l => l.status === 'collected' || l.status === 'distributed').length;

    return {
      listings: listings.length,
      collected: collectedCount,
      donors: donors.length,
      ngos: ngos.length
    };
  }

  function animateCount(el, target) {
    const duration = 1200;
    const startTime = performance.now();
    const startVal = 0;

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startVal + (target - startVal) * ease);
      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString();
      }
    }

    if (target === 0 || prefersReducedMotion) {
      el.textContent = target.toLocaleString();
    } else {
      requestAnimationFrame(step);
    }
  }

  const countersSection = document.querySelector('.impact-section');
  const counterEls = document.querySelectorAll('[data-counter]');

  if (counterEls.length && 'IntersectionObserver' in window) {
    let countersAnimated = false;
    const stats = getPlatformStats();

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersAnimated) {
          countersAnimated = true;
          counterEls.forEach(el => {
            const key = el.getAttribute('data-counter');
            const targetVal = stats[key] || 0;
            animateCount(el, targetVal);
          });
          counterObserver.disconnect();
        }
      });
    }, { threshold: 0.2 });

    if (countersSection) {
      counterObserver.observe(countersSection);
    } else if (counterEls[0]) {
      counterObserver.observe(counterEls[0]);
    }
  }

  // 7. Back to Top Button
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }, { passive: true });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
});

