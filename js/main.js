'use strict';

/* ── Mobile Navigation ── */
(function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMobile');
  const overlay = document.getElementById('navOverlay');

  function closeMenu() {
    menu.classList.remove('open');
    overlay.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    overlay.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  overlay.addEventListener('click', closeMenu);

  menu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', closeMenu);
  });
})();

/* ── Clipboard ── */
const INSTALL_ONE_LINER =
  'curl -fsSL https://gitops-ai.vercel.app/install | bash';

function copyCommand(cmd) {
  const text =
    typeof cmd === 'string' && cmd.length > 0 ? cmd : INSTALL_ONE_LINER;
  navigator.clipboard.writeText(text);
  const tooltip = document.getElementById('copiedTooltip');
  tooltip.classList.add('show');
  setTimeout(() => tooltip.classList.remove('show'), 2000);
}

/* ── Scroll-triggered fade-up ── */
const scrollObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
      }
    });
  },
  { threshold: 0.1 },
);

document
  .querySelectorAll('.step-card, .feature-card, .component-card, .ai-tool')
  .forEach((el) => {
    el.style.opacity = '0';
    el.style.animation = 'fadeUp 0.5s ease forwards';
    el.style.animationPlayState = 'paused';
    scrollObserver.observe(el);
  });

/* ── Docs Viewer ── */
const GITHUB_REPO = 'GitOpsAI/gitops-ai-bootstrapper';
const GITHUB_BRANCH = 'main';

const DOCS_MAP = {
  prerequisites: { path: 'docs/prerequisites.md', title: 'Prerequisites' },
  bootstrap: { path: 'docs/bootstrap.md', title: 'Bootstrap Walkthrough' },
  architecture: { path: 'docs/architecture.md', title: 'Architecture' },
  configuration: { path: 'docs/configuration.md', title: 'Configuration' },
  'template-sync': { path: 'docs/template-sync.md', title: 'Template Synchronization' },
  scaling: { path: 'docs/scaling.md', title: 'Scaling' },
  security: { path: 'docs/security.md', title: 'Security Model' },
};

const docsCache = {};
let mermaidInitialized = false;

