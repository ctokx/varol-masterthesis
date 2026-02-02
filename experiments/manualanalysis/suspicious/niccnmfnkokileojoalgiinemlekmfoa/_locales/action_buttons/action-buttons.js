import charactersModule from './characters/index.js';

console.log('Action buttons script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    const ITEMS_PER_PAGE = 4;
    let currentPage = 1;
    let selectedCategory = 'All';
    let characters = [];
    let prevButton, nextButton, pageButtons, counter;
    
    // Глобальная функция обновления видимости кнопок
    const updateVisibleButtons = () => {
        const container = document.querySelector('.action-buttons');
        if (!container) return;

        const filteredCharacters = selectedCategory === 'All' 
            ? characters 
            : characters.filter(char => char.category === selectedCategory);

        const buttons = container.querySelectorAll('.action-button');
        const totalFilteredItems = filteredCharacters.length;
        const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);
        
        // Убеждаемся, что текущая страница не выходит за пределы
        if (currentPage > totalPages) {
            currentPage = totalPages || 1;
        }

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;

        // Сначала скрываем все кнопки
        buttons.forEach(button => {
            button.style.display = 'none';
        });

        // Показываем только отфильтрованные кнопки на текущей странице
        let visibleCount = 0;
        buttons.forEach(button => {
            const category = button.dataset.category;
            if (selectedCategory === 'All' || category === selectedCategory) {
                if (visibleCount >= startIndex && visibleCount < endIndex) {
                    button.style.display = 'flex';
                }
                visibleCount++;
            }
        });

        // Обновляем пагинацию
        updatePagination(totalFilteredItems, container);
    };

    const updatePagination = (totalItems, container) => {
        // Удаляем старую пагинацию если она есть
        const oldPagination = container.querySelector('.pagination-container');
        if (oldPagination) {
            oldPagination.remove();
        }

        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalPages <= 1) {
            prevButton = null;
            nextButton = null;
            pageButtons = [];
            counter = null;
            return;
        }

        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';

        // Добавляем счетчик
        counter = document.createElement('div');
        counter.className = 'pagination-counter';
        const visibleStart = totalItems === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1;
        const visibleEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
        counter.textContent = `${visibleStart}-${visibleEnd} из ${totalItems} характеристик`;

        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        // Кнопка "Назад"
        prevButton = document.createElement('button');
        prevButton.className = 'pagination-button';
        prevButton.innerHTML = '←';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateVisibleButtons();
            }
        });

        // Кнопки с номерами страниц
        pageButtons = [];
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'pagination-button';
            pageButton.textContent = i;
            if (i === currentPage) {
                pageButton.classList.add('active');
            }
            pageButton.addEventListener('click', () => {
                currentPage = i;
                updateVisibleButtons();
            });
            pageButtons.push(pageButton);
        }

        // Кнопка "Вперед"
        nextButton = document.createElement('button');
        nextButton.className = 'pagination-button';
        nextButton.innerHTML = '→';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updateVisibleButtons();
            }
        });

        pagination.append(prevButton, ...pageButtons, nextButton);
        paginationContainer.append(counter, pagination);
        container.appendChild(paginationContainer);
    };

    const createCharacterDetails = (character) => {
        const details = document.createElement('div');
        details.className = 'character-details';
        
        const purpose = document.createElement('p');
        purpose.textContent = character.details.purpose;
        
        const traitsTitle = document.createElement('h4');
        traitsTitle.textContent = 'Характеристики';
        
        const traits = document.createElement('div');
        traits.className = 'character-traits';
        
        Object.entries(character.details.traits).forEach(([key, trait]) => {
            const traitElement = document.createElement('div');
            traitElement.className = 'character-trait';
            
            const iconContainer = document.createElement('div');
            iconContainer.className = 'trait-icon';
            iconContainer.innerHTML = trait.icon;
            
            const textContainer = document.createElement('div');
            textContainer.className = 'trait-text';
            textContainer.textContent = trait.text;
            
            traitElement.appendChild(iconContainer);
            traitElement.appendChild(textContainer);
            traits.appendChild(traitElement);
        });
        
        const style = document.createElement('p');
        style.textContent = character.details.visual_style;
        
        details.append(purpose, traitsTitle, traits, style);
        return details;
    };

    const createCategories = async (container) => {
        const categoriesContainer = document.createElement('div');
        categoriesContainer.className = 'categories-container';

        try {
            // Получаем категории с сервера
            const categories = await charactersModule.getCategories();
            
            categories.forEach(category => {
                const button = document.createElement('button');
                button.className = 'category-button';
                if (category === selectedCategory) {
                    button.classList.add('active');
                }
                button.textContent = category;
                button.addEventListener('click', async () => {
                    // Обновляем активную категорию
                    document.querySelectorAll('.category-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');
                    selectedCategory = category;
                    currentPage = 1; // Сбрасываем на первую страницу при смене категории
                    
                    // Загружаем персонажей для выбранной категории
                    characters = await charactersModule.getCharactersByCategory(category);
                    
                    // Перерисовываем карточки и пагинацию
                    updateVisibleButtons();
                });
                categoriesContainer.appendChild(button);
            });
        } catch (error) {
            console.error('Error loading categories:', error);
            // Fallback to default category
            const button = document.createElement('button');
            button.className = 'category-button active';
            button.textContent = 'All';
            categoriesContainer.appendChild(button);
        }

        container.insertBefore(categoriesContainer, container.firstChild);
    };

    const initializeActionButtons = async () => {
        console.log('Initializing action buttons');
        const actionButtonsContainer = document.getElementById('actionButtonsContainer');
        if (!actionButtonsContainer) {
            console.log('Action buttons container not found');
            return;
        }

        const actionButtons = document.createElement('div');
        actionButtons.className = 'action-buttons';
        
        const buttonsGrid = document.createElement('div');
        buttonsGrid.className = 'action-buttons-grid';
        actionButtons.appendChild(buttonsGrid);
        
        try {
            // Загружаем персонажей с сервера
            characters = await charactersModule.getCharacters();
            console.log('Creating buttons from characters:', characters);
            
            // Создаем категории
            await createCategories(actionButtons);
            
            // Создаем все кнопки
            characters.forEach(character => {
                const buttonElement = document.createElement('button');
                buttonElement.className = 'action-button';
                buttonElement.dataset.category = character.category;
                
                // Добавляем ripple эффект при клике
                buttonElement.addEventListener('mousedown', (e) => {
                    const ripple = document.createElement('div');
                    ripple.style.position = 'absolute';
                    ripple.style.width = '20px';
                    ripple.style.height = '20px';
                    ripple.style.background = 'rgba(255, 255, 255, 0.4)';
                    ripple.style.borderRadius = '50%';
                    ripple.style.transform = 'translate(-50%, -50%)';
                    ripple.style.animation = 'ripple 0.6s linear';
                    ripple.style.left = `${e.clientX - buttonElement.getBoundingClientRect().left}px`;
                    ripple.style.top = `${e.clientY - buttonElement.getBoundingClientRect().top}px`;
                    
                    buttonElement.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 600);
                });
                
                const iconContainer = document.createElement('div');
                iconContainer.className = 'action-button-icon';
                iconContainer.innerHTML = character.icon;
                
                const contentContainer = document.createElement('div');
                contentContainer.className = 'action-button-content';
                
                const titleElement = document.createElement('span');
                titleElement.className = 'action-button-title';
                titleElement.textContent = character.name;
                
                const descriptionElement = document.createElement('span');
                descriptionElement.className = 'action-button-description';
                descriptionElement.textContent = character.description;
                
                contentContainer.appendChild(titleElement);
                contentContainer.appendChild(descriptionElement);
                contentContainer.appendChild(createCharacterDetails(character));
                
                buttonElement.appendChild(iconContainer);
                buttonElement.appendChild(contentContainer);
                
                // Обработка клика на кнопку
                buttonElement.addEventListener('click', () => {
                    const messageInput = document.querySelector('textarea');
                    if (messageInput) {
                        buttonElement.style.transform = 'scale(0.95)';
                        buttonElement.style.opacity = '0.7';
                        
                        setTimeout(() => {
                            // Формируем промпт на основе характеристик персонажа
                            const prompt = `I want you to act as ${character.name}. Here are your characteristics:

${Object.entries(character.details.traits).map(([key, trait]) => `- ${trait.text}`).join('\n')}

Purpose: ${character.details.purpose}
Style: ${character.details.visual_style}

Please respond in this character's style to my messages.`;
                            
                            messageInput.value = prompt;
                            messageInput.focus();
                            messageInput.dispatchEvent(new Event('input'));
                            actionButtons.classList.add('hidden');
                            actionButtonsContainer.style.display = 'none';
                        }, 200);
                    }
                });
                
                // Устанавливаем начальную видимость в зависимости от выбранной категории
                if (selectedCategory !== 'All' && character.category !== selectedCategory) {
                    buttonElement.style.display = 'none';
                }
                
                buttonsGrid.appendChild(buttonElement);
            });
            
            console.log('Appending buttons to container');
            actionButtonsContainer.innerHTML = '';
            actionButtonsContainer.appendChild(actionButtons);
            
            // Вызываем updateVisibleButtons сразу после создания всех кнопок
            updateVisibleButtons();
            
            // Добавляем анимацию появления кнопок
            setTimeout(() => {
                actionButtons.classList.remove('hidden');
                const buttons = buttonsGrid.querySelectorAll('.action-button');
                buttons.forEach((button, index) => {
                    if (button.style.display !== 'none') {  // Анимируем только видимые кнопки
                        button.style.opacity = '0';
                        button.style.transform = 'translateY(20px)';
                        setTimeout(() => {
                            button.style.opacity = '1';
                            button.style.transform = 'translateY(0)';
                        }, index * 100);
                    }
                });
            }, 100);
        } catch (error) {
            console.error('Error loading characters:', error);
        }

        const messageInput = document.querySelector('textarea');
        if (messageInput) {
            const updateButtonsVisibility = () => {
                const greetingContainer = document.querySelector('.greeting-container');
                
                if (messageInput.value.trim().length > 0) {
                    actionButtons.classList.add('hidden');
                    if (greetingContainer) greetingContainer.style.display = 'none';
                } else {
                    actionButtons.classList.remove('hidden');
                    if (greetingContainer) {
                        greetingContainer.style.display = 'block';
                        greetingContainer.style.opacity = '1';
                    }
                }
            };

            messageInput.addEventListener('input', updateButtonsVisibility);
            messageInput.addEventListener('keyup', (e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    updateButtonsVisibility();
                }
            });
        }
    };

    // Добавляем стили для ripple анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            0% {
                transform: translate(-50%, -50%) scale(0);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(40);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    const waitForContainer = setInterval(() => {
        console.log('Waiting for container...');
        const actionButtonsContainer = document.getElementById('actionButtonsContainer');
        if (actionButtonsContainer) {
            console.log('Container found, initializing buttons');
            clearInterval(waitForContainer);
            initializeActionButtons();
        }
    }, 100);

    // Обработчик события нового чата
    document.addEventListener('newChat', () => {
        const greetingContainer = document.querySelector('.greeting-container');
        const actionButtonsContainer = document.getElementById('actionButtonsContainer');
        
        if (greetingContainer) {
            greetingContainer.style.display = 'block';
            greetingContainer.style.opacity = '1';
        }
        
        if (actionButtonsContainer) {
            actionButtonsContainer.style.display = 'block';
            const actionButtons = actionButtonsContainer.querySelector('.action-buttons');
            if (actionButtons) {
                actionButtons.classList.remove('hidden');
            }
        }
    });

    document.addEventListener('reinitActionButtons', () => {
        console.log('Reinitializing action buttons');
        initializeActionButtons();
    });
}); 