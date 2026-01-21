import apiClient from './client';

// Authentication APIs
export const login = (username, password) => {
    return apiClient.post('login', {
        username,
        password
    });
};

export const logout = () => {
    return apiClient.post('logout');
};

export const loginWithGoogle = (token) => {
    return apiClient.post('tokenlogin', { token });
};

// Shop Management APIs
export const listShop = (params = {}) => {
    const defaultParams = {
        page: 1,
        perPage: 100,
        limit: 100
    };
    return apiClient.get('list-shop', {
        params: { ...defaultParams, ...params }
    });
};

export const selectShop = (shopid) => {
    return apiClient.post('select-shop', {
        shopid
    });
};

export const favoriteShop = (shopid, isfavorite) => {
    return apiClient.put('favorite-shop', {
        shopid,
        isfavorite
    });
};
