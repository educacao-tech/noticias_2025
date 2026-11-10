const App = {
    async init() {
        this.theme.init();
        this.accessibility.init();
        this.pwa.init();
        this.lightbox.init();
        await this.news.init();
        this.filter.init();
        this.ui.init();
    },

    /**
     * Módulo para gerenciar o tema (claro/escuro).
     */
    
    /**
     * Módulo de Acessibilidade Visual (Fontes e Alto Contraste).
     */
    accessibility: {
        currentSize: 16,
        init() {
            const savedSize = localStorage.getItem('user_font_size');
            if (savedSize) {
                this.currentSize = parseInt(savedSize, 10);
                document.documentElement.style.fontSize = this.currentSize + 'px';
            }
            const highContrast = localStorage.getItem('high_contrast') === 'true';
            if (highContrast) {
                document.body.classList.add('high-contrast');
            }
        },

        changeFontSize(delta) {
            this.currentSize = Math.min(24, Math.max(13, this.currentSize + delta * 2));
            document.documentElement.style.fontSize = this.currentSize + 'px';
            localStorage.setItem('user_font_size', this.currentSize);
        },

        resetFontSize() {
            this.currentSize = 16;
            document.documentElement.style.fontSize = '16px';
            localStorage.removeItem('user_font_size');
        },

        toggleContrast() {
            const isHc = document.body.classList.toggle('high-contrast');
            localStorage.setItem('high_contrast', isHc ? 'true' : 'false');
        }
    },

    /**
     * Módulo PWA (Progressive Web App - Instalação no Celular e Cache Offline).
     */
    pwa: {
        deferredPrompt: null,
        init() {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('./sw.js').catch(() => {});
                });
            }

            const installBtn = document.getElementById('btn-install-pwa');
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                if (installBtn) installBtn.classList.remove('hidden');
            });

            if (installBtn) {
                installBtn.addEventListener('click', async () => {
                    if (this.deferredPrompt) {
                        this.deferredPrompt.prompt();
                        const { outcome } = await this.deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                            installBtn.classList.add('hidden');
                        }
                        this.deferredPrompt = null;
                    }
                });
            }
        }
    },

    /**
     * Módulo de Reações com Emojis (❤️, 👏, 💡, 🎉)
     */
    reactions: {
        async react(articleId, reactionType, btnElement) {
            const storageKey = `reacted_${articleId}_${reactionType}`;
            if (localStorage.getItem(storageKey)) {
                App.share.showToast('Você já enviou esta reação para esta matéria!', 'info');
                return;
            }

            btnElement.classList.add('react-popped');
            setTimeout(() => btnElement.classList.remove('react-popped'), 400);

            const countSpan = btnElement.querySelector('.reaction-count');
            if (countSpan) {
                const cur = parseInt(countSpan.textContent, 10) || 0;
                countSpan.textContent = cur + 1;
            }
            btnElement.classList.add('user-reacted');
            localStorage.setItem(storageKey, 'true');

            const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:') ? '' : 'http://localhost:3001';
            try {
                await fetch(`${API_BASE}/api/news/react`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: articleId, reaction: reactionType })
                });
            } catch (_) {}
        }
    },

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
     * Módulo de Registro de Visualizações (Métricas de Engajamento).
     */
    views: {
        async record(id) {
            if (!id) return;
            try {
                await fetch('/api/news/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
            } catch (_) {
                // Silencioso se falhar no backend
            }
        }
    },

    /**
     * Módulo Lightbox - Visualizador de Fotos em Alta Resolução com Galeria.
     */
    lightbox: {
        images: [],
        currentIndex: 0,
        captionText: '',

        init() {
            this.modal = document.getElementById('lightbox-modal');
            this.mainImg = document.getElementById('lightbox-main-img');
            this.caption = document.getElementById('lightbox-caption');
            this.counter = document.getElementById('lightbox-counter');
            this.downloadBtn = document.getElementById('lightbox-download-btn');
            this.prevBtn = document.getElementById('lightbox-prev-btn');
            this.nextBtn = document.getElementById('lightbox-next-btn');
            this.thumbsContainer = document.getElementById('lightbox-thumbnails');

            if (!this.modal) return;

            // Fechar ao clicar fora da imagem
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal || e.target.classList.contains('lightbox-content-wrapper') || e.target.classList.contains('lightbox-image-box')) {
                    this.close();
                }
            });

            // Navegação por Teclado
            document.addEventListener('keydown', (e) => {
                if (!this.modal.classList.contains('active')) return;
                if (e.key === 'Escape') this.close();
                if (e.key === 'ArrowLeft') this.prev();
                if (e.key === 'ArrowRight') this.next();
            });

            // Navegação por Toque (Swipe) em Celulares e Tablets
            let touchStartX = 0;
            let touchEndX = 0;
            this.modal.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            this.modal.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                const diff = touchEndX - touchStartX;
                if (Math.abs(diff) > 45) {
                    if (diff < 0) this.next();
                    else this.prev();
                }
            }, { passive: true });
        },

        open(images, startIndex = 0, caption = '') {
            if (!images || images.length === 0) return;
            this.images = Array.isArray(images) ? images : [images];
            this.currentIndex = startIndex >= 0 && startIndex < this.images.length ? startIndex : 0;
            this.captionText = caption;

            this.updateImage();
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Evita scroll do fundo
        },

        close() {
            if (!this.modal) return;
            this.modal.classList.remove('active');
            if (this.mainImg) this.mainImg.classList.remove('zoomed');
            document.body.style.overflow = '';
        },

        goTo(index) {
            if (index >= 0 && index < this.images.length) {
                this.currentIndex = index;
                this.updateImage();
            }
        },

        updateImage() {
            const currentUrl = this.images[this.currentIndex];
            this.mainImg.src = currentUrl;
            this.mainImg.classList.remove('zoomed');

            if (this.caption) this.caption.textContent = this.captionText;
            if (this.counter) this.counter.textContent = `${this.currentIndex + 1} de ${this.images.length}`;
            if (this.downloadBtn) this.downloadBtn.href = currentUrl;

            // Controle das setas
            const hasMultiple = this.images.length > 1;
            if (this.prevBtn) {
                this.prevBtn.style.display = hasMultiple ? 'inline-flex' : 'none';
                this.prevBtn.disabled = this.currentIndex === 0;
            }
            if (this.nextBtn) {
                this.nextBtn.style.display = hasMultiple ? 'inline-flex' : 'none';
                this.nextBtn.disabled = this.currentIndex === this.images.length - 1;
            }

            // Barra inferior de miniaturas da galeria
            if (this.thumbsContainer) {
                if (hasMultiple) {
                    this.thumbsContainer.style.display = 'flex';
                    this.thumbsContainer.innerHTML = this.images.map((img, i) => `
                        <img src="${img}" class="lightbox-thumb ${i === this.currentIndex ? 'active' : ''}" 
                             alt="Foto ${i + 1}" 
                             onclick="App.lightbox.goTo(${i})"
                             title="Ir para foto ${i + 1}">
                    `).join('');
                } else {
                    this.thumbsContainer.style.display = 'none';
                    this.thumbsContainer.innerHTML = '';
                }
            }
        },

        next() {
            if (this.currentIndex < this.images.length - 1) {
                this.currentIndex++;
                this.updateImage();
            }
        },

        prev() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.updateImage();
            }
        },

        toggleZoom() {
            if (this.mainImg) {
                this.mainImg.classList.toggle('zoomed');
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
        currentYear: 'all',
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
                { id: 'all', label: 'Todas' },
                { id: 'most_read', label: '🔥 Mais Lidas' },
                { id: 'Educação Básica', label: 'Educação Básica' },
                { id: 'Projetos & Inovação', label: 'Projetos & Inovação' },
                { id: 'Premiações', label: 'Premiações' },
                { id: 'Alimentação Escolar', label: 'Alimentação Escolar' },
                { id: 'Eventos', label: 'Eventos' }
            ];

            container.innerHTML = categories.map(cat => {
                const active = cat.id === this.currentCategory ? 'active' : '';
                return `
                    <button class="category-pill ${active}" onclick="App.news.setCategory('${cat.id}', this)">
                        ${cat.label}
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

            // Filtro de categoria e ordenação especial Mais Lidas
            if (this.currentCategory === 'most_read') {
                // Ordena pelas mais visualizadas
                list = list.sort((a, b) => (b.views || 0) - (a.views || 0));
            } else if (this.currentCategory !== 'all') {
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

            // Ajusta o layout do grid quando houver poucos cards (evita grandes vazios à direita)
            if (this.container) {
                this.container.classList.remove('has-1-card', 'has-2-cards', 'has-3-cards');
                if (pageNews.length === 1) {
                    this.container.classList.add('has-1-card');
                } else if (pageNews.length === 2) {
                    this.container.classList.add('has-2-cards');
                } else if (pageNews.length === 3) {
                    this.container.classList.add('has-3-cards');
                }
            }

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
            const allImages = [article.imageUrl, ...(article.gallery || [])].filter(Boolean);
            const encodedGallery = encodeURIComponent(JSON.stringify(allImages));
            const safeTitle = (article.title || '').replace(/'/g, "\\'");

            const galleryStripHtml = allImages.length > 1 ? `
                <div class="card-gallery-strip" aria-label="Fotos da matéria" onclick="event.stopPropagation()">
                    ${allImages.slice(0, 5).map((img, idx) => `
                        <button type="button" class="card-gallery-thumb-btn" onclick="App.news.openGallery('${encodedGallery}', '${safeTitle}', ${idx}); App.views.record('${article.id}');" title="Ver foto ${idx + 1} em alta resolução">
                            <img src="${img}" alt="Miniatura ${idx + 1}" loading="lazy" onerror="this.src='${fallbackImg}'">
                        </button>
                    `).join('')}
                    ${allImages.length > 5 ? `
                        <button type="button" class="card-gallery-more-btn" onclick="App.news.openGallery('${encodedGallery}', '${safeTitle}', 5); App.views.record('${article.id}');" title="Ver mais ${allImages.length - 5} fotos">
                            +${allImages.length - 5}
                        </button>
                    ` : ''}
                </div>
            ` : '';

            const hasExternal = article.link && article.link !== '#' && article.link.trim() !== '';
            const mainAction = hasExternal 
                ? `href="${article.link}" target="_blank" rel="noopener noreferrer"`
                : `href="#" onclick="event.preventDefault(); App.news.openGallery('${encodedGallery}', '${safeTitle}', 0); App.views.record('${article.id}');"`;
            const heroBtnText = (article.readMoreText && article.readMoreText !== 'Leia Mais') 
                ? `${article.readMoreText} →` 
                : (hasExternal ? 'Ler matéria completa →' : '🖼️ Ver Galeria de Fotos →');

            this.heroContainer.innerHTML = `
                <div class="hero-card">
                    <div class="hero-media-wrapper">
                        <div class="hero-img-wrapper card-img-container" 
                             onclick="App.news.openGallery('${encodedGallery}', '${safeTitle}', 0); App.views.record('${article.id}');"
                             title="Clique para ver a foto ampliada">
                            <img src="${article.imageUrl || fallbackImg}" alt="${article.altText || article.title}" onerror="this.src='${fallbackImg}'">
                            ${allImages.length > 1 ? `<span class="badge-gallery-count">🖼️ +${allImages.length - 1} fotos</span>` : ''}
                        </div>
                        ${galleryStripHtml}
                    </div>
                    <div class="hero-content">
                        <div class="hero-badge-row">
                            <span class="badge-hero">⭐ Notícia em Destaque</span>
                            <span class="badge-category">📂 ${article.category || 'Educação Básica'}</span>
                            <span class="badge-views">👁️ ${article.views || 0} acessos</span>
                            <span class="reading-time">⏱️ ${readingTime}</span>
                        </div>
                        <h2 class="hero-title">
                            <a ${mainAction} onclick="App.views.record('${article.id}')">${article.title}</a>
                        </h2>
                        <time class="news-date" style="margin-bottom: 12px; font-weight: 600;">📅 ${article.displayDate || article.date}</time>
                        <div class="hero-desc news-description">${this.formatDescription(article.description)}</div>
                        <div class="reaction-bar" aria-label="Reações à matéria" style="margin-bottom: 12px;">
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'love', this)" title="Adorei">
                                <span class="emoji-icon">❤️</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.love) || 0}</span>
                            </button>
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'clap', this)" title="Parabéns">
                                <span class="emoji-icon">👏</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.clap) || 0}</span>
                            </button>
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'idea', this)" title="Inspirador">
                                <span class="emoji-icon">💡</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.idea) || 0}</span>
                            </button>
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'party', this)" title="Comemorar">
                                <span class="emoji-icon">🎉</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.party) || 0}</span>
                            </button>
                        </div>
                        <div class="hero-footer">
                            <a ${mainAction} class="read-more" style="font-weight: 700; color: var(--primary-color);" onclick="App.views.record('${article.id}')">
                                ${heroBtnText}
                            </a>
                            <div style="display: flex; gap: 8px;">
                                <button class="card-tool-btn" onclick="App.speech.speak('${encodeURIComponent(article.title + '. ' + article.description)}'); App.views.record('${article.id}')">
                                    🔊 Ouvir
                                </button>
                                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + ' - ' + article.link)}" target="_blank" rel="noopener noreferrer" class="card-tool-btn btn-whatsapp" onclick="App.views.record('${article.id}')">
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
            const allImages = [article.imageUrl, ...(article.gallery || [])].filter(Boolean);
            const encodedGallery = encodeURIComponent(JSON.stringify(allImages));
            const safeTitle = (article.title || '').replace(/'/g, "\\'");

            const galleryStripHtml = allImages.length > 1 ? `
                <div class="card-gallery-strip" aria-label="Fotos adicionais da matéria" onclick="event.stopPropagation()">
                    ${allImages.slice(0, 4).map((img, idx) => `
                        <button type="button" class="card-gallery-thumb-btn" onclick="App.news.openGallery('${encodedGallery}', '${safeTitle}', ${idx}); App.views.record('${article.id}');" title="Ver foto ${idx + 1} em alta resolução">
                            <img src="${img}" alt="Miniatura ${idx + 1}" loading="lazy" onerror="this.src='${fallbackImg}'">
                        </button>
                    `).join('')}
                    ${allImages.length > 4 ? `
                        <button type="button" class="card-gallery-more-btn" onclick="App.news.openGallery('${encodedGallery}', '${safeTitle}', 4); App.views.record('${article.id}');" title="Ver mais ${allImages.length - 4} fotos">
                            +${allImages.length - 4}
                        </button>
                    ` : ''}
                </div>
            ` : '';

            const hasExternal = article.link && article.link !== '#' && article.link.trim() !== '';
            const mainAction = hasExternal 
                ? `href="${article.link}" target="_blank" rel="noopener noreferrer"`
                : `href="#" onclick="event.preventDefault(); App.news.openGallery('${encodedGallery}', '${safeTitle}', 0); App.views.record('${article.id}');"`;
            const cardFooterText = (article.readMoreText && article.readMoreText !== 'Leia Mais') 
                ? `${article.readMoreText} →` 
                : (hasExternal ? 'Leia Mais →' : '🖼️ Ver Fotos →');

            return `
                <article class="news-card">
                    <div class="card-img-container" onclick="App.news.openGallery('${encodedGallery}', '${safeTitle}', 0); App.views.record('${article.id}');" title="Clique para ver a foto ampliada">
                        <img src="${article.imageUrl || fallbackImg}"
                             alt="${article.altText || article.title}"
                             loading="lazy"
                             onerror="this.src='${fallbackImg}'">
                        ${allImages.length > 1 ? `<span class="badge-gallery-count">🖼️ +${allImages.length - 1} fotos</span>` : ''}
                    </div>
                    ${galleryStripHtml}
                    <div class="news-content">
                        <div class="card-meta">
                            <span class="badge-category">📂 ${article.category || 'Geral'}</span>
                            <span class="badge-views">👁️ ${article.views || 0}</span>
                            <span class="reading-time">⏱️ ${readingTime}</span>
                        </div>
                        <time class="news-date" datetime="${article.date}" style="margin-bottom: 6px; font-weight: 600;">
                            📅 ${article.displayDate || article.date}
                        </time>
                        <a ${mainAction} class="stretched-link" onclick="App.views.record('${article.id}')">
                            <h3>${title}</h3>
                        </a>
                        <div class="news-description" style="font-size: 0.88rem; line-height: 1.5; margin-bottom: 8px;">${this.formatDescription(description)}</div>
                        <div class="reaction-bar" aria-label="Reações à matéria" onclick="event.stopPropagation()">
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'love', this)" title="Adorei">
                                <span class="emoji-icon">❤️</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.love) || 0}</span>
                            </button>
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'clap', this)" title="Parabéns">
                                <span class="emoji-icon">👏</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.clap) || 0}</span>
                            </button>
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'idea', this)" title="Inspirador">
                                <span class="emoji-icon">💡</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.idea) || 0}</span>
                            </button>
                            <button type="button" class="reaction-btn" onclick="App.reactions.react('${article.id}', 'party', this)" title="Comemorar">
                                <span class="emoji-icon">🎉</span>
                                <span class="reaction-count">${(article.reactions && article.reactions.party) || 0}</span>
                            </button>
                        </div>
                        
                        <div class="card-footer" style="margin-top: 10px;">
                            <span class="read-more">${cardFooterText}</span>
                        </div>

                        <!-- Barra de Ferramentas / Social / Voz -->
                        <div class="card-tools-bar">
                            <button class="card-tool-btn" onclick="event.preventDefault(); App.speech.speak('${encodedText}'); App.views.record('${article.id}')" title="Ouvir notícia">
                                🔊 Ouvir
                            </button>
                            <a href="https://api.whatsapp.com/send?text=${encodedShare}" target="_blank" rel="noopener noreferrer" class="card-tool-btn btn-whatsapp" onclick="event.stopPropagation(); App.views.record('${article.id}')" title="Compartilhar no WhatsApp">
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

        openGallery(encodedImages, title, startIndex = 0) {
            try {
                const images = JSON.parse(decodeURIComponent(encodedImages));
                App.lightbox.open(images, startIndex, title);
            } catch (_) {
                App.lightbox.open([decodeURIComponent(encodedImages)], startIndex, title);
            }
        },

        
        formatDescription(text) {
            if (!text) return '';
            let safe = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            // Negrito **texto**
            safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Itálico *texto*
            safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');
            // Links [texto](url)
            safe = safe.replace(/\[(.*?)\]\((https?:\/\/[^\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
            // Citação > "texto"
            safe = safe.replace(/^> "(.*?)"/gm, '<blockquote style="border-left: 3px solid var(--primary-color); padding-left: 8px; margin: 4px 0; font-style: italic; color: var(--light-text-color);">$1</blockquote>');
            return safe;
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
