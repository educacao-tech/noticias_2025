const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:') && window.location.port === '3001'
    ? ''
    : 'http://localhost:3001';

const Admin = {
    API_URL: `${API_BASE}/api/news`,
    LOGIN_URL: `${API_BASE}/api/login`,
    PASSWORD_URL: `${API_BASE}/api/change-password`,
    allNews: [],
    filteredNews: [],
    currentPage: 1,
    itemsPerPage: 10,
    currentSort: 'date-desc',

    init() {
        this.initTheme();
        this.setupPasswordVisibilityToggles();
        this.setupImagePreview();
        this.setupLivePreview();
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();

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
                localStorage.setItem('auth_username', username);

                this.showContent();
                await this.loadNews();
                this.setupPasswordStrength();
                this.setupSearch();
                this.setupCSVImport();
                this.showToast(`Bem-vindo(a), ${username}!`, 'success');
            } else {
                this.showToast('Credenciais inválidas. Verifique usuário e senha.', 'error');
                const card = document.querySelector('.login-card');
                if (card) {
                    card.classList.add('shake-animation');
                    setTimeout(() => card.classList.remove('shake-animation'), 600);
                }
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showToast('Erro ao conectar com o servidor.', 'error');
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

    /* ================= Estatísticas / KPIs ================= */
    updateStats() {
        const totalEl = document.getElementById('stat-total-news');
        const yearEl = document.getElementById('stat-year-news');
        const latestEl = document.getElementById('stat-latest-date');
        const filteredEl = document.getElementById('stat-filtered-news');

        if (totalEl) totalEl.textContent = this.allNews.length;
        if (filteredEl) filteredEl.textContent = this.filteredNews.length;

        // Notícias em 2026
        const count2026 = this.allNews.filter(n => (n.date || '').startsWith('2026')).length;
        if (yearEl) yearEl.textContent = count2026;

        // Última data
        if (latestEl) {
            if (this.allNews.length > 0) {
                const dates = this.allNews
                    .map(n => n.date)
                    .filter(Boolean)
                    .sort()
                    .reverse();
                if (dates.length > 0) {
                    const [y, m, d] = dates[0].split('-');
                    latestEl.textContent = `${d}/${m}/${y}`;
                } else {
                    latestEl.textContent = 'Sem data';
                }
            } else {
                latestEl.textContent = '--';
            }
        }
    },

    /* ================= Carregamento e Ordenação ================= */
    async loadNews() {
        const loading = document.getElementById('loading-overlay');
        if (loading) loading.classList.add('visible');

        try {
            const response = await fetch(this.API_URL);
            this.allNews = await response.json();
            this.applySortAndFilter();
        } catch (error) {
            console.error('Erro ao carregar notícias:', error);
            this.showToast('Falha ao carregar lista de notícias', 'error');
        } finally {
            if (loading) loading.classList.remove('visible');
        }
    },

    handleSortChange() {
        const select = document.getElementById('admin-sort-select');
        if (select) {
            this.currentSort = select.value;
            this.applySortAndFilter();
        }
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

        // Filtro
        if (term) {
            this.filteredNews = this.allNews.filter(item => 
                (item.title || '').toLowerCase().includes(term) || 
                (item.description || '').toLowerCase().includes(term) ||
                (item.displayDate || '').toLowerCase().includes(term)
            );
        } else {
            this.filteredNews = [...this.allNews];
        }

        // Ordenação
        this.filteredNews.sort((a, b) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();

            switch (this.currentSort) {
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
                    <div class="empty-state-title">Nenhuma notícia encontrada</div>
                    <p>Tente ajustar o termo de pesquisa ou adicionar uma nova notícia.</p>
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
            const instagramBadge = item.instagramLink ? `
                <a href="${item.instagramLink}" target="_blank" rel="noopener noreferrer" class="badge-instagram" title="Ver post no Instagram">
                    📷 Instagram
                </a>
            ` : '';

            card.innerHTML = `
                <div class="admin-card-thumb-wrapper">
                    <img src="${item.imageUrl || fallbackImg}" alt="${item.altText || item.title}" 
                         onerror="this.src='${fallbackImg}'">
                </div>
                
                <div class="admin-card-body">
                    <div class="admin-card-meta">
                        <span class="badge-meta-date">📅 ${item.displayDate || item.date || 'Sem data'}</span>
                        ${instagramBadge}
                    </div>
                    <h3 class="admin-card-title">${item.title}</h3>
                    <p class="admin-card-desc">${item.description}</p>
                    <div class="admin-card-links">
                        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                            🔗 Acessar matéria original ↗
                        </a>
                    </div>
                </div>

                <div class="admin-card-actions">
                    <button class="btn-item-action edit" onclick="Admin.editById('${item.id}')">
                        ✏️ Editar
                    </button>
                    <button class="btn-item-action delete" onclick="Admin.showDeleteConfirmation('${item.id}')">
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

    /* ================= Edição / Cadastro ================= */
    editById(id) {
        const article = this.allNews.find(n => n.id === id);
        if (!article) {
            this.showToast('Notícia não encontrada para edição', 'error');
            return;
        }

        this.openNewsModal(true);
        document.getElementById('news-id').value = article.id || '';
        document.getElementById('title').value = article.title || '';
        document.getElementById('link').value = article.link || '';
        document.getElementById('imageUrl').value = article.imageUrl || '';
        document.getElementById('date').value = article.date || '';
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
            // Preenche data de hoje como padrão
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

        const editModeField = document.getElementById('edit-mode');
        if (editModeField) editModeField.value = 'false';

        const btnSubmit = document.getElementById('btn-submit');
        if (btnSubmit) btnSubmit.textContent = 'Salvar Notícia';

        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) imgPreview.classList.remove('visible');

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

        const article = {
            id: document.getElementById('news-id').value,
            title: document.getElementById('title').value.trim(),
            link: document.getElementById('link').value.trim(),
            imageUrl: document.getElementById('imageUrl').value.trim(),
            date: document.getElementById('date').value,
            displayDate: document.getElementById('displayDate').value.trim(),
            description: document.getElementById('description').value.trim(),
            readMoreText: document.getElementById('readMoreText').value.trim() || 'Leia Mais',
            instagramLink: document.getElementById('instagramLink').value.trim(),
            altText: document.getElementById('altText').value.trim(),
            published: true
        };

        if (!this.isValidURL(article.link)) {
            this.showToast('O link da matéria deve ser uma URL válida (http:// ou https://).', 'error');
            btn.disabled = false;
            return;
        }

        if (!this.isValidURL(article.imageUrl)) {
            this.showToast('A URL da imagem deve ser válida (http:// ou https://).', 'error');
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

            const data = await response.json();

            if (response.ok) {
                this.showToast('Senha alterada com sucesso!', 'success');
                this.togglePasswordSection(false);
            } else {
                this.showToast(data.message || 'Erro ao alterar senha', 'error');
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

        const headers = ['ID', 'Título', 'Data', 'DataExibicao', 'Link', 'URL_Imagem', 'Descrição', 'Instagram', 'AltText'];
        const csvRows = [headers.join(',')];

        newsToExport.forEach(item => {
            const values = [
                `"${(item.id || '').replace(/"/g, '""')}"`,
                `"${(item.title || '').replace(/"/g, '""')}"`,
                `"${(item.date || '').replace(/"/g, '""')}"`,
                `"${(item.displayDate || '').replace(/"/g, '""')}"`,
                `"${(item.link || '').replace(/"/g, '""')}"`,
                `"${(item.imageUrl || '').replace(/"/g, '""')}"`,
                `"${(item.description || '').replace(/"/g, '""')}"`,
                `"${(item.instagramLink || '').replace(/"/g, '""')}"`,
                `"${(item.altText || '').replace(/"/g, '""')}"`
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
                date: columns[2] || new Date().toISOString().slice(0, 10),
                displayDate: columns[3] || columns[2] || '',
                link: columns[4] || '',
                imageUrl: columns[5] || '',
                description: columns[6] || '',
                instagramLink: columns[7] || '',
                altText: columns[8] || '',
                readMoreText: 'Leia Mais',
                published: true
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

        if (!imageUrlInput || !imagePreview) return;

        imageUrlInput.addEventListener('input', () => {
            const url = imageUrlInput.value.trim();
            if (this.isValidURL(url)) {
                imagePreview.src = url;
                imagePreview.classList.add('visible');
            } else {
                imagePreview.classList.remove('visible');
            }
            this.updateLivePreview();
        });

        imagePreview.onerror = () => imagePreview.classList.remove('visible');
    },

    setupDragAndDrop() {
        const dropZone = document.getElementById('image-drop-zone');
        const imageUrlInput = document.getElementById('imageUrl');
        const fileInput = document.getElementById('image-file-input');
        if (!dropZone || !imageUrlInput) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

        // Clique para selecionar arquivo
        if (fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await this.handleImageFile(e.target.files[0], imageUrlInput);
                    fileInput.value = '';
                }
            });
        }

        dropZone.addEventListener('drop', async (e) => {
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                await this.handleImageFile(files[0], imageUrlInput);
            } else {
                this.showToast('Por favor, envie apenas arquivos de imagem.', 'error');
            }
        });
    },

    async handleImageFile(file, targetInput) {
        this.showToast('Otimizando imagem para upload...', 'info', 1500);
        try {
            const compressed = await this.compressImage(file);
            targetInput.value = compressed;
            targetInput.dispatchEvent(new Event('input'));
            this.showToast('Imagem otimizada com sucesso!', 'success', 2000);
        } catch (err) {
            console.error('Erro na compressão:', err);
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

    setupLivePreview() {
        const inputs = ['title', 'imageUrl', 'displayDate', 'description', 'readMoreText', 'instagramLink', 'altText'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateLivePreview());
        });
    },

    updateLivePreview() {
        const container = document.getElementById('live-preview-content');
        if (!container) return;

        const title = (document.getElementById('title')?.value || '').trim() || 'Título da Notícia';
        const imageUrl = (document.getElementById('imageUrl')?.value || '').trim() || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80';
        const displayDate = (document.getElementById('displayDate')?.value || '').trim() || 'Data de Exibição';
        const description = (document.getElementById('description')?.value || '').trim() || 'A prévia da descrição aparecerá aqui em tempo real conforme você preenche o formulário...';
        const readMoreText = (document.getElementById('readMoreText')?.value || '').trim() || 'Leia Mais';
        const instagramLink = (document.getElementById('instagramLink')?.value || '').trim();
        const altText = (document.getElementById('altText')?.value || '').trim() || 'Prévia da notícia';

        const instaBadge = instagramLink ? `
            <span style="font-size: 0.8rem; background: rgba(225,48,108,0.1); color: #e1306c; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                📷 Instagram
            </span>
        ` : '';

        container.innerHTML = `
            <div class="news-card visible" style="opacity: 1; transform: none; margin: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <img src="${imageUrl}" alt="${altText}" onerror="this.src='https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80'">
                <div class="news-content">
                    <div class="card-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <time class="news-date" style="font-size: 0.8rem; font-weight: 600; color: var(--primary-color);">${displayDate}</time>
                        ${instaBadge}
                    </div>
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
                const newsModal = document.getElementById('news-modal');
                const deleteModal = document.getElementById('delete-confirmation-modal');
                if (deleteModal && deleteModal.classList.contains('visible')) {
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
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:' || string.startsWith('data:image/');
        } catch (_) {
            return false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