function githubRawUrl(filePath) {
  return `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
}

function githubBlobUrl(filePath) {
  return `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`;
}

async function fetchDoc(docId) {
  if (docsCache[docId]) return docsCache[docId];

  const info = DOCS_MAP[docId];
  if (!info) throw new Error(`Unknown doc: ${docId}`);

  const res = await fetch(githubRawUrl(info.path));
  if (!res.ok) {
    throw new Error(
      `GitHub returned ${res.status}. The repository may be private or the file path may have changed.`,
    );
  }

  const text = await res.text();
  docsCache[docId] = text;
  return text;
}

function renderMarkdown(md) {
  const renderer = new marked.Renderer();

  renderer.code = function (codeObj) {
    const text = typeof codeObj === 'object' ? codeObj.text : codeObj;
    const lang = typeof codeObj === 'object' ? codeObj.lang : arguments[1];

    if (lang === 'mermaid') {
      return `<div class="mermaid-container"><pre class="mermaid">${text}</pre></div>`;
    }

    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre><code>${escaped}</code></pre>`;
  };

  renderer.link = function (linkObj) {
    const href = typeof linkObj === 'object' ? linkObj.href : linkObj;
    const text = typeof linkObj === 'object' ? linkObj.text : arguments[1];

    if (href && href.endsWith('.md') && !href.startsWith('http')) {
      const docId = href
        .replace(/^.*\//, '')
        .replace('.md', '')
        .replace(/#.*/, '');
      if (DOCS_MAP[docId]) {
        return `<a href="#docs/${docId}" onclick="loadDoc(event, '${docId}')">${text}</a>`;
      }
    }

    const isExternal = href && href.startsWith('http');
    const attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${attrs}>${text}</a>`;
  };

  marked.setOptions({ renderer, gfm: true, breaks: false });
  return marked.parse(md);
}

async function renderMermaidDiagrams() {
  const containers = document.querySelectorAll('#docsContentInner .mermaid');
  if (containers.length === 0) return;

  if (!mermaidInitialized && typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#18181b',
        primaryColor: '#6366f1',
        primaryTextColor: '#fafafa',
        primaryBorderColor: '#27272a',
        lineColor: '#a1a1aa',
        secondaryColor: '#1e1e22',
        tertiaryColor: '#09090b',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
      },
      flowchart: { htmlLabels: true, curve: 'basis' },
    });
    mermaidInitialized = true;
  }

  try {
    await mermaid.run({ nodes: containers });
  } catch (e) {
    console.warn('Mermaid render error:', e);
  }
}

async function showDoc(docId) {
  const inner = document.getElementById('docsContentInner');
  const content = document.getElementById('docsContent');

  inner.innerHTML =
    '<div class="docs-loading"><div class="spinner"></div>Loading documentation...</div>';
  content.scrollTop = 0;

  document.querySelectorAll('.docs-sidebar a[data-doc]').forEach((a) => {
    a.classList.toggle('active', a.dataset.doc === docId);
  });

  const info = DOCS_MAP[docId];
  if (info) {
    document.getElementById('docsGithubLink').href = githubBlobUrl(info.path);
  }

  try {
    const md = await fetchDoc(docId);
    const html = renderMarkdown(md);
    inner.innerHTML = `<div class="md-content">${html}</div>`;
    await renderMermaidDiagrams();
  } catch (err) {
    inner.innerHTML = `<div class="docs-error">
      <strong>Failed to load documentation</strong><br><br>
      ${err.message}<br><br>
      You can view the docs directly on
      <a href="${githubBlobUrl(info?.path || 'docs/')}" target="_blank" rel="noopener">GitHub</a>.
    </div>`;
  }
}

function openDocs(e, docId) {
  if (e) e.preventDefault();
  document.getElementById('docsOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  window.location.hash = `docs/${docId}`;
  showDoc(docId);
}

function closeDocs(e) {
  if (e) e.preventDefault();
  closeDocsSidebar();
  document.getElementById('docsOverlay').classList.remove('active');
  document.body.style.overflow = '';
  history.pushState(null, '', window.location.pathname);
}

function toggleDocsSidebar() {
  const sidebar = document.querySelector('.docs-sidebar');
  const overlay = document.getElementById('docsSidebarOverlay');
  const btn = document.getElementById('docsMenuBtn');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', String(isOpen));
}

function closeDocsSidebar() {
  const sidebar = document.querySelector('.docs-sidebar');
  const overlay = document.getElementById('docsSidebarOverlay');
  const btn = document.getElementById('docsMenuBtn');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
}

function loadDoc(e, docId) {
  if (e) e.preventDefault();
  closeDocsSidebar();
  window.location.hash = `docs/${docId}`;
  showDoc(docId);
}

function handleHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#docs/')) {
    const docId = hash.replace('#docs/', '');
    if (DOCS_MAP[docId]) {
      document.getElementById('docsOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
      showDoc(docId);
    }
  } else {
    const overlay = document.getElementById('docsOverlay');
    if (overlay.classList.contains('active')) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
}

window.addEventListener('hashchange', handleHash);
window.addEventListener('DOMContentLoaded', handleHash);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('docsOverlay');
    if (document.querySelector('.docs-sidebar').classList.contains('open')) {
      closeDocsSidebar();
    } else if (overlay.classList.contains('active')) {
      closeDocs();
    }
  }
});

/* ── Latest CLI version from npm registry ── */
const NPM_PACKAGE = 'gitops-ai';
const NPM_LATEST_URL = `https://registry.npmjs.org/${NPM_PACKAGE}/latest`;

async function initNpmVersion() {
  const nodes = document.querySelectorAll('[data-npm-version]');
  if (!nodes.length) return;

  try {
    const res = await fetch(NPM_LATEST_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`npm registry ${res.status}`);
    const data = await res.json();
    const version =
      data && typeof data.version === 'string' ? data.version.trim() : '';
    if (!version || version.length > 128) {
      throw new Error('unexpected version');
    }
    const label = `v${version}`;
    nodes.forEach((el) => {
      el.textContent = label;
      el.removeAttribute('aria-busy');
    });
  } catch {
    nodes.forEach((el) => {
      el.textContent = '';
      el.setAttribute('aria-hidden', 'true');
      const row = el.closest('.npm-cli-version, .nav-npm-pill');
      if (row) row.hidden = true;
    });
  }
}

window.addEventListener('DOMContentLoaded', initNpmVersion);
