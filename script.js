const App = {
    async init() {
        this.theme.init();
        await this.news.init();
        this.filter.init();
        this.ui.init();
    },

    /**
     * Módulo para gerenciar o tema (claro/escuro).
     */
    theme: {
        icons: {
            sun: '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 12c0 .55.45 1 1 1h2c.55 0 1-.45 1-1s-.45-1-1-1H3c-.55 0-1 .45-1 1zm18 0c0 .55.45 1 1 1h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1zm-8-8c.55 0 1-.45 1-1V1c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1zm0 16c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1zM5.64 5.64c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.64 2.81c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.42zM18.36 18.36c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.41-1.41c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41zM5.64 18.36c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41zM18.36 5.64c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41z" />',
            moon: '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.64-.11 2.41-.31-1.12-.9-1.91-2.18-1.91-3.69 0-2.48 2.02-4.5 4.5-4.5.31 0 .62.03.91.09C19.53 6.88 16.03 3 12 3z" />'
        },

        init() {
            this.themeToggle = document.getElementById('theme-toggle');
            this.themeIcon = document.getElementById('theme-icon');
            this.themeStatus = document.getElementById('theme-status');
            this.htmlEl = document.documentElement;
            this.setInitialTheme();
            this.addLoginButtonListener();
            this.addEventListeners();
        },

        setInitialTheme() {
            const savedTheme = localStorage.getItem('theme');
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
            this.update(initialTheme);
        },

        addEventListeners() {
            if (!this.themeToggle) return;
            this.themeToggle.addEventListener('click', () => {
                this.themeToggle.classList.add('rotating');
                const currentTheme = this.htmlEl.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                this.update(newTheme);
            });

            this.themeToggle.addEventListener('animationend', () => {
                this.themeToggle.classList.remove('rotating');
            }, { once: true });
        },

        addLoginButtonListener() {
            const loginButton = document.getElementById('login-button');
            if (loginButton) {
                loginButton.addEventListener('click', () => window.location.href = 'admin.html');
            }
        },

        update(theme) {
            this.htmlEl.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);

            const isDark = theme === 'dark';
            if (this.themeIcon) {
                this.themeIcon.innerHTML = isDark ? this.icons.sun : this.icons.moon;
            }

            if (this.themeStatus) {
                this.themeStatus.textContent = `Tema alterado para ${isDark ? 'escuro' : 'claro'}.`;
            }
        }
    },

    /**
     * Módulo de Carregamento, Filtragem e Paginação.
     */
    news: {
        allNews: [],
        filteredNews: [],
        currentPage: 1,
        itemsPerPage: 8, // 8 notícias por página (2 linhas completas de 4 colunas)
        currentCategory: 'all',
        currentYear: '2026',
        searchTerm: '',

        async init() {
            this.container = document.querySelector('.news-preview-container');
            this.paginationContainer = document.getElementById('pagination-controls');
            this.heroContainer = document.getElementById('hero-featured-news');
            this.spinner = this.container?.querySelector('.spinner');
            this.noResultsEl = this.container?.querySelector('.no-results-message');

            if (!this.container) return;

            try {
                const response = await fetch('news.json');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const newsData = await response.json();
                this.processData(newsData);
                this.setupCategoryPills();
                this.setupYearFilter();
                this.applyFiltersAndRender();
            } catch (error) {
                console.error('Falha ao carregar notícias:', error);
                if (this.noResultsEl) {
                    this.noResultsEl.textContent = 'Não foi possível carregar as notícias no momento.';
                    this.noResultsEl.classList.remove('hidden');
                }
            } finally {
                if (this.spinner) this.spinner.classList.add('hidden');
            }
        },

        processData(newsData) {
            const unique = Array.from(new Map(newsData.map(a => [a.link, a])).values());
            // Apenas notícias com status publicado
            this.allNews = unique
                .filter(a => a.published !== false)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        },

        setupCategoryPills() {
            const container = document.getElementById('category-pills');
            if (!container) return;

            const categories = [
                'Todas',
                'Educação Básica',
                'Projetos & Inovação',
                'Premiações',
                'Alimentação Escolar',
                'Eventos'
            ];

            container.innerHTML = categories.map(cat => {
                const val = cat === 'Todas' ? 'all' : cat;
                const active = val === this.currentCategory ? 'active' : '';
                return `
                    <button class="category-pill ${active}" onclick="App.news.setCategory('${val}', this)">
                        ${cat}
                    </button>
                `;
            }).join('');
        },

        setupYearFilter() {
            const select = document.getElementById('year-filter-select');
            if (!select) return;
            select.addEventListener('change', (e) => {
                this.currentYear = e.target.value;
                this.currentPage = 1;
                this.applyFiltersAndRender();
            });
        },

        setCategory(category, btnElement) {
            this.currentCategory = category;
            document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
            if (btnElement) btnElement.classList.add('active');
            this.currentPage = 1;
            this.applyFiltersAndRender();
        },

        applyFiltersAndRender() {
            let list = [...this.allNews];

            // Filtro de ano
            if (this.currentYear !== 'all') {
                list = list.filter(item => (item.date || '').startsWith(this.currentYear));
            }

            // Filtro de categoria
            if (this.currentCategory !== 'all') {
                list = list.filter(item => (item.category || 'Educação Básica') === this.currentCategory);
            }

            // Filtro de busca
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                list = list.filter(item => 
                    (item.title || '').toLowerCase().includes(term) ||
                    (item.description || '').toLowerCase().includes(term)
                );
            }

            this.filteredNews = list;
            this.renderHeroAndGrid();
        },

        renderHeroAndGrid() {
            // Limpa cards atuais
            const existing = this.container.querySelectorAll('.news-card');
            existing.forEach(c => c.remove());

            if (this.filteredNews.length === 0) {
                if (this.noResultsEl) this.noResultsEl.classList.remove('hidden');
                if (this.heroContainer) this.heroContainer.classList.add('hidden');
                if (this.paginationContainer) this.paginationContainer.innerHTML = '';
                return;
            }

            if (this.noResultsEl) this.noResultsEl.classList.add('hidden');

            let gridItems = [...this.filteredNews];

            // Renderizar Notícia em Destaque (Hero Banner) apenas na página 1 e sem busca específica
            if (this.currentPage === 1 && !this.searchTerm && this.currentCategory === 'all') {
                // Encontra a notícia marcada com featured ou usa a primeira
                const featuredIndex = gridItems.findIndex(n => n.featured);
                const heroNews = featuredIndex !== -1 ? gridItems.splice(featuredIndex, 1)[0] : gridItems.shift();

                this.renderHero(heroNews);
            } else {
                if (this.heroContainer) this.heroContainer.classList.add('hidden');
            }

            // Paginação da Grade (4 Colunas)
            const totalPages = Math.ceil(gridItems.length / this.itemsPerPage);
            if (this.currentPage > totalPages) this.currentPage = 1;

            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const pageNews = gridItems.slice(startIndex, endIndex);

            const gridHtml = pageNews.map(article => this.createArticleHtml(article)).join('');

            if (this.noResultsEl) {
                this.noResultsEl.insertAdjacentHTML('beforebegin', gridHtml);
            } else {
                this.container.insertAdjacentHTML('beforeend', gridHtml);
            }

            App.ui.animateCardsOnLoad();
            App.ui.initShowMore();
            this.renderPagination(totalPages);
        },

        renderHero(article) {
            if (!this.heroContainer || !article) return;

            const fallbackImg = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
            const readingTime = this.calcReadingTime(article.description);

            this.heroContainer.innerHTML = `
                <div class="hero-card">
                    <div class="hero-img-wrapper">
                        <img src="${article.imageUrl || fallbackImg}" alt="${article.altText || article.title}" onerror="this.src='${fallbackImg}'">
                    </div>
                    <div class="hero-content">
                        <div class="hero-badge-row">
                            <span class="badge-hero">⭐ Notícia em Destaque</span>
                            <span class="badge-category">📂 ${article.category || 'Educação Básica'}</span>
                            <span class="reading-time">⏱️ ${readingTime}</span>
                        </div>
                        <h2 class="hero-title">
                            <a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                        </h2>
                        <time class="news-date" style="margin-bottom: 12px; font-weight: 600;">📅 ${article.displayDate || article.date}</time>
                        <p class="hero-desc">${article.description}</p>
                        <div class="hero-footer">
                            <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more" style="font-weight: 700; color: var(--primary-color);">
                                Ler matéria completa →
                            </a>
                            <div style="display: flex; gap: 8px;">
                                <button class="card-tool-btn" onclick="App.speech.speak('${encodeURIComponent(article.title + '. ' + article.description)}')">
                                    🔊 Ouvir
                                </button>
                                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + ' - ' + article.link)}" target="_blank" rel="noopener noreferrer" class="card-tool-btn btn-whatsapp">
                                    💬 WhatsApp
                                </a>
                                <button class="card-tool-btn" onclick="App.share.copy('${article.link}')">
                                    📋 Copiar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.heroContainer.classList.remove('hidden');
        },

        createArticleHtml(article) {
            let title = article.title;
            let description = article.description;

            if (this.searchTerm) {
                const regex = new RegExp(`(${this.escapeRegex(this.searchTerm)})`, 'gi');
                title = title.replace(regex, '<mark>$1</mark>');
                description = description.replace(regex, '<mark>$1</mark>');
            }

            const fallbackImg = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80';
            const readingTime = this.calcReadingTime(article.description);
            const encodedText = encodeURIComponent(`${article.title}. ${article.description}`);
            const encodedShare = encodeURIComponent(`${article.title} - ${article.link}`);

            return `
                <article class="news-card">
                    <img src="${article.imageUrl || fallbackImg}"
                         alt="${article.altText || article.title}"
                         loading="lazy"
                         onerror="this.src='${fallbackImg}'">
                    <div class="news-content">
                        <div class="card-meta">
                            <span class="badge-category">📂 ${article.category || 'Geral'}</span>
                            <span class="reading-time">⏱️ ${readingTime}</span>
                        </div>
                        <time class="news-date" datetime="${article.date}" style="margin-bottom: 6px; font-weight: 600;">
                            📅 ${article.displayDate || article.date}
                        </time>
                        <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="stretched-link">
                            <h3>${title}</h3>
                        </a>
                        <p>${description}</p>
                        
                        <div class="card-footer" style="margin-top: 10px;">
                            <span class="read-more">${article.readMoreText || 'Leia Mais'} →</span>
                        </div>

                        <!-- Barra de Ferramentas / Social / Voz -->
                        <div class="card-tools-bar">
                            <button class="card-tool-btn" onclick="event.preventDefault(); App.speech.speak('${encodedText}')" title="Ouvir notícia">
                                🔊 Ouvir
                            </button>
                            <a href="https://api.whatsapp.com/send?text=${encodedShare}" target="_blank" rel="noopener noreferrer" class="card-tool-btn btn-whatsapp" onclick="event.stopPropagation();" title="Compartilhar no WhatsApp">
                                💬 WhatsApp
                            </a>
                            <button class="card-tool-btn" onclick="event.preventDefault(); event.stopPropagation(); App.share.copy('${article.link}')" title="Copiar link da notícia">
                                📋 Copiar
                            </button>
                        </div>
                    </div>
                </article>
            `;
        },

        calcReadingTime(text) {
            if (!text) return '1 min';
            const words = text.trim().split(/\s+/).length;
            const minutes = Math.max(1, Math.ceil(words / 150));
            return `${minutes} min`;
        },

        renderPagination(totalPages) {
            if (!this.paginationContainer) return;

            if (totalPages <= 1) {
                this.paginationContainer.innerHTML = '';
                return;
            }

            let html = `
                <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="App.news.changePage(${this.currentPage - 1})">
                    ◀ Anterior
                </button>
                <div class="pagination-numbers">
            `;

            for (let i = 1; i <= totalPages; i++) {
                html += `
                    <button class="pagination-number ${i === this.currentPage ? 'active' : ''}" onclick="App.news.changePage(${i})">
                        ${i}
                    </button>
                `;
            }

            html += `
                </div>
                <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="App.news.changePage(${this.currentPage + 1})">
                    Próxima ▶
                </button>
            `;

            this.paginationContainer.innerHTML = html;
        },

        changePage(page) {
            this.currentPage = page;
            this.renderHeroAndGrid();

            const section = document.querySelector('.latest-news');
            if (section) section.scrollIntoView({ behavior: 'smooth' });
        },

        escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    },

    /**
     * Módulo de Acessibilidade - Text-to-Speech (Leitura em Voz Alta).
     */
    speech: {
        currentUtterance: null,

        speak(encodedText) {
            if (!('speechSynthesis' in window)) {
                App.ui.showToast('Seu navegador não suporta leitura em voz alta.', 'info');
                return;
            }

            const text = decodeURIComponent(encodedText);

            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                App.ui.showToast('Leitura pausada.', 'info', 1500);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'pt-BR';
            utterance.rate = 1.05;

            utterance.onstart = () => {
                App.ui.showToast('Lendo notícia em voz alta... (clique novamente para parar)', 'info', 3000);
            };

            utterance.onend = () => {
                this.currentUtterance = null;
            };

            this.currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        }
    },

    /**
     * Módulo de Compartilhamento Social.
     */
    share: {
        async copy(link) {
            try {
                await navigator.clipboard.writeText(link);
                App.ui.showToast('Link copiado para a área de transferência!', 'success');
            } catch (_) {
                // Fallback para navegadores antigos
                const input = document.createElement('input');
                input.value = link;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                App.ui.showToast('Link copiado!', 'success');
            }
        }
    },

    /**
     * Módulo de Busca e Filtro em Tempo Real.
     */
    filter: {
        init() {
            this.searchInput = document.getElementById('search-input');
            if (!this.searchInput) return;

            this.searchInput.addEventListener('input', this.debounce((e) => {
                App.news.searchTerm = e.target.value.trim();
                App.news.currentPage = 1;
                App.news.applyFiltersAndRender();
            }, 250));
        },

        debounce(func, delay) {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        }
    },

    /**
     * Módulo de UI e Animações.
     */
    ui: {
        init() {
            this.initBackToTop();
        },

        animateCardsOnLoad() {
            const cards = document.querySelectorAll('.news-card');
            cards.forEach((card, i) => {
                card.style.animationDelay = `${i * 60}ms`;
                card.classList.add('visible');
            });
        },

        initShowMore() {
            document.querySelectorAll('.news-card').forEach(card => {
                const desc = card.querySelector('.news-content p');
                if (!desc || card.querySelector('.show-more-btn')) return;

                const wrapper = document.createElement('div');
                wrapper.className = 'text-wrapper';
                desc.parentNode.insertBefore(wrapper, desc);
                wrapper.appendChild(desc);

                if (desc.scrollHeight > desc.clientHeight) {
                    const btn = document.createElement('button');
                    btn.textContent = 'Mostrar mais';
                    btn.className = 'show-more-btn';
                    wrapper.appendChild(btn);

                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const isExpanded = desc.classList.toggle('expanded');
                        btn.textContent = isExpanded ? 'Mostrar menos' : 'Mostrar mais';
                        desc.style.maxHeight = isExpanded ? `${desc.scrollHeight}px` : null;
                    });
                }
            });
        },

        initBackToTop() {
            const btn = document.getElementById('back-to-top');
            if (!btn) return;

            window.addEventListener('scroll', () => {
                btn.classList.toggle('visible', window.scrollY > 300);
            });

            btn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        },

        showToast(message, type = 'info', duration = 3000) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            let icon = 'ℹ️';
            if (type === 'success') icon = '✅';
            else if (type === 'error') icon = '❌';

            toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
            container.appendChild(toast);

            setTimeout(() => toast.remove(), duration);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
