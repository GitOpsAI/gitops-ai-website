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
function copyCommand() {
  navigator.clipboard.writeText('npx gitops-ai bootstrap');
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
const GITLAB_PROJECT = 'everythings-gonna-be-alright/gitops_ai_bootstrapper';
const GITLAB_BRANCH = 'main';

const DOCS_MAP = {
  prerequisites: { path: 'docs/prerequisites.md', title: 'Prerequisites' },
  bootstrap: { path: 'docs/bootstrap.md', title: 'Bootstrap Walkthrough' },
  architecture: { path: 'docs/architecture.md', title: 'Architecture' },
  configuration: { path: 'docs/configuration.md', title: 'Configuration' },
};

const docsCache = {};
let mermaidInitialized = false;

function gitlabRawUrl(filePath) {
  const proj = encodeURIComponent(GITLAB_PROJECT);
  const file = encodeURIComponent(filePath);
  return `https://gitlab.com/api/v4/projects/${proj}/repository/files/${file}/raw?ref=${GITLAB_BRANCH}`;
}

function gitlabBlobUrl(filePath) {
  return `https://gitlab.com/${GITLAB_PROJECT}/-/blob/${GITLAB_BRANCH}/${filePath}`;
}

async function fetchDoc(docId) {
  if (docsCache[docId]) return docsCache[docId];

  const info = DOCS_MAP[docId];
  if (!info) throw new Error(`Unknown doc: ${docId}`);

  const res = await fetch(gitlabRawUrl(info.path));
  if (!res.ok) {
    throw new Error(
      `GitLab API returned ${res.status}. The repository may be private or the file path may have changed.`,
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
    document.getElementById('docsGitlabLink').href = gitlabBlobUrl(info.path);
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
      <a href="${gitlabBlobUrl(info?.path || 'docs/')}" target="_blank" rel="noopener">GitLab</a>.
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
  document.getElementById('docsOverlay').classList.remove('active');
  document.body.style.overflow = '';
  history.pushState(null, '', window.location.pathname);
}

function loadDoc(e, docId) {
  if (e) e.preventDefault();
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
  if (
    e.key === 'Escape' &&
    document.getElementById('docsOverlay').classList.contains('active')
  ) {
    closeDocs();
  }
});
