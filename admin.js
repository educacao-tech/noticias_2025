const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? ''
    : 'http://localhost:3001';

const Admin = {
    API_URL: `${API_BASE}/api/news`,
    LOGIN_URL: `${API_BASE}/api/login`,
    PASSWORD_URL: `${API_BASE}/api/change-password`,
    USERS_URL: `${API_BASE}/api/users`,
    UPLOAD_URL: `${API_BASE}/api/upload`,

    allNews: [],
    currentGallery: [],
    filteredNews: [],
    currentPage: 1,
    itemsPerPage: 10,
    currentSort: 'date-desc',
    currentCategory: 'all',
    currentStatus: 'all',

    init() {
        this.initTheme();
        this.setupPasswordVisibilityToggles();
        this.setupImagePreview();
        this.setupLivePreview();
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();
        this.setupGalleryUpload();

        const token = localStorage.getItem('auth_token');
        if (token) {
            this.showContent();
            this.loadNews();
            this.setupPasswordStrength();
            this.setupSearch();
            this.setupCSVImport();
        }
    },

    /* ================= Tema Claro / Escuro ================= */
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        this.applyTheme(savedTheme);

        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                this.applyTheme(next);
            });
        }
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        const iconSlot = document.getElementById('theme-icon-slot');
        const textSlot = document.getElementById('theme-text-slot');
        if (iconSlot) iconSlot.textContent = theme === 'dark' ? '☀️' : '🌙';
        if (textSlot) textSlot.textContent = theme === 'dark' ? 'Claro' : 'Escuro';
    },

    /* ================= Autenticação ================= */
    fillDemoCredentials() {
        const u = document.getElementById('username');
        const p = document.getElementById('password');
        if (u) u.value = 'admin';
        if (p) p.value = '123';
        this.showToast('Credenciais preenchidas!', 'info', 2000);
    },

    async login(event) {
        if (event) event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const btnLogin = document.getElementById('btn-login');

        if (!username || !password) {
            this.showToast('Por favor, preencha todos os campos.', 'error');
            return;
        }

        if (btnLogin) {
            btnLogin.disabled = true;
            btnLogin.textContent = 'Acessando...';
        }

        try {
            const response = await fetch(this.LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_username', data.username || username);

                this.showContent();
                await this.loadNews();
                this.setupPasswordStrength();
                this.setupSearch();
                this.setupCSVImport();
                this.showToast(`Bem-vindo(a), ${username}!`, 'success');
            } else {
                let msg = 'Credenciais inválidas. Verifique usuário e senha.';
                try {
                    const data = await response.json();
                    if (data && data.message) msg = data.message;
                } catch (_) {}
                this.showToast(msg, 'error');

                const card = document.querySelector('.login-card');
                if (card) {
                    card.classList.add('shake-animation');
                    setTimeout(() => card.classList.remove('shake-animation'), 600);
                }
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showToast('Erro ao conectar com o servidor na porta 3001.', 'error');
        } finally {
            if (btnLogin) {
                btnLogin.disabled = false;
                btnLogin.textContent = 'Entrar no Painel';
            }
        }
    },

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        this.showToast('Sessão encerrada.', 'info', 1500);
        setTimeout(() => location.reload(), 500);
    },

    showContent() {
        const loginSec = document.getElementById('login-section');
        const adminContent = document.getElementById('admin-content');
        if (loginSec) loginSec.classList.add('hidden');
        if (adminContent) adminContent.classList.remove('hidden');

        const savedUser = localStorage.getItem('auth_username') || 'admin';
        const badge = document.getElementById('current-username-badge');
        if (badge) badge.textContent = savedUser;
    },

    async loadNews() {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${this.API_URL}?all=true`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) {
                throw new Error(`Erro ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();
            this.allNews = Array.isArray(data) ? data : [];
            this.applySortAndFilter();
        } catch (error) {
            console.error('Erro ao carregar notícias:', error);
            this.showToast('Erro ao carregar notícias do servidor.', 'error');
        }
    },

    setupGalleryUpload() {
        const input = document.getElementById('gallery-file-input');
        if (!input) return;
        input.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files.length) {
                await this.handleMultipleImageFiles(e.target.files);
                input.value = '';
            }
        });
    },

    toggleUrlInput() {
        const container = document.getElementById('url-input-container');
        if (!container) return;
        container.classList.toggle('hidden');
        if (!container.classList.contains('hidden')) {
            const input = document.getElementById('manual-image-url');
            if (input) input.focus();
        }
    },

    addManualPhotoUrl() {
        const input = document.getElementById('manual-image-url');
        const url = (input?.value || '').trim();

        if (!url) {
            this.showToast('Por favor, cole a URL da imagem.', 'error');
            return;
        }

        if (!this.isValidURL(url)) {
            this.showToast('URL inválida. O link deve começar com http:// ou https://', 'error');
            return;
        }

        const urlInput = document.getElementById('imageUrl');
        const currentCover = (urlInput?.value || '').trim();

        if (!currentCover) {
            urlInput.value = url;
            this.showToast('Foto definida como Capa Principal!', 'success', 2000);
        } else {
            this.currentGallery.push(url);
            this.showToast('Nova foto adicionada à Galeria!', 'success', 2000);
        }

        if (input) input.value = '';
        this.renderGalleryPreviews();
        this.updateLivePreview();
    },

    copyPhotoLink(url) {
        if (!url) return;
        const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullUrl).then(() => {
                this.showToast('📋 Link da foto copiado com sucesso!', 'success', 2000);
            }).catch(() => {
                prompt('Copie o link da foto:', fullUrl);
            });
        } else {
            prompt('Copie o link da foto:', fullUrl);
        }
    },

    setAsCover(index) {
        if (index < 0 || index >= this.currentGallery.length) return;
        const urlInput = document.getElementById('imageUrl');
        const currentCover = (urlInput?.value || '').trim();
        const newCover = this.currentGallery[index];

        if (currentCover) {
            this.currentGallery[index] = currentCover;
        } else {
            this.currentGallery.splice(index, 1);
        }

        if (urlInput) urlInput.value = newCover;
        this.renderGalleryPreviews();
        this.updateLivePreview();
        this.showToast('Nova foto definida como Capa Principal!', 'success', 2000);
    },

    removeCoverPhoto() {
        const urlInput = document.getElementById('imageUrl');
        if (this.currentGallery && this.currentGallery.length > 0) {
            const nextCover = this.currentGallery.shift();
            if (urlInput) urlInput.value = nextCover;
            this.showToast('Capa removida. A próxima foto da galeria virou a nova capa!', 'info', 2500);
        } else {
            if (urlInput) urlInput.value = '';
            this.showToast('Foto de capa removida.', 'info', 1500);
        }
        this.renderGalleryPreviews();
        this.updateLivePreview();
    },

    removeGalleryPhoto(index) {
        if (index < 0 || index >= this.currentGallery.length) return;
        this.currentGallery.splice(index, 1);
        this.renderGalleryPreviews();
        this.updateLivePreview();
        this.showToast('Foto removida da galeria.', 'info', 1500);
    },

    renderGalleryPreviews() {
        const container = document.getElementById('gallery-previews');
        if (!container) return;
        container.innerHTML = '';

        const coverUrl = (document.getElementById('imageUrl')?.value || '').trim();
        const gallery = this.currentGallery || [];
        const totalCount = (coverUrl ? 1 : 0) + gallery.length;

        const badge = document.getElementById('gallery-counter-badge');
        if (badge) {
            badge.textContent = `${totalCount} ${totalCount === 1 ? 'imagem' : 'imagens'}${gallery.length > 0 ? ` (1 capa + ${gallery.length} galeria)` : ''}`;
        }

        // 1. Card da Foto de Capa
        if (coverUrl) {
            const coverCard = document.createElement('div');
            coverCard.className = 'admin-photo-card is-cover';
            coverCard.style.cssText = 'position: relative; width: 115px; height: 125px; border-radius: 8px; overflow: hidden; border: 2px solid #27ae60; box-shadow: 0 2px 8px rgba(39,174,96,0.25); background: var(--card-bg-color); display: flex; flex-direction: column;';
            coverCard.innerHTML = `
                <div style="position: relative; flex: 1; overflow: hidden;">
                    <img src="${coverUrl}" alt="Foto de Capa" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=300&q=80'" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    <span style="position: absolute; top: 3px; left: 3px; background: #27ae60; color: #fff; font-size: 0.65rem; font-weight: 700; padding: 2px 5px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                        ⭐ Capa
                    </span>
                    <button type="button" title="Remover Capa" onclick="Admin.removeCoverPhoto()" style="position: absolute; top: 3px; right: 3px; background: rgba(0,0,0,0.65); color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ✕
                    </button>
                </div>
                <div style="display: flex; border-top: 1px solid var(--border-color);">
                    <button type="button" onclick="Admin.copyPhotoLink('${coverUrl}')" title="Copiar link desta foto" style="flex: 1; border: none; background: var(--card-bg-color); color: var(--text-color); font-size: 0.65rem; font-weight: 600; padding: 4px 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 2px;">
                        📋 Link
                    </button>
                    <span style="padding: 4px 6px; font-size: 0.65rem; background: #eafaf1; color: #1e8449; font-weight: 700;">
                        Principal
                    </span>
                </div>
            `;
            container.appendChild(coverCard);
        }

        // 2. Cards das Fotos Extras da Galeria
        gallery.forEach((imgUrl, index) => {
            const galCard = document.createElement('div');
            galCard.className = 'admin-photo-card';
            galCard.style.cssText = 'position: relative; width: 115px; height: 125px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); box-shadow: 0 2px 6px rgba(0,0,0,0.06); background: var(--card-bg-color); display: flex; flex-direction: column;';
            galCard.innerHTML = `
                <div style="position: relative; flex: 1; overflow: hidden;">
                    <img src="${imgUrl}" alt="Foto Galeria ${index + 1}" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=300&q=80'" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    <span style="position: absolute; top: 3px; left: 3px; background: rgba(0,0,0,0.65); color: #fff; font-size: 0.65rem; font-weight: 600; padding: 2px 5px; border-radius: 4px;">
                        Foto ${index + 2}
                    </span>
                    <button type="button" title="Remover foto da galeria" onclick="Admin.removeGalleryPhoto(${index})" style="position: absolute; top: 3px; right: 3px; background: rgba(0,0,0,0.65); color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ✕
                    </button>
                </div>
                <div style="display: flex; border-top: 1px solid var(--border-color);">
                    <button type="button" onclick="Admin.copyPhotoLink('${imgUrl}')" title="Copiar link desta foto" style="flex: 1; border: none; border-right: 1px solid var(--border-color); background: var(--card-bg-color); color: var(--text-color); font-size: 0.65rem; font-weight: 600; padding: 4px 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 2px;">
                        📋 Link
                    </button>
                    <button type="button" onclick="Admin.setAsCover(${index})" title="Definir esta imagem como a Capa Principal" style="flex: 1; border: none; background: var(--card-bg-color); color: var(--primary-color); font-size: 0.65rem; font-weight: 700; padding: 4px 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 2px;">
                        ⭐ Capa
                    </button>
                </div>
            `;
            container.appendChild(galCard);
        });

        // 3. Botão "+ Adicionar Mais Fotos"
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.title = 'Adicionar mais fotos da galeria ou computador';
        addBtn.style.cssText = 'width: 115px; height: 125px; border-radius: 8px; border: 2px dashed var(--border-color); background: transparent; color: var(--light-text-color); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;';
        addBtn.innerHTML = `
            <span style="font-size: 1.5rem;">➕</span>
            <span>Mais Fotos</span>
        `;
        addBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('image-file-input');
            if (fileInput) fileInput.click();
        });
        container.appendChild(addBtn);
    },

    /* ================= Estatísticas / KPIs ================= */
    updateStats() {
        const totalEl = document.getElementById('stat-total-news');
        const totalViewsEl = document.getElementById('stat-total-views');
        const topViewsEl = document.getElementById('stat-top-views');
        const yearEl = document.getElementById('stat-year-news');

        if (totalEl) totalEl.textContent = this.allNews.length;

        const totalViews = this.allNews.reduce((acc, item) => acc + (parseInt(item.views, 10) || 0), 0);
        if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString('pt-BR');

        if (topViewsEl) {
            if (this.allNews.length > 0) {
                const sortedByViews = [...this.allNews].sort((a, b) => (b.views || 0) - (a.views || 0));
                const top = sortedByViews[0];
                topViewsEl.textContent = (top.views || 0) + ' views';
                topViewsEl.title = top.title || '';
            } else {
                topViewsEl.textContent = '0 views';
            }
        }

        const count2026 = this.allNews.filter(n => (n.date || '').startsWith('2026')).length;
        if (yearEl) yearEl.textContent = count2026;
    },

    

    handlePageSizeChange() {
        const select = document.getElementById('admin-page-size-select');
        if (!select) return;

        if (select.value === 'all') {
            this.itemsPerPage = Math.max(this.filteredNews.length, 1);
        } else {
            this.itemsPerPage = parseInt(select.value, 10) || 10;
        }
        this.currentPage = 1;
        this.renderNewsList();
    },

    applySortAndFilter() {
        const searchInput = document.getElementById('admin-search-input');
        const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

        this.filteredNews = this.allNews.filter(item => {
            // Filtro por termo
            const matchesSearch = !term || 
                (item.title || '').toLowerCase().includes(term) || 
                (item.description || '').toLowerCase().includes(term) ||
                (item.displayDate || '').toLowerCase().includes(term);

            // Filtro por categoria
            const matchesCategory = this.currentCategory === 'all' || 
                (item.category || 'Educação Básica') === this.currentCategory;

            // Filtro por status
            let matchesStatus = true;
            if (this.currentStatus === 'published') {
                matchesStatus = item.published !== false;
            } else if (this.currentStatus === 'draft') {
                matchesStatus = item.published === false;
            } else if (this.currentStatus === 'featured') {
                matchesStatus = Boolean(item.featured);
            } else if (this.currentStatus === 'scheduled') {
                matchesStatus = Boolean(item.publishAt && new Date(item.publishAt) > new Date());
            }

            return matchesSearch && matchesCategory && matchesStatus;
        });

        // Ordenação
        this.filteredNews.sort((a, b) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();

            switch (this.currentSort) {
                case 'views-desc':
                    return (b.views || 0) - (a.views || 0);
                case 'date-asc':
                    return dateA.localeCompare(dateB);
                case 'title-asc':
                    return titleA.localeCompare(titleB);
                case 'title-desc':
                    return titleB.localeCompare(titleA);
                case 'date-desc':
                default:
                    return dateB.localeCompare(dateA);
            }
        });

        this.currentPage = 1;
        this.updateStats();
        this.renderNewsList();
    },

    setupSearch() {
        const searchInput = document.getElementById('admin-search-input');
        const clearBtn = document.getElementById('btn-clear-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            if (clearBtn) {
                clearBtn.classList.toggle('visible', searchInput.value.length > 0);
            }
            this.applySortAndFilter();
        });
    },

    clearSearch() {
        const searchInput = document.getElementById('admin-search-input');
        const clearBtn = document.getElementById('btn-clear-search');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        if (clearBtn) clearBtn.classList.remove('visible');
        this.applySortAndFilter();
    },

    /* ================= Renderização da Lista ================= */
    renderNewsList() {
        const list = document.getElementById('admin-news-items');
        if (!list) return;
        list.innerHTML = '';

        if (this.filteredNews.length === 0) {
            list.innerHTML = `
                <div class="empty-state-card">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-title">Nenhuma notícia encontrada com esses filtros</div>
                    <p>Tente ajustar a busca ou os seletores de categoria e status.</p>
                </div>
            `;
            this.renderPaginationControls();
            return;
        }

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageItems = this.filteredNews.slice(start, end);

        pageItems.forEach(item => {
            const card = document.createElement('article');
            card.className = 'admin-card-item';
            card.dataset.newsId = item.id;

            const fallbackImg = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&q=80';
            const viewsBadge = `
                <span class="badge-views-admin" style="font-size: 0.75rem; background: var(--background-color); color: var(--text-secondary); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border-color);">
                    👁️ ${(item.views || 0).toLocaleString('pt-BR')}
                </span>
            `;

            const galleryBadge = (item.gallery && item.gallery.length > 0) ? `
                <span style="font-size: 0.75rem; background: rgba(52, 152, 219, 0.15); color: #2980b9; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
                    🖼️ +${item.gallery.length} fotos
                </span>
            ` : '';
            
            const instagramBadge = item.instagramLink ? `
                <a href="${item.instagramLink}" target="_blank" rel="noopener noreferrer" class="badge-instagram" title="Ver no Instagram">
                    📷 Instagram
                </a>
            ` : '';

            const featuredBadge = item.featured ? `
                <span style="font-size: 0.75rem; background: #f1c40f; color: #000; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
                    ⭐ Destaque
                </span>
            ` : '';

            const isScheduled = item.publishAt && new Date(item.publishAt) > new Date();
            const scheduledBadge = isScheduled ? `
                <span class="badge-scheduled-admin" style="font-size: 0.75rem; background: rgba(243, 156, 18, 0.15); color: #d35400; padding: 2px 8px; border-radius: 12px; font-weight: 700; border: 1px solid rgba(243, 156, 18, 0.4);">
                    ⏰ Agendada (${new Date(item.publishAt).toLocaleDateString('pt-BR')} ${new Date(item.publishAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                </span>
            ` : '';

            const totalReactions = (item.reactions ? (item.reactions.love || 0) + (item.reactions.clap || 0) + (item.reactions.idea || 0) + (item.reactions.party || 0) : 0);
            const reactionBadge = `
                <span style="font-size: 0.75rem; background: var(--background-color); color: var(--text-secondary); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border-color);" title="❤️ ${item.reactions?.love || 0} | 👏 ${item.reactions?.clap || 0} | 💡 ${item.reactions?.idea || 0} | 🎉 ${item.reactions?.party || 0}">
                    ❤️ ${totalReactions} reações
                </span>
            `;

            const isPublished = item.published !== false;
            const statusBadge = isPublished ? `
                <span style="font-size: 0.75rem; background: rgba(46,204,113,0.15); color: #27ae60; padding: 2px 8px; border-radius: 12px; font-weight: 600; cursor: pointer;"
                      onclick="Admin.togglePublish('${item.id}', false)" title="Clique para despublicar (mover para rascunho)">
                    🟢 Publicada
                </span>
            ` : `
                <span style="font-size: 0.75rem; background: rgba(243,156,18,0.15); color: #e67e22; padding: 2px 8px; border-radius: 12px; font-weight: 600; cursor: pointer;"
                      onclick="Admin.togglePublish('${item.id}', true)" title="Clique para publicar">
                    🟡 Rascunho
                </span>
            `;

            const categoryBadge = `
                <span style="font-size: 0.75rem; background: rgba(52,152,219,0.12); color: #2980b9; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
                    📂 ${item.category || 'Educação Básica'}
                </span>
            `;

            card.innerHTML = `
                <div class="admin-card-thumb-wrapper">
                    <img src="${item.imageUrl || fallbackImg}" alt="${item.altText || item.title}" 
                         onerror="this.src='${fallbackImg}'">
                </div>
                
                <div class="admin-card-body">
                    <div class="admin-card-meta">
                        <span class="badge-meta-date">📅 ${item.displayDate || item.date || 'Sem data'}</span>
                        ${categoryBadge}
                        ${statusBadge}
                        ${featuredBadge}
                        ${viewsBadge}
                            ${reactionBadge}
                            ${scheduledBadge}
                            ${galleryBadge}
                            ${instagramBadge}
                    </div>
                    <h3 class="admin-card-title">${item.title}</h3>
                    <p class="admin-card-desc">${item.description}</p>
                    <div class="admin-card-links">
                        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                            🔗 Matéria completa ↗
                        </a>
                    </div>
                </div>

                <div class="admin-card-actions">
                    <button class="btn-item-action edit" onclick="Admin.editById('${item.id}')" title="Editar dados da notícia">
                        ✏️ Editar
                    </button>
                    <button class="btn-item-action view" onclick="Admin.duplicateNews('${item.id}')" title="Criar uma cópia desta notícia">
                        📑 Duplicar
                    </button>
                    <button class="btn-item-action delete" onclick="Admin.showDeleteConfirmation('${item.id}')" title="Excluir notícia">
                        🗑️ Excluir
                    </button>
                </div>
            `;
            list.appendChild(card);
        });

        this.renderPaginationControls();
    },

    renderPaginationControls() {
        const container = document.getElementById('pagination-controls');
        if (!container) return;

        const totalPages = Math.ceil(this.filteredNews.length / this.itemsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                onclick="Admin.changePage(${this.currentPage - 1})">◀ Anterior</button>
            <div class="pagination-numbers">
        `;

        for (let i = 1; i <= totalPages; i++) {
            html += `
                <button class="pagination-number ${i === this.currentPage ? 'active' : ''}" 
                    onclick="Admin.changePage(${i})">${i}</button>
            `;
        }

        html += `
            </div>
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                onclick="Admin.changePage(${this.currentPage + 1})">Próxima ▶</button>
        `;

        container.innerHTML = html;
    },

    changePage(page) {
        this.currentPage = page;
        this.renderNewsList();
        const toolbar = document.querySelector('.admin-toolbar-card');
        if (toolbar) toolbar.scrollIntoView({ behavior: 'smooth' });
    },

    /* ================= Ações Rápidas (Publicar / Duplicar) ================= */
    async togglePublish(id, willPublish) {
        const article = this.allNews.find(n => n.id === id);
        if (!article) return;

        const token = localStorage.getItem('auth_token');
        const updated = { ...article, published: willPublish };

        try {
            const res = await fetch(this.API_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updated)
            });

            if (res.ok) {
                this.showToast(willPublish ? 'Notícia publicada!' : 'Notícia alterada para rascunho!', 'success', 2000);
                await this.loadNews();
            } else {
                this.showToast('Erro ao atualizar status da notícia.', 'error');
            }
        } catch (_) {
            this.showToast('Erro de conexão ao alterar status.', 'error');
        }
    },

    duplicateNews(id) {
        const article = this.allNews.find(n => n.id === id);
        if (!article) return;

        this.openNewsModal(false);
        this.currentGallery = Array.isArray(article.gallery) ? [...article.gallery] : [];
        document.getElementById('title').value = `[CÓPIA] ${article.title}`;
        document.getElementById('link').value = article.link || '';
        document.getElementById('imageUrl').value = article.imageUrl || '';
        document.getElementById('category').value = article.category || 'Educação Básica';
        document.getElementById('featured').checked = false;
        const dupPublish = document.getElementById('publishAt'); if (dupPublish) dupPublish.value = ''; // cópia não nasce destacada
        document.getElementById('published').checked = false; // cópia nasce como rascunho por segurança
        document.getElementById('description').value = article.description || '';
        document.getElementById('readMoreText').value = article.readMoreText || 'Leia Mais';
        document.getElementById('instagramLink').value = article.instagramLink || '';
        document.getElementById('altText').value = article.altText || '';

        const imgPreview = document.getElementById('image-preview');
        if (imgPreview && article.imageUrl) {
            imgPreview.src = article.imageUrl;
            imgPreview.classList.add('visible');
        }

        this.renderGalleryPreviews();
        this.updateLivePreview();
        this.showToast('Notícia duplicada no formulário. Revise e salve!', 'info', 3000);
    },

    /* ================= Edição / Cadastro ================= */
    editById(id) {
        const article = this.allNews.find(n => n.id === id);
        if (!article) {
            this.showToast('Notícia não encontrada para edição', 'error');
            return;
        }

        this.openNewsModal(true);
        this.currentGallery = Array.isArray(article.gallery) ? [...article.gallery] : [];
        document.getElementById('news-id').value = article.id || '';
        document.getElementById('title').value = article.title || '';
        document.getElementById('link').value = article.link || '';
        document.getElementById('imageUrl').value = article.imageUrl || '';
        document.getElementById('category').value = article.category || 'Educação Básica';
        document.getElementById('featured').checked = Boolean(article.featured);
        document.getElementById('published').checked = article.published !== false;
        document.getElementById('date').value = article.date || '';
        const publishAtInput = document.getElementById('publishAt');
        if (publishAtInput) publishAtInput.value = article.publishAt ? article.publishAt.slice(0, 16) : '';
        document.getElementById('displayDate').value = article.displayDate || '';
        document.getElementById('description').value = article.description || '';
        document.getElementById('readMoreText').value = article.readMoreText || 'Leia Mais';
        document.getElementById('instagramLink').value = article.instagramLink || '';
        document.getElementById('altText').value = article.altText || '';

        document.getElementById('edit-mode').value = 'true';
        document.getElementById('btn-submit').textContent = 'Atualizar Notícia';

        const imgPreview = document.getElementById('image-preview');
        if (imgPreview && article.imageUrl) {
            imgPreview.src = article.imageUrl;
            imgPreview.classList.add('visible');
        }
        this.renderGalleryPreviews();
        this.updateLivePreview();
    },

    handleDateChange(dateString) {
        if (!dateString) return;
        const [year, month, day] = dateString.split('-');
        if (!year || !month || !day) return;

        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthIndex = parseInt(month, 10) - 1;
        const monthName = months[monthIndex] || month;

        const formatted = `${day} de ${monthName} de ${year}`;
        const displayDateInput = document.getElementById('displayDate');
        if (displayDateInput) {
            displayDateInput.value = formatted;
            this.updateLivePreview();
        }
    },

    openNewsModal(isEdit = false) {
        const modal = document.getElementById('news-modal');
        const title = document.getElementById('modal-title');
        if (!isEdit) {
            this.resetForm();
            if (title) title.textContent = 'Adicionar Nova Notícia';
            const today = new Date().toISOString().slice(0, 10);
            const dateInput = document.getElementById('date');
            if (dateInput) {
                dateInput.value = today;
                this.handleDateChange(today);
            }
        } else {
            if (title) title.textContent = 'Editar Notícia';
        }
        if (modal) modal.classList.add('visible');
        this.updateLivePreview();
    },

    closeNewsModal() {
        const modal = document.getElementById('news-modal');
        if (modal) modal.classList.remove('visible');
        this.resetForm();
    },

    resetForm() {
        const form = document.getElementById('news-form');
        if (form) form.reset();

        const idField = document.getElementById('news-id');
        if (idField) idField.value = '';
        const publishAtInput = document.getElementById('publishAt');
        if (publishAtInput) publishAtInput.value = '';

        const editModeField = document.getElementById('edit-mode');
        if (editModeField) editModeField.value = 'false';

        const btnSubmit = document.getElementById('btn-submit');
        if (btnSubmit) btnSubmit.textContent = 'Salvar Notícia';

        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) imgPreview.classList.remove('visible');

        const publishedCheck = document.getElementById('published');
        if (publishedCheck) publishedCheck.checked = true;

        this.currentGallery = [];
        this.renderGalleryPreviews();
        this.updateLivePreview();
    },

    confirmClearForm() {
        if (confirm('Tem certeza que deseja limpar todos os campos deste formulário?')) {
            this.resetForm();
            this.showToast('Campos limpos!', 'info');
        }
    },

    async handleSubmit(event) {
        event.preventDefault();
        const btn = document.getElementById('btn-submit');
        btn.disabled = true;

        const token = localStorage.getItem('auth_token');
        const isEdit = document.getElementById('edit-mode').value === 'true';

        let linkVal = (document.getElementById('link')?.value || '').trim();
        if (!linkVal) linkVal = '#'; // Se não tiver link externo, assume '#' para abrir a galeria no portal

        let coverVal = (document.getElementById('imageUrl')?.value || '').trim();
        if (!coverVal && this.currentGallery && this.currentGallery.length > 0) {
            coverVal = this.currentGallery[0];
            document.getElementById('imageUrl').value = coverVal;
        }

        const article = {
            id: document.getElementById('news-id').value,
            title: document.getElementById('title').value.trim(),
            link: linkVal,
            imageUrl: coverVal,
            category: document.getElementById('category').value,
            featured: document.getElementById('featured').checked,
            published: document.getElementById('published').checked,
            date: document.getElementById('date').value,
            displayDate: document.getElementById('displayDate').value.trim(),
            description: document.getElementById('description').value.trim(),
            readMoreText: document.getElementById('readMoreText').value.trim() || 'Leia Mais',
            instagramLink: document.getElementById('instagramLink').value.trim(),
            altText: document.getElementById('altText').value.trim(),
            gallery: this.currentGallery || [],
            publishAt: document.getElementById('publishAt')?.value ? new Date(document.getElementById('publishAt').value).toISOString() : null,
            views: isEdit ? (this.allNews.find(n => n.id === document.getElementById('news-id').value)?.views || 0) : 0
        };

        if (article.link !== '#' && !this.isValidURL(article.link)) {
            this.showToast('O link da matéria deve ser uma URL válida (http:// ou https://) ou ser deixado em branco.', 'error');
            btn.disabled = false;
            return;
        }

        if (!article.imageUrl) {
            this.showToast('Por favor, adicione ao menos uma foto (capa) para a notícia.', 'error');
            btn.disabled = false;
            return;
        }

        if (!this.isValidURL(article.imageUrl)) {
            this.showToast('A URL da imagem é inválida.', 'error');
            btn.disabled = false;
            return;
        }

        if (article.instagramLink && !this.isValidURL(article.instagramLink)) {
            this.showToast('O link do Instagram é inválido.', 'error');
            btn.disabled = false;
            return;
        }

        try {
            const response = await fetch(this.API_URL, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(article)
            });

            if (response.ok) {
                this.showToast(isEdit ? 'Notícia atualizada com sucesso!' : 'Notícia adicionada com sucesso!', 'success');
                this.closeNewsModal();
                await this.loadNews();
            } else {
                let errorMsg = 'Erro ao salvar a notícia no servidor.';
                try {
                    const data = await response.json();
                    if (data && data.message) errorMsg = data.message;
                } catch (_) {
                    errorMsg = `Erro ${response.status}: ${response.statusText || 'Falha ao processar.'}`;
                }

                if (response.status === 401 || response.status === 403) {
                    errorMsg = 'Sua sessão expirou ou você não está autenticado. Faça login novamente.';
                    localStorage.removeItem('auth_token');
                    setTimeout(() => location.reload(), 2500);
                }

                this.showToast(errorMsg, 'error');
            }
        } catch (e) {
            console.error('Erro ao salvar notícia:', e);
            this.showToast('Erro de conexão: certifique-se de que o backend está ativo na porta 3001.', 'error', 5000);
        } finally {
            btn.disabled = false;
        }
    },

    /* ================= Exclusão ================= */
    showDeleteConfirmation(id) {
        const article = this.allNews.find(n => n.id === id);
        if (!article) return;

        const modal = document.getElementById('delete-confirmation-modal');
        const newsTitleSpan = document.getElementById('news-title-to-delete');
        if (newsTitleSpan) newsTitleSpan.textContent = article.title;
        if (modal) modal.classList.add('visible');

        const confirmBtn = document.getElementById('confirm-delete-btn');
        const cancelBtn = document.getElementById('cancel-delete-btn');

        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            await this.confirmDelete(id);
            confirmBtn.disabled = false;
            this.hideDeleteConfirmation();
        };

        cancelBtn.onclick = () => this.hideDeleteConfirmation();
    },

    hideDeleteConfirmation() {
        const modal = document.getElementById('delete-confirmation-modal');
        if (modal) modal.classList.remove('visible');
    },

    async confirmDelete(id) {
        const token = localStorage.getItem('auth_token');

        try {
            const response = await fetch(this.API_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id })
            });

            if (response.ok) {
                this.showToast('Notícia excluída com sucesso!', 'success');
                await this.loadNews();
            } else {
                const data = await response.json();
                this.showToast(data.message || 'Erro ao excluir notícia.', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao comunicar com o servidor.', 'error');
        }
    },

    /* ================= Upload Físico de Imagens com Compressão ================= */
    setupDragAndDrop() {
        const dropZone = document.getElementById('image-drop-zone');
        const fileInput = document.getElementById('image-file-input');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

        if (fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length) {
                    await this.handleMultipleImageFiles(e.target.files);
                    fileInput.value = '';
                }
            });
        }

        dropZone.addEventListener('drop', async (e) => {
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                await this.handleMultipleImageFiles(files);
            }
        });
    },

    async uploadSingleImage(file) {
        const compressedBase64 = await this.compressImage(file);
        const token = localStorage.getItem('auth_token');
        try {
            const uploadRes = await fetch(this.UPLOAD_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ image: compressedBase64 })
            });

            if (uploadRes.ok) {
                const data = await uploadRes.json();
                return data.url;
            }
        } catch (_) {}
        return compressedBase64;
    },

    async handleMultipleImageFiles(fileList) {
        const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
        if (!files.length) {
            this.showToast('Por favor, envie apenas arquivos de imagem.', 'error');
            return;
        }

        const imageUrlInput = document.getElementById('imageUrl');
        this.showToast(`Otimizando e enviando ${files.length} ${files.length === 1 ? 'foto' : 'fotos'}...`, 'info', 2000);

        let added = 0;
        for (const file of files) {
            try {
                const url = await this.uploadSingleImage(file);
                if (!imageUrlInput.value.trim()) {
                    imageUrlInput.value = url;
                } else {
                    this.currentGallery.push(url);
                }
                added++;
            } catch (err) {
                console.error('Erro no upload de foto:', err);
            }
        }

        this.renderGalleryPreviews();
        this.updateLivePreview();
        this.showToast(`✅ ${added} ${added === 1 ? 'foto adicionada' : 'fotos adicionadas'} com sucesso!`, 'success', 2500);
    },

    async handleImageFile(file, targetInput) {
        try {
            const url = await this.uploadSingleImage(file);
            if (targetInput) {
                targetInput.value = url;
                targetInput.dispatchEvent(new Event('input'));
            }
            this.renderGalleryPreviews();
            this.updateLivePreview();
            this.showToast('Imagem processada com sucesso!', 'success', 2000);
        } catch (err) {
            console.error('Erro no processamento da imagem:', err);
            this.showToast('Não foi possível processar a imagem.', 'error');
        }
    },

    compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /* ================= Gerenciador de Usuários ================= */
    async openUsersModal() {
        const modal = document.getElementById('users-modal');
        if (modal) modal.classList.add('visible');
        await this.loadUsers();
    },

    closeUsersModal() {
        const modal = document.getElementById('users-modal');
        if (modal) modal.classList.remove('visible');
        const form = document.getElementById('new-user-form');
        if (form) form.reset();
    },

    async loadUsers() {
        const container = document.getElementById('users-list-container');
        if (!container) return;
        container.innerHTML = '<p style="font-size: 0.85rem; color: var(--light-text-color);">Carregando usuários...</p>';

        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(this.USERS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const users = await res.json();
                const currentUsername = localStorage.getItem('auth_username') || 'admin';

                if (users.length === 0) {
                    container.innerHTML = '<p>Nenhum usuário cadastrado.</p>';
                    return;
                }

                container.innerHTML = users.map(u => {
                    const isSelf = u.username === currentUsername;
                    const deleteBtn = isSelf 
                        ? '<span style="font-size: 0.75rem; color: var(--light-text-color); font-weight: bold;">(Você)</span>'
                        : `<button class="btn-item-action delete" style="padding: 4px 8px; font-size: 0.78rem;" onclick="Admin.deleteUser('${u.id}', '${u.username}')">Excluir</button>`;

                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-weight: 600; font-size: 0.9rem;">👤 ${u.username}</span>
                            <div>${deleteBtn}</div>
                        </div>
                    `;
                }).join('');
            } else {
                container.innerHTML = '<p style="color: #e74c3c;">Erro ao carregar lista de usuários.</p>';
            }
        } catch (_) {
            container.innerHTML = '<p style="color: #e74c3c;">Falha na conexão com o servidor.</p>';
        }
    },

    async handleCreateUser(e) {
        e.preventDefault();
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password-user').value;
        const btn = document.getElementById('btn-create-user');

        if (!username || !password || password.length < 6) {
            this.showToast('Informe usuário e senha com no mínimo 6 caracteres.', 'error');
            return;
        }

        btn.disabled = true;
        const token = localStorage.getItem('auth_token');

        try {
            const res = await fetch(this.USERS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                this.showToast(`Usuário "${username}" criado com sucesso!`, 'success');
                document.getElementById('new-user-form').reset();
                await this.loadUsers();
            } else {
                this.showToast(data.message || 'Erro ao criar usuário.', 'error');
            }
        } catch (_) {
            this.showToast('Erro de conexão com o servidor.', 'error');
        } finally {
            btn.disabled = false;
        }
    },

    async deleteUser(id, username) {
        if (!confirm(`Tem certeza que deseja excluir o usuário "${username}"?`)) return;

        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(this.USERS_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id })
            });

            const data = await res.json();
            if (res.ok) {
                this.showToast(`Usuário "${username}" excluído!`, 'success');
                await this.loadUsers();
            } else {
                this.showToast(data.message || 'Erro ao excluir usuário.', 'error');
            }
        } catch (_) {
            this.showToast('Erro de conexão ao excluir usuário.', 'error');
        }
    },

    /* ================= Senha ================= */
    togglePasswordSection(show) {
        const section = document.getElementById('password-section');
        if (!section) return;
        section.classList.toggle('hidden', !show);
        if (!show) {
            const form = document.getElementById('password-form');
            if (form) form.reset();
            this.resetStrengthMeter();
        } else {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    },

    setupPasswordStrength() {
        const passwordInput = document.getElementById('new-password');
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');

        if (!passwordInput || !strengthBar || !strengthText) return;

        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            let strength = 0;

            if (val.length >= 6) strength++;
            if (val.length >= 10) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;

            const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c'];
            const labels = ['Fraca', 'Razoável', 'Boa', 'Forte', 'Muito Forte'];

            if (val.length === 0) {
                this.resetStrengthMeter();
            } else {
                strengthBar.style.width = (strength * 20) + '%';
                strengthBar.style.backgroundColor = colors[strength - 1] || colors[0];
                strengthText.textContent = `Força: ${labels[strength - 1] || labels[0]}`;
                strengthText.style.color = colors[strength - 1] || colors[0];
            }
        });
    },

    resetStrengthMeter() {
        const bar = document.getElementById('strength-bar');
        const text = document.getElementById('strength-text');
        if (bar) bar.style.width = '0';
        if (text) text.textContent = '';
    },

    async changePassword(event) {
        event.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const token = localStorage.getItem('auth_token');

        if (newPassword.length < 6) {
            this.showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('As senhas não coincidem.', 'error');
            return;
        }

        try {
            const response = await fetch(this.PASSWORD_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                this.showToast('Senha alterada com sucesso!', 'success');
                this.togglePasswordSection(false);
            } else {
                this.showToast(data.message || `Erro ${response.status}: Falha ao alterar senha`, 'error');
            }
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            this.showToast('Falha na comunicação com o servidor', 'error');
        }
    },

    /* ================= CSV Import / Export ================= */
    exportNewsToCSV() {
        const newsToExport = this.filteredNews;
        if (newsToExport.length === 0) {
            this.showToast('Não há notícias para exportar.', 'info');
            return;
        }

        const headers = ['ID', 'Título', 'Categoria', 'Data', 'DataExibicao', 'Link', 'URL_Imagem', 'Descrição', 'Destaque', 'Publicado'];
        const csvRows = [headers.join(',')];

        newsToExport.forEach(item => {
            const values = [
                `"${(item.id || '').replace(/"/g, '""')}"`,
                `"${(item.title || '').replace(/"/g, '""')}"`,
                `"${(item.category || 'Educação Básica').replace(/"/g, '""')}"`,
                `"${(item.date || '').replace(/"/g, '""')}"`,
                `"${(item.displayDate || '').replace(/"/g, '""')}"`,
                `"${(item.link || '').replace(/"/g, '""')}"`,
                `"${(item.imageUrl || '').replace(/"/g, '""')}"`,
                `"${(item.description || '').replace(/"/g, '""')}"`,
                item.featured ? 'Sim' : 'Não',
                item.published !== false ? 'Sim' : 'Não'
            ];
            csvRows.push(values.join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `noticias_exportadas_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        this.showToast('Arquivo CSV baixado com sucesso!', 'success');
    },

    triggerCSVImport() {
        const input = document.getElementById('csv-import-input');
        if (input) input.click();
    },

    setupCSVImport() {
        const fileInput = document.getElementById('csv-import-input');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => this.processCSV(event.target.result);
            reader.readAsText(file, 'utf-8');
            fileInput.value = '';
        });
    },

    async processCSV(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            this.showToast('O arquivo CSV parece estar vazio ou sem linhas de dados.', 'error');
            return;
        }

        const token = localStorage.getItem('auth_token');
        let successCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const columns = this.parseCSVRow(lines[i]);
            if (columns.length < 6) continue;

            const article = {
                title: columns[1] || 'Sem Título',
                category: columns[2] || 'Educação Básica',
                date: columns[3] || new Date().toISOString().slice(0, 10),
                displayDate: columns[4] || columns[3] || '',
                link: columns[5] || '',
                imageUrl: columns[6] || '',
                description: columns[7] || '',
                readMoreText: 'Leia Mais',
                published: true,
                featured: false
            };

            if (!this.isValidURL(article.link) || !this.isValidURL(article.imageUrl)) continue;

            try {
                const response = await fetch(this.API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(article)
                });
                if (response.ok) successCount++;
            } catch (e) {
                console.error(`Erro ao importar linha ${i}:`, e);
            }
        }

        this.showToast(`Importação finalizada! ${successCount} notícias importadas.`, 'success');
        await this.loadNews();
    },

    parseCSVRow(row) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"' && row[i + 1] === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    },

    /* ================= Helpers de UI ================= */
    setupPasswordVisibilityToggles() {
        document.querySelectorAll('.toggle-password-visibility').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const targetId = toggle.dataset.target;
                const passwordInput = document.getElementById(targetId);
                if (!passwordInput) return;
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggle.textContent = '🙈';
                } else {
                    passwordInput.type = 'password';
                    toggle.textContent = '👁️';
                }
            });
        });
    },

    setupImagePreview() {
        const imageUrlInput = document.getElementById('imageUrl');
        const imagePreview = document.getElementById('image-preview');

        if (!imageUrlInput) return;

        imageUrlInput.addEventListener('input', () => {
            const url = imageUrlInput.value.trim();
            if (imagePreview) {
                if (this.isValidURL(url)) {
                    imagePreview.src = url;
                    imagePreview.classList.add('visible');
                } else {
                    imagePreview.classList.remove('visible');
                }
            }
            this.renderGalleryPreviews();
            this.updateLivePreview();
        });

        if (imagePreview) {
            imagePreview.onerror = () => imagePreview.classList.remove('visible');
        }
    },

    setupLivePreview() {
        const inputs = ['title', 'imageUrl', 'displayDate', 'description', 'readMoreText', 'instagramLink', 'altText', 'category', 'featured'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateLivePreview());
                el.addEventListener('change', () => this.updateLivePreview());
            }
        });
    },

    updateLivePreview() {
        const container = document.getElementById('live-preview-content');
        if (!container) return;

        const title = (document.getElementById('title')?.value || '').trim() || 'Título da Notícia';
        const imageUrl = (document.getElementById('imageUrl')?.value || '').trim() || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80';
        const displayDate = (document.getElementById('displayDate')?.value || '').trim() || 'Data de Exibição';
        const description = (document.getElementById('description')?.value || '').trim() || 'A prévia da descrição aparecerá aqui em tempo real...';
        const readMoreText = (document.getElementById('readMoreText')?.value || '').trim() || 'Leia Mais';
        const category = document.getElementById('category')?.value || 'Educação Básica';
        const isFeatured = document.getElementById('featured')?.checked;
        const instagramLink = (document.getElementById('instagramLink')?.value || '').trim();
        const gallery = this.currentGallery || [];

        const instaBadge = instagramLink ? `
            <span style="font-size: 0.75rem; background: rgba(225,48,108,0.1); color: #e1306c; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                📷 Instagram
            </span>
        ` : '';

        const starBadge = isFeatured ? `
            <span style="font-size: 0.75rem; background: #f1c40f; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                ⭐ Destaque
            </span>
        ` : '';

        const galleryBadge = gallery.length > 0 ? `
            <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #fff; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
                🖼️ +${gallery.length} fotos
            </span>
        ` : '';

        const galleryStrip = gallery.length > 0 ? `
            <div style="display: flex; gap: 4px; padding: 6px 12px; background: rgba(0,0,0,0.03); border-top: 1px solid var(--border-color); overflow-x: auto;">
                ${gallery.slice(0, 4).map(img => `
                    <img src="${img}" alt="Miniatura" style="width: 36px; height: 36px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-color); flex-shrink: 0;" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=100&q=80'">
                `).join('')}
                ${gallery.length > 4 ? `
                    <span style="font-size: 0.72rem; align-self: center; color: var(--light-text-color); font-weight: 700; margin-left: 2px;">+${gallery.length - 4}</span>
                ` : ''}
            </div>
        ` : '';

        container.innerHTML = `
            <div class="news-card visible" style="opacity: 1; transform: none; margin: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="position: relative; overflow: hidden;">
                    <img src="${imageUrl}" alt="Prévia" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80'" style="width: 100%; height: 200px; object-fit: cover; display: block;">
                    ${galleryBadge}
                </div>
                ${galleryStrip}
                <div class="news-content">
                    <div class="card-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 4px;">
                        <span style="font-size: 0.75rem; background: rgba(52,152,219,0.15); color: var(--primary-color); padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                            📂 ${category}
                        </span>
                        <div>
                            ${starBadge}
                            ${instaBadge}
                        </div>
                    </div>
                    <time class="news-date" style="font-size: 0.8rem; font-weight: 600; color: var(--light-text-color); margin-bottom: 6px; display: block;">${displayDate}</time>
                    <h3 style="font-size: 1.05rem; margin: 0 0 8px 0; line-height: 1.3;">${title}</h3>
                    <p style="font-size: 0.85rem; color: var(--light-text-color); margin-bottom: 12px; line-height: 1.4;">${description}</p>
                    <div class="card-footer">
                        <span class="read-more" style="font-weight: 600; color: var(--primary-color); font-size: 0.85rem;">${readMoreText} →</span>
                    </div>
                </div>
            </div>
        `;
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const usersModal = document.getElementById('users-modal');
                const newsModal = document.getElementById('news-modal');
                const deleteModal = document.getElementById('delete-confirmation-modal');

                if (usersModal && usersModal.classList.contains('visible')) {
                    this.closeUsersModal();
                } else if (deleteModal && deleteModal.classList.contains('visible')) {
                    this.hideDeleteConfirmation();
                } else if (newsModal && newsModal.classList.contains('visible')) {
                    this.closeNewsModal();
                }
            }
        });
    },

    showToast(message, type = 'info', duration = 3500) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';

        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => toast.remove(), duration);
    },

    isValidURL(string) {
        if (!string) return false;
        if (string.startsWith('/uploads/') || string.startsWith('uploads/')) return true;
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:' || string.startsWith('data:image/');
        } catch (_) {
            return false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
