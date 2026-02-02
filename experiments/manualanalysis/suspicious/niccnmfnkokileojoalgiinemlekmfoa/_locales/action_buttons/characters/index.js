const API_BASE_URL = 'http://127.0.0.1:8000/api/characters';

export default {
    async getCharacters() {
        try {
            const response = await fetch(`${API_BASE_URL}/characters-json/`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching characters:', error);
            return [];
        }
    },

    async getCharactersByCategory(category) {
        try {
            const response = await fetch(`${API_BASE_URL}/characters-json/?category=${encodeURIComponent(category)}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching characters by category:', error);
            return [];
        }
    },

    async getCharacterByName(name) {
        try {
            const response = await fetch(`${API_BASE_URL}/character/${encodeURIComponent(name)}/`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching character:', error);
            return null;
        }
    },

    async getCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/characters/categories/`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching categories:', error);
            return ['All'];
        }
    }
}; 