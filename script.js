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
     * Módulo para carregar, filtrar e paginar as notícias.
     */
    news: {
        allNews: [],
        filteredNews: [],
        currentPage: 1,
        itemsPerPage: 8, // 8 notícias por página (2 linhas de 4 colunas) // 6 notícias por página para grid equilibrado (ex: 2x3 ou 3x2)
        searchTerm: '',

        async init() {
            this.container = document.querySelector('.news-preview-container');
            this.paginationContainer = document.getElementById('pagination-controls');
            if (!this.container) return;

            this.spinner = this.container.querySelector('.spinner');
            this.noResultsEl = this.container.querySelector('.no-results-message');

            try {
                const response = await fetch('news.json');
                if (!response.ok) {
                    throw new Error(`Erro HTTP! Status: ${response.status}`);
                }
                const newsData = await response.json();
                this.processData(newsData);
                this.renderPage();
            } catch (error) {
                console.error("Falha ao carregar as notícias:", error);
                if (this.noResultsEl) {
                    this.noResultsEl.textContent = 'Não foi possível carregar as notícias. Tente novamente mais tarde.';
                    this.noResultsEl.classList.remove('hidden');
                }
            } finally {
                if (this.spinner) this.spinner.classList.add('hidden');
            }
        },

        processData(newsData) {
            // Remove duplicatas baseadas no link
            const uniqueData = Array.from(new Map(newsData.map(article => [article.link, article])).values());

            // Filtra publicadas e ordena pelas mais recentes
            this.allNews = uniqueData
                .filter(article => article.published)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            this.filteredNews = [...this.allNews];
        },

        renderPage() {
            // Remove apenas os cards já renderizados
            const existingCards = this.container.querySelectorAll('.news-card');
            existingCards.forEach(card => card.remove());

            if (this.filteredNews.length === 0) {
                if (this.noResultsEl) this.noResultsEl.classList.remove('hidden');
                if (this.paginationContainer) this.paginationContainer.innerHTML = '';
                return;
            }

            if (this.noResultsEl) this.noResultsEl.classList.add('hidden');

            // Calcula a fatia de itens da página atual
            const totalPages = Math.ceil(this.filteredNews.length / this.itemsPerPage);
            if (this.currentPage > totalPages) this.currentPage = 1;

            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const pageNews = this.filteredNews.slice(startIndex, endIndex);

            const newsHtml = pageNews.map(article => this.createArticleHtml(article)).join('');

            if (this.noResultsEl) {
                this.noResultsEl.insertAdjacentHTML('beforebegin', newsHtml);
            } else {
                this.container.insertAdjacentHTML('beforeend', newsHtml);
            }

            // Anima e inicializa expansores
            App.ui.animateCardsOnLoad();
            App.ui.initShowMore();

            // Renderiza controles de paginação
            this.renderPagination(totalPages);
        },

        createArticleHtml(article) {
            let title = article.title;
            let description = article.description;

            // Se houver busca ativa, destaca o termo encontrado
            if (this.searchTerm) {
                const regex = new RegExp(`(${this.escapeRegex(this.searchTerm)})`, 'gi');
                title = title.replace(regex, '<mark>$1</mark>');
                description = description.replace(regex, '<mark>$1</mark>');
            }

            const fallbackImg = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&q=80';

            return `
                <article class="news-card">
                    <img src="${article.imageUrl || fallbackImg}"
                         alt="${article.altText || article.title}"
                         loading="lazy"
                         onerror="this.src='${fallbackImg}'">
                    <div class="news-content">
                        <div class="card-meta">
                            <time class="news-date" datetime="${article.date}">${article.displayDate || article.date}</time>
                            ${this.createInstagramLink(article.instagramLink)}
                        </div>
                        <a href="${article.link}"
                            target="_blank" rel="noopener noreferrer" class="stretched-link">
                            <h3>${title}</h3>
                        </a>
                        <p>${description}</p>
                        <div class="card-footer">
                            <span class="read-more">${article.readMoreText || 'Leia Mais'}</span>
                        </div>
                    </div>
                </article>
            `;
        },

        createInstagramLink(url) {
            if (!url) return '';
            return `
                <a href="${url}" target="_blank"
                    rel="noopener noreferrer" class="instagram-link"
                    aria-label="Ver esta notícia no Instagram">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                </a>
            `;
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
            const totalPages = Math.ceil(this.filteredNews.length / this.itemsPerPage);
            if (page < 1 || page > totalPages) return;

            this.currentPage = page;
            this.renderPage();

            // Rola suavemente até o topo da seção de notícias
            const section = document.querySelector('.latest-news');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        },

        escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    },

    /**
     * Módulo para busca e filtro instantâneo de notícias.
     */
    filter: {
        init() {
            this.searchInput = document.getElementById('search-input');
            if (!this.searchInput) return;

            this.searchInput.addEventListener('input', this.debounce((e) => {
                const term = e.target.value.toLowerCase().trim();
                App.news.searchTerm = term;

                if (!term) {
                    App.news.filteredNews = [...App.news.allNews];
                } else {
                    App.news.filteredNews = App.news.allNews.filter(article => {
                        const title = (article.title || '').toLowerCase();
                        const desc = (article.description || '').toLowerCase();
                        return title.includes(term) || desc.includes(term);
                    });
                }

                App.news.currentPage = 1;
                App.news.renderPage();
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
     * Módulo para gerenciar animações e UI.
     */
    ui: {
        init() {
            this.initBackToTop();
        },

        animateCardsOnLoad() {
            const newsCards = document.querySelectorAll('.news-card');
            newsCards.forEach((card, index) => {
                card.style.animationDelay = `${index * 80}ms`;
                card.classList.add('visible');
            });
        },

        initShowMore() {
            document.querySelectorAll('.news-card').forEach(card => {
                const description = card.querySelector('.news-content p');
                if (!description || card.querySelector('.show-more-btn')) return;

                const textWrapper = document.createElement('div');
                textWrapper.className = 'text-wrapper';
                description.parentNode.insertBefore(textWrapper, description);
                textWrapper.appendChild(description);

                const isOverflowing = description.scrollHeight > description.clientHeight;

                if (isOverflowing) {
                    const showMoreBtn = document.createElement('button');
                    showMoreBtn.textContent = 'Mostrar mais';
                    showMoreBtn.className = 'show-more-btn';
                    textWrapper.appendChild(showMoreBtn);

                    showMoreBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const isExpanded = description.classList.toggle('expanded');
                        showMoreBtn.textContent = isExpanded ? 'Mostrar menos' : 'Mostrar mais';
                        description.style.maxHeight = isExpanded ? `${description.scrollHeight}px` : null;
                    });
                }
            });
        },

        initBackToTop() {
            const backToTopButton = document.getElementById('back-to-top');
            if (!backToTopButton) return;

            const handleScroll = () => {
                backToTopButton.classList.toggle('visible', window.scrollY > 300);
            };

            const scrollToTop = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            window.addEventListener('scroll', handleScroll);
            backToTopButton.addEventListener('click', scrollToTop);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
