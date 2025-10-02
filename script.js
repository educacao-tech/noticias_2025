const App = {
    /**
     * Inicializa todos os módulos da aplicação.
     * A inicialização agora é assíncrona para aguardar o carregamento das notícias.
     */
    async init() {
        this.theme.init();
        // Aguarda as notícias serem carregadas e renderizadas
        await this.news.init();
        // Só então inicializa os módulos que dependem dos cards
        this.filter.init();
        this.ui.init();
    },

    /**
     * Módulo para gerenciar o tema (claro/escuro).
     */
    theme: {
        // Centralizamos os paths dos SVGs para fácil manutenção
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
            this.addEventListeners();
        },

        setInitialTheme() {
            const savedTheme = localStorage.getItem('theme');
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
            this.update(initialTheme);
        },

        addEventListeners() {
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

        update(theme) {
            this.htmlEl.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);

            const isDark = theme === 'dark';
            this.themeIcon.innerHTML = isDark ? this.icons.sun : this.icons.moon;

            // Anuncia a mudança para leitores de tela
            const statusMessage = `Tema alterado para ${isDark ? 'escuro' : 'claro'}.`;
            this.themeStatus.textContent = statusMessage;
        }
    },

    /**
     * Módulo para carregar e renderizar as notícias a partir de um JSON.
     */
    news: {
        async init() {
            this.container = document.querySelector('.news-preview-container');
            this.spinner = this.container.querySelector('.spinner');
            this.noResultsEl = this.container.querySelector('.no-results-message');
            if (!this.container) return;

            try {
                const response = await fetch('news.json');
                if (!response.ok) {
                    throw new Error(`Erro HTTP! Status: ${response.status}`);
                }
                const newsData = await response.json();
                this.render(newsData);
            } catch (error) {
                console.error("Falha ao carregar as notícias:", error);
                this.noResultsEl.textContent = 'Não foi possível carregar as notícias. Tente novamente mais tarde.';
                this.noResultsEl.classList.remove('hidden');
            } finally {
                // Esconde o spinner independentemente do resultado (sucesso ou erro)
                this.spinner.classList.add('hidden');
            }
        },

        render(newsData) {
            // Filtra as notícias para incluir apenas as publicadas e depois ordena pela data
            const publishedNews = newsData
                .filter(article => article.published)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (publishedNews.length === 0) {
                this.noResultsEl.textContent = 'Nenhuma notícia publicada no momento.';
                this.noResultsEl.classList.remove('hidden');
                return;
            }

            // Remove any previously rendered news cards (excluding the no-results-message)
            const existingNewsCards = this.container.querySelectorAll('.news-card');
            existingNewsCards.forEach(card => card.remove());

            this.noResultsEl.classList.add('hidden');

            const newsHtml = publishedNews.map(article => this.createArticleHtml(article)).join('');
            // Insert the new news cards before the no-results-message, or at the end if no-results-message is not found
            if (this.noResultsEl) {
                this.noResultsEl.insertAdjacentHTML('beforebegin', newsHtml);
            } else {
                this.container.insertAdjacentHTML('beforeend', newsHtml);
            }
        },

        createArticleHtml(article) {
            // Usamos template literals para criar o HTML de forma legível e segura.
            return `
                <article class="news-card">
                    <img src="${article.imageUrl}"
                         alt="${article.altText}"
                         loading="lazy">
                    <div class="news-content">
                        <div class="card-meta">
                            <time class="news-date" datetime="${article.date}">${article.displayDate}</time>
                            ${this.createInstagramLink(article.instagramLink)}
                        </div>
                        <a href="${article.link}"
                            target="_blank" rel="noopener noreferrer" class="stretched-link">
                            <h3>${article.title}</h3>
                        </a>
                        <p>${article.description}</p>
                        <div class="card-footer">
                            <span class="read-more">${article.readMoreText}</span>
                        </div>
                    </div>
                </article>
            `;
        },

        createInstagramLink(url) {
            if (!url) {
                return ''; // Retorna uma string vazia se a URL não existir
            }
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
        }
    },

    /**
     * Módulo para gerenciar a busca e filtro de notícias.
     */
    filter: {
        init() {
            this.searchInput = document.getElementById('search-input');
            // O init do filtro agora é chamado DEPOIS que os cards são criados.
            // Portanto, podemos selecionar os elementos com segurança.
            this.newsCards = document.querySelectorAll('.news-card');
            this.noResultsMessage = document.querySelector('.no-results-message');

            if (!this.searchInput || this.newsCards.length === 0) return;

            this.storeOriginalContent();
            this.addEventListeners();
        },

        storeOriginalContent() {
            this.newsCards.forEach(card => {
                const titleEl = card.querySelector('h3');
                const descriptionEl = card.querySelector('p');
                if (titleEl) card.dataset.originalTitle = titleEl.textContent;
                if (descriptionEl) card.dataset.originalDescription = descriptionEl.textContent;
            });
        },

        addEventListeners() {
            this.searchInput.addEventListener('input', this.debounce(this.applyFilter.bind(this), 300));
        },

        debounce(func, delay) {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        applyFilter() {
            const searchTerm = this.searchInput.value.toLowerCase().trim();
            let visibleCardsCount = 0;

            this.newsCards.forEach(card => {
                const titleEl = card.querySelector('h3');
                const descriptionEl = card.querySelector('p');
                const originalTitle = card.dataset.originalTitle || '';
                const originalDescription = card.dataset.originalDescription || '';

                const isVisible = !searchTerm || originalTitle.toLowerCase().includes(searchTerm) || originalDescription.toLowerCase().includes(searchTerm);

                requestAnimationFrame(() => card.classList.toggle('hidden', !isVisible));

                if (isVisible) {
                    visibleCardsCount++;
                    if (searchTerm) {
                        const regex = new RegExp(searchTerm, 'gi');
                        if (titleEl) titleEl.innerHTML = originalTitle.replace(regex, match => `<mark>${match}</mark>`);
                        if (descriptionEl) descriptionEl.innerHTML = originalDescription.replace(regex, match => `<mark>${match}</mark>`);
                    } else {
                        if (titleEl) titleEl.innerHTML = originalTitle;
                        if (descriptionEl) descriptionEl.innerHTML = originalDescription;
                    }
                }
            });

            this.noResultsMessage.classList.toggle('hidden', visibleCardsCount > 0);
        }
    },

    /**
     * Módulo para gerenciar interações e animações da UI.
     */
    ui: {
        // O init da UI também é chamado DEPOIS que os cards são criados.
        init() {
            this.animateCardsOnLoad();
            this.initShowMore();
            this.initBackToTop();
        },

        animateCardsOnLoad() {
            const newsCards = document.querySelectorAll('.news-card');
            newsCards.forEach((card, index) => {
                setTimeout(() => card.classList.add('visible'), index * 100);
            });
        },

        initShowMore() {
            // Seleciona os cards que foram criados dinamicamente.
            document.querySelectorAll('.news-card').forEach(card => {
                const description = card.querySelector('.news-content p');
                if (!description) return;

                const textWrapper = document.createElement('div');
                textWrapper.className = 'text-wrapper';
                description.parentNode.insertBefore(textWrapper, description);
                textWrapper.appendChild(description);

                // Verifica se o texto real é maior que a área visível
                const isOverflowing = description.scrollHeight > description.clientHeight;

                if (isOverflowing) {
                    const showMoreBtn = document.createElement('button');
                    showMoreBtn.textContent = 'Mostrar mais';
                    showMoreBtn.className = 'show-more-btn';
                    textWrapper.appendChild(showMoreBtn);

                    showMoreBtn.addEventListener('click', () => {
                        const isExpanded = description.classList.toggle('expanded');
                        showMoreBtn.textContent = isExpanded ? 'Mostrar menos' : 'Mostrar mais';

                        // Define a altura máxima dinamicamente para se ajustar ao conteúdo
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

// Garante que o DOM esteja carregado antes de inicializar a aplicação.
document.addEventListener('DOMContentLoaded', () => App.init());