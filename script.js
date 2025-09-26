const App = {
    /**
     * Inicializa todos os módulos da aplicação.
     */
    init() {
        this.theme.init();
        this.filter.init();
        this.ui.init();
    },

    /**
     * Módulo para gerenciar o tema (claro/escuro).
     */
    theme: {
        init() {
            this.themeToggle = document.getElementById('theme-toggle');
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
            const newLabel = theme === 'dark' ? 'Alternar para o tema claro' : 'Alternar para o tema escuro';
            this.themeToggle.setAttribute('aria-label', newLabel);
        }
    },

    /**
     * Módulo para gerenciar a busca e filtro de notícias.
     */
    filter: {
        init() {
            this.searchInput = document.getElementById('search-input');
            if (!this.searchInput) return;

            this.newsCards = document.querySelectorAll('.news-card');
            this.noResultsMessage = document.querySelector('.no-results-message');

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
            document.querySelectorAll('.news-card').forEach(card => {
                const description = card.querySelector('.news-content p');
                if (!description) return;

                const textWrapper = document.createElement('div');
                textWrapper.className = 'text-wrapper';
                description.parentNode.insertBefore(textWrapper, description);
                textWrapper.appendChild(description);

                if (description.scrollHeight > description.clientHeight) {
                    const showMoreBtn = document.createElement('button');
                    showMoreBtn.textContent = 'Mostrar mais';
                    showMoreBtn.className = 'show-more-btn';
                    textWrapper.appendChild(showMoreBtn);

                    showMoreBtn.addEventListener('click', () => {
                        description.classList.toggle('expanded');
                        showMoreBtn.textContent = description.classList.contains('expanded') ? 'Mostrar menos' : 'Mostrar mais';
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