document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DO TEMA ---
    const themeToggle = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;

    const updateTheme = (theme) => {
        htmlEl.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            themeToggle.setAttribute('aria-label', 'Alternar para o tema claro');
        } else {
            themeToggle.setAttribute('aria-label', 'Alternar para o tema escuro');
        }
    };

    // 1. Verifica preferência salva no localStorage
    const savedTheme = localStorage.getItem('theme');
    
    // 2. Se não houver, verifica a preferência do sistema operacional
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Define o tema inicial
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    updateTheme(initialTheme);

    themeToggle.addEventListener('click', () => {
        // Adiciona a classe para a animação de rotação
        themeToggle.classList.add('rotating');

        // Verifica qual é o tema atual e define o novo tema
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        updateTheme(newTheme);

        // Remove a classe após a animação para que ela possa ser reativada no próximo clique
        setTimeout(() => themeToggle.classList.remove('rotating'), 500);
    });

    // --- LÓGICA DO FILTRO (Versão corrigida e limpa) ---
    const initFilter = () => {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return; // Não faz nada se não houver campo de busca

        const newsCards = document.querySelectorAll('.news-card');
        const noResultsMessage = document.querySelector('.no-results-message');

        // 1. Armazena o texto original para não perdê-lo ao destacar
        newsCards.forEach(card => {
            const titleEl = card.querySelector('h3');
            const descriptionEl = card.querySelector('p');
            if (titleEl) card.dataset.originalTitle = titleEl.textContent;
            if (descriptionEl) card.dataset.originalDescription = descriptionEl.textContent;
        });

        // 2. Função Debounce para otimizar a performance da busca
        const debounce = (func, delay = 300) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        };

        // 3. Função que aplica o filtro de texto
        const applyTextFilter = () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            let visibleCardsCount = 0;

            newsCards.forEach(card => {
                const titleEl = card.querySelector('h3');
                const descriptionEl = card.querySelector('p');
                const originalTitle = card.dataset.originalTitle || '';
                const originalDescription = card.dataset.originalDescription || '';

                const isVisible = !searchTerm ||
                    originalTitle.toLowerCase().includes(searchTerm) ||
                    originalDescription.toLowerCase().includes(searchTerm);

                // Usamos um timeout de 0 para garantir que a animação de filtro funcione corretamente
                setTimeout(() => card.classList.toggle('hidden', !isVisible), 0);

                if (isVisible) {
                    visibleCardsCount++;
                    if (searchTerm) {
                        const regex = new RegExp(searchTerm, 'gi');
                        titleEl.innerHTML = originalTitle.replace(regex, match => `<mark>${match}</mark>`);
                        descriptionEl.innerHTML = originalDescription.replace(regex, match => `<mark>${match}</mark>`);
                    } else {
                        // Restaura o texto original se a busca estiver vazia
                        titleEl.innerHTML = originalTitle;
                        descriptionEl.innerHTML = originalDescription;
                    }
                }
            });

            noResultsMessage.classList.toggle('hidden', visibleCardsCount > 0);
        };

        // 4. Adiciona os "ouvintes" de evento
        searchInput.addEventListener('input', debounce(applyTextFilter));
    };

    // Inicia a lógica do filtro
    initFilter();

    // --- ANIMAÇÃO DE ENTRADA DOS CARDS ---
    const animateCardsOnLoad = () => {
        const newsCards = document.querySelectorAll('.news-card');
        newsCards.forEach((card, index) => {
            setTimeout(() => card.classList.add('visible'), index * 100); // Atraso de 100ms entre cada card
        });
    };
    animateCardsOnLoad();

    // --- LÓGICA DE "MOSTRAR MAIS" PARA O TEXTO ---
    const initShowMore = () => {
        const newsCards = document.querySelectorAll('.news-card');

        newsCards.forEach(card => {
            const description = card.querySelector('.news-content p');
            if (!description) return;
            
            // Agrupa o parágrafo em um wrapper para melhor controle do layout
            const textWrapper = document.createElement('div');
            textWrapper.className = 'text-wrapper';
            description.parentNode.insertBefore(textWrapper, description);
            textWrapper.appendChild(description);

            // Verifica se o texto real é maior que a área visível
            if (description.scrollHeight > description.clientHeight) {
                const showMoreBtn = document.createElement('button');
                showMoreBtn.textContent = 'Mostrar mais';
                showMoreBtn.className = 'show-more-btn';
                textWrapper.appendChild(showMoreBtn);

                showMoreBtn.addEventListener('click', () => {
                    description.classList.toggle('expanded');
                    if (description.classList.contains('expanded')) {
                        showMoreBtn.textContent = 'Mostrar menos';
                    } else {
                        showMoreBtn.textContent = 'Mostrar mais';
                    }
                });
            }
        });
    };
    initShowMore();

    // --- LÓGICA DO BOTÃO "VOLTAR AO TOPO" ---
    const backToTopButton = document.getElementById('back-to-top');

    const handleScroll = () => {
        // Mostra o botão se o usuário rolou mais de 300px para baixo
        if (window.scrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('scroll', handleScroll);
    backToTopButton.addEventListener('click', scrollToTop);
});